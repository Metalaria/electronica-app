# Electrónica Práctica Avanzada — lector

Aplicación privada y sin conexión para leer «Electrónica Práctica Avanzada» en Windows, macOS y Android.
Es una sola aplicación web (Svelte 5 + TypeScript + Vite) empaquetada con Tauri 2. Todo el contenido se
genera a partir de las fuentes Typst del libro, de modo que una corrección en un capítulo llega a la
aplicación con solo regenerar y volver a compilar.

Incluye la fase 1 (el lector) y la fase 2 (el simulador de circuitos, con las 309 netlists del libro). Las
fases siguientes (ejercicios, modelos 3D, editor de esquemas) están descritas en `ESQUEMA.md`; el editor de
esquemas (fase 5) está en la versión 0.7.

## Qué hace

- **Navegación**: a la izquierda, un **carril de iconos** con todas las secciones de la aplicación por orden de
  uso (Inicio, Libro, Buscar, Simulador, Calculadoras, Ejercicios, Repaso, Componentes, Conceptos, Instrumentos, Kit
  FM7303, Consolas, Proyectos KiCad, Glosario, Marcadores y, desde la 1.0, Modo docente y Guía de uso; el logotipo también lleva a Inicio), cada una con su nombre debajo y la marca de
  la actual; si la ventana es baja, las últimas pasan a «Más». Junto al carril, el **índice del libro**: tomos
  plegables con su barra de lectura → capítulos con su anillo → secciones, con la sección que se lee resaltada y
  siempre a la vista (botón «Ir a la sección actual» si se ha desplazado el índice), las leídas marcadas y un
  **filtro** por palabras sin tildes o por número («5.8», «cap 33», «ap B»). El índice se oculta con el botón de
  la barra superior (o pulsando «Libro» mientras se lee) y se recuerda por herramienta: en el simulador, las
  consolas y demás herramientas empieza oculto para dejarles todo el ancho. En la barra superior, la miga
  «Capítulo 5 · Diodos › 5.8 …» abre las secciones del capítulo y los capítulos anterior y siguiente, y los botones
  ↑ ↓ (o `Alt ↑` / `Alt ↓`) van a la sección anterior o siguiente. En el teléfono y la tableta en vertical, una
  **barra inferior** (0.9: Inicio, Libro, Simulador, Ejercicios, Más; una píldora detrás del icono activo):
  «Libro» abre el índice en un cajón y «Más», el resto (Buscar incluido); el botón Atrás de Android los cierra primero.
- **Lectura** con la tipografía del libro para el texto corrido (Source Serif 4; Source Code Pro para el código) y
  el estilo 1.1 en lo demás (Space Grotesk en los títulos, Inter en la interfaz; las fuentes van dentro de la
  aplicación). El color del capítulo es el acento: apertura, números de sección, ecuaciones, tablas.
- **Estilo visual 1.1 en toda la aplicación** (el de la maqueta aprobada «Divisor de tensión»): páginas blancas
  con tarjetas suaves y redondeadas, títulos en Space Grotesk, texto en Inter, azul como acento (el azul marino
  del primer tomo pasa a ser ese azul; los demás tomos conservan su color), naranja para las lecturas grandes, la
  racha y el XP, progreso por segmentos (hecho en verde, el actual en azul), tres botones de 44 px (principal
  relleno, secundario con borde, discreto solo texto), botones desactivados en gris legible, avisos de acierto y
  de «todavía no» con fondo tintado. Mismo diseño y misma navegación que antes: es un cambio de aspecto. Claro,
  sepia y oscuro con contraste AA.
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
- **Vista previa de las referencias** (0.8): sin salir de la lectura, una tarjeta flotante enseña el destino:
  la figura con su número y su pie, la tabla, la ecuación dibujada con su etiqueta, o, para una sección, un
  capítulo, un ejercicio o un problema, su número, su título, el color de su bloque, el comienzo del texto y su
  primera figura. Con ratón se abre al dejar el puntero un momento sobre la referencia (un clic sigue saltando
  como siempre); en pantalla táctil, **un toque abre la vista previa** y «Ir a …» (o un segundo toque en la
  misma referencia) salta, con su «Volver»; con teclado, `Intro` sobre la referencia la abre y pone el foco en
  «Ir a …», de modo que otro `Intro` salta. Se cierra con `Esc`, tocando fuera o desplazando la página. En el
  ordenador y la tableta flota junto a la referencia sin taparla; en el teléfono es una hoja abajo (o arriba, si
  la referencia está en la parte baja de la pantalla). Funciona igual en los ejercicios, el glosario y los tests.
- **Glosario**: orden alfabético, salto por letras, filtro instantáneo (sin importar tildes) y, en cada
  término, los enlaces «→ 5.3» a las secciones donde se trata. Desde la 0.8, los términos que lo tienen muestran
  su **símbolo de circuito** (los mismos símbolos que los esquemas automáticos) y, si son una pieza física con
  modelo 3D, su **miniatura 3D** con «Ver en 3D»; las miniaturas se dibujan en el propio equipo solo cuando el
  término llega a la pantalla (el 3D no se carga antes) y se guardan, por tema, mientras la aplicación sigue
  abierta.
- **Búsqueda** en todo el libro (secciones y glosario) con `Ctrl K` / `⌘ K` o `/`: no distingue
  tildes ni mayúsculas, acepta el comienzo de las palabras y tolera pequeñas erratas. Cada resultado
  indica el capítulo y un fragmento con las coincidencias marcadas.
- **Datos personales**, guardados en el propio dispositivo:
  - la última posición de lectura de cada capítulo (la portada ofrece «Seguir leyendo»);
  - marcadores de sección y notas breves por sección (botones junto al título de cada sección);
  - la vista «Marcadores y notas», en el orden del libro;
  - tema claro, sepia, oscuro o el del sistema, y tamaño del texto (botón «Aa»).
- **Inicio con racha y camino del libro** (0.9, lavado de cara al estilo de Brilliant a partir de las maquetas
  aprobadas): un saludo («Hola, Gonzalo»; el nombre se escribe en «Aa» → «Su nombre», solo en este dispositivo; vacío
  dice «Hola») y, en dos columnas en la tableta y el ordenador (una en el teléfono):
  - **«Seguir leyendo»**: la lección por pasos que se dejó a medias («Paso 4 de 7 · unos 6 minutos», «Continuar»
    vuelve a ese paso) o, si no hay ninguna, la sección donde se dejó la lectura, con una barra de segmentos (uno
    por sección del capítulo) y el enlace «Estudiar … por pasos». Lleva la figura de esa sección: la única imagen
    que carga la portada.
  - **Racha**: días seguidos cumpliendo el objetivo diario, con una llama y los últimos siete días; hoy cuenta en
    cuanto se cumple. **Objetivo de hoy**: un anillo («2/3»); se elige en «Aa» entre pasos de lección y preguntas
    de repaso, de 1 a 10 al día (por defecto, 3 pasos). Cuentan los pasos de las lecciones, las preguntas
    contestadas (tarjetas, tests, examen, fallos y las de las lecciones) y las secciones marcadas como leídas:
    con un objetivo de pasos, cada sección leída cuenta como un paso (se puede desactivar en «Aa», «Cada sección
    que marcas como leída cuenta como un paso»), así que leer el libro como siempre también mantiene la racha. El
    día empieza a las 04:00, como en el repaso. Desde la 0.12, lo hecho el mismo día en varios dispositivos **se
    suma** (estudiar 2 pasos en el teléfono y 2 en la tableta son 4 en los dos, y cumplen un objetivo de 3), sin contar
    nada dos veces por mucho que se sincronice. Mientras algún dispositivo siga con la 0.10 o la 0.11, lo que haga
    ese dispositivo sin haber visto la suma completa (o encima de un paso deshecho) puede contarse de menos, y esa
    diferencia ya no se recupera. Un dispositivo que pase más de 90 días sin
    sincronizar no trae de vuelta los registros ya compactados en otro (sus copias, sin cambios y más antiguas que lo
    podado del fichero, se descartan); solo podría si se borrara el fichero de sincronización y se creara de nuevo.
  - **Repaso pendiente**: las tarjetas de hoy del mazo elegido, con «Repasar».
  - **El libro como camino**: el tomo que se lee, desplegado, con un nodo por capítulo (leído con ✓, el actual
    con «Está aquí · 5.2», los pendientes con su número) y las secciones leídas de cada uno; los demás tomos, en
    filas con los colores de sus bloques que se despliegan al tocarlas. Todo del color de su bloque.
  - Debajo siguen «También leyendo», el progreso con los capítulos en curso y los atajos (Buscar, Glosario…).
  El mismo estilo (tarjetas redondeadas, botón principal grande, chips, rótulos, títulos con Source Serif) llega a
  las portadas del Simulador, Ejercicios, Repaso, Calculadoras, Componentes, Conceptos y Consolas, sin cambiar lo
  que hacen. Pruebas: `npx playwright test -c playwright.inicio09.config.ts tests/inicio09.spec.ts
  tests/visual.spec.ts tests/navegacion.spec.ts` (compilación propia, puerto 4301); capturas en el Mac, la
  tableta en vertical y el teléfono, en claro, sepia y oscuro: `node tests/inicio09-capturas.mjs` →
  `tests/capturas/lavado09/inicio/`.
  Pruebas de las mejoras de la 0.8 (vista previa, glosario con imagen; el inicio, ya como camino):
  `npx playwright test -c playwright.visual.config.ts tests/visual.spec.ts` (compilación propia, puerto 4271);
  capturas: `node tests/visual-capturas.mjs` → `tests/capturas/visual/`.
- **Diseño adaptable**: en el teléfono y la tableta en vertical, una columna, barra inferior e índice en un cajón;
  en tableta apaisada y ordenador, carril, índice fijo y texto. Rutas con almohadilla (`#/cap05/sec-5.3`), que funcionan sin servidor
  dentro de Tauri.
- **Saltos rápidos entre capítulos**: al seguir una referencia se dibuja primero el tramo de destino y el
  resto del capítulo después, en los ratos libres; mientras se lee, la aplicación prepara en segundo plano
  los capítulos a los que remite la sección en pantalla y el siguiente.
- **Simulador de circuitos** (sección siguiente): botón «Simular» junto a cada figura, sección, problema o
  ejercicio que tiene netlist.
- **Editor de esquemas**: dibujar un circuito con los símbolos del libro y simularlo sin escribir la netlist, o
  abrir como dibujo editable cualquier netlist del libro (ver más abajo).
- **Consolas**: las placas base de la NES, la Neo Geo AES, la Master System II, la Mega Drive, la Game Boy y la
  Game Boy Color con foto interactiva, arquitectura animada y esquema real con redes interactivas (ver más abajo).
- **Proyectos KiCad**: las siete placas de los cuatro proyectos detallados (capítulos 48 a 51) en 3D y en 2D, con su
  esquema de KiCad, sus redes, sus tensiones y la comprobación placa ↔ esquema ↔ lista de materiales ↔ libro (botón «Ver
  la placa» en el libro; ver más abajo).
- **Componentes animados**: 39 animaciones interactivas de cómo funciona cada componente por dentro, enlazadas
  con sus secciones y figuras (botón «Ver animación» en el libro; ver más abajo).
- **Componentes en 3D**: 39 modelos tridimensionales de los componentes del libro, con corte, explosión y
  etiquetas, y el interruptor «Animación | Pieza 3D» en cada animación de componente (ver más abajo).
- **Conceptos animados**: 34 animaciones interactivas de la teoría (fasores, Fourier, aliasing, realimentación,
  conmutadas, metaestabilidad, líneas de transmisión…) calculadas en el momento con los números del libro, con
  el mismo botón «Ver animación» junto a sus secciones y figuras (ver más abajo).
- **Instrumentos**: el Brymen BM869s y el FNIRSI 2C53T en virtual, en un banco de pruebas con cualquier circuito
  del simulador y las doce prácticas del capítulo 21 guiadas (botón «Practicar» en el libro; ver más abajo).
- **Kit FM7303**: el receptor de FM del capítulo 15, completo y vivo: esquema con todos sus componentes, tensiones
  simuladas frente al mapa del libro, multímetro, recorrido de la señal y osciloscopio en TP1–TP4, alineación
  guiada y averías (botón «Kit FM7303» en el libro; ver más abajo).
- **Aprender con el libro**: ejercicios y problemas que corrigen la respuesta (prefijos, unidades, coma
  decimal), con pistas progresivas y repaso de los fallados; deducciones paso a paso; progreso de lectura por
  sección, capítulo y tomo (ver más abajo).
- **Calculadoras**: 351 fórmulas del libro listas para calcular cualquiera de sus variables, con un dibujo que
  se mueve con los valores, deslizadores, cuenta paso a paso, «¿Qué pasa si…?» y lo que dice el libro de cada
  una; botón «Calcular» junto a cada ecuación catalogada y tarjetas de fórmulas vivas (ver más abajo).
- **Repaso**: tarjetas de los 1 054 términos del glosario con repetición espaciada y 1 118 preguntas de test de
  todos los capítulos y apéndices, cada una con la cita del libro de la que sale (ver más abajo).
- **Estudiar por pasos** (0.9): cualquier sección del libro como una lección de una pantalla por subapartado, con
  sus figuras vivas, ecuaciones y calculadoras, y después las preguntas de Repaso de esa sección (ver más abajo).
- **Cursos, XP, niveles y logros** (0.11): diez cursos temáticos con su prueba de nivel, sonidos y vibración al
  acertar y fallar, celebración al terminar cada lección, XP, niveles con nombre, 28 logros y un recordatorio
  diario en Android (ver «Cursos, XP y logros» más abajo).
- **Modo docente** (1.0): cursos y exámenes propios con las preguntas y los problemas del libro, que se hacen en la
  aplicación (con nota y el desarrollo del libro) o se exportan a PDF, con variantes y soluciones (ver más abajo).
- **Guía de uso** (1.0): cómo se usa cada parte de la aplicación, dentro de ella y sin conexión, con su propio buscador y
  enlaces «¿Cómo funciona?» en unos pocos sitios (ver «Guía de uso» más abajo).

### Atajos de teclado

| Tecla | Acción |
|---|---|
| `Ctrl K` / `⌘ K`, `/` | Buscar |
| `Alt ↑` / `Alt ↓` | Sección anterior / siguiente |
| `↑` `↓` `→` `←` `Intro` (en el índice) | Recorrer, desplegar, plegar y abrir; `↓` desde el filtro entra en la lista |
| `↑` `↓` `Intro` | Elegir y abrir un resultado de búsqueda |
| `Esc` | Cerrar la búsqueda, el visor de figuras o el panel «Aa» |
| `+` `-` `0` | Acercar, alejar y ajustar en el visor de figuras |
| `Tab` (en el visor de figuras) | Recorre solo sus controles: la página de debajo queda inerte mientras está abierto |
| `Ctrl Intro` | Guardar la nota que se está escribiendo |
| `Tab` (al abrir cualquier página) | La primera parada es «Saltar al contenido»: `Intro` lleva al título de la página |
| Flechas · `Intro` · `N` (en el lienzo del editor y en la protoboard) | Mover el cursor · actuar donde está (como un toque) · ir a la pieza siguiente (ver «Accesibilidad») |

### Accesibilidad (1.0)

La 1.0 se ha revisado entera con las pautas WCAG 2.2, nivel AA, en los tres temas (claro, sepia y oscuro), en el
escritorio y en pantallas táctiles (teléfono de 360 px y tableta), solo con el teclado y con lector de pantalla
(NVDA en Windows, VoiceOver en el Mac, TalkBack en Android).

- **Moverse por la aplicación**: la primera pulsación de `Tab` en cualquier página muestra «Saltar al contenido». Al
  cambiar de página (el carril, las pestañas, un enlace o un botón), el foco pasa al título de la página nueva, así que
  el lector de pantalla la anuncia y `Tab` sigue desde arriba; en el índice del libro el foco se queda en el índice
  mientras se recorre con las flechas. Los diálogos (confirmaciones, «Aa», búsqueda, visor de figuras) retienen el
  foco, se cierran con `Esc` y lo devuelven a donde estaba (también la búsqueda, que antes lo dejaba en el vacío).
- **Respuestas**: al responder una pregunta, el foco pasa al veredicto («¡Correcto!» / «No es correcto» y la
  explicación). Al comprobar un ejercicio, una línea para el lector de pantalla resume cuántas respuestas son correctas
  y qué falla en cada una, y cada campo queda unido a su mensaje (se vuelve a leer al volver al campo).
  En las prácticas, «Comprobar» pasa al momento a «Comprobando…» (ocupado, sin perder el foco, también en un equipo
  lento: en «Monte el circuito» tardaba casi medio segundo en reaccionar con la CPU frenada 4×) y el resultado se anuncia
  siempre, aunque repita el mensaje del intento anterior.
- **Foco visible en los campos de texto** (QA final): todos llevan el anillo de foco de la aplicación (2 px del color de
  acento, contraste de al menos 3:1 en los tres temas), no solo un cambio de color del borde: el buscador de la guía, la
  respuesta del problema del día y de las prácticas numéricas, la búsqueda, los filtros del índice, del glosario, de las
  calculadoras, de la galería y del catálogo 3D, los valores de las calculadoras y el editor de netlists.
- **Sin anillo en los títulos que reciben el foco** (fix12): tras cambiar de página el foco va al título (para que el
  lector de pantalla lo lea), pero un título no es un control y no lleva anillo (`app.css`: `h1`…`h6` y `main` con
  `tabindex="-1"`). Antes, al abrir un curso sin haber tocado la pantalla, su título salía con un recuadro grande. Lo
  mismo en las etapas de los proyectos y los pasos del laboratorio.
- **Editor de esquemas y protoboard con el teclado**: el lienzo y la mesa se alcanzan con `Tab`. Al elegir con el
  teclado una pieza de la paleta (o una carta de la bandeja de la protoboard), el foco pasa al lienzo con un cursor.
  Las flechas lo mueven (de punto en punto de la rejilla en el editor, de agujero en agujero en la protoboard;
  `Ctrl` + flecha, de cinco en cinco) y `Intro` hace lo mismo que un toque en ese punto: coloca la pieza, selecciona la
  que tiene una patilla ahí, o con la herramienta Cable (`W`; en la protoboard basta un agujero libre) empieza un cable y
  lo termina en el siguiente `Intro`. `N` y `Mayús N` eligen la pieza (o el cable) siguiente o anterior;
  `Mayús` + flechas mueven lo elegido; `R` gira, `Supr` borra y `Esc` cancela. Cada pulsación se anuncia (dónde está el
  cursor, qué hay ahí, qué se ha hecho).
- **Ecuaciones y unidades**: las ecuaciones del libro (en línea y destacadas) se leen en palabras, no por su código:
  «V sub B igual a V sub CC por R sub 2 entre R sub 1 más R sub 2», «I sub D igual a 1 entre 2 por k por V sub GS menos V
  sub th, todo al cuadrado». Las unidades que siguen a un número se dicen enteras («4,7 kiloohmios», «10,7 megahercios»)
  en las ecuaciones, las lecturas de las gráficas y la pantalla del multímetro.
- **Gráficas e instrumentos**: en las gráficas, las flechas leen los valores bajo el cursor y el lector de pantalla los
  dice. La pantalla del multímetro Brymen se lee como texto («Pantalla: 4,999 V; DC, AUTO»); su selector giratorio es un
  control deslizante (flechas).
- **Examen del modo docente**: el tiempo restante se puede leer en cualquier momento; el aviso hablado solo suena a la
  mitad del tiempo, a falta de 10, 5 y 2 minutos y en el último minuto (no cada minuto).
- **Animaciones**: con «Reducir movimiento» en el sistema, las animaciones empiezan en pausa y las transiciones son
  instantáneas.
- **Contraste y tamaños**: textos con contraste de al menos 4,5:1 y controles y trazos de al menos 3:1 en los tres
  temas; el estado nunca se dice solo con el color (siempre hay texto o icono). En pantallas táctiles, cada control
  tiene una zona de toque de al menos 44 × 44 px; todo se reorganiza sin desplazamiento lateral a 320–360 px de ancho y
  con el texto ampliado.

Lo que solo se puede comprobar en los dispositivos: TalkBack en la tableta Xiaomi Pad 6 y en el teléfono (gestos de
exploración por toque sobre el lienzo y la protoboard, que con TalkBack se usan con doble toque), VoiceOver en el Mac
(rotor de encabezados y de puntos de referencia) y NVDA en Windows (modo de aplicación en el lienzo, la protoboard y las
gráficas).

Pruebas: `tests/accesibilidad10-rutas.spec.ts` (axe con WCAG 2.0/2.1/2.2 A y AA y buenas prácticas, contraste incluido,
en 79 rutas de todos los tipos, en claro, sepia y oscuro, en el escritorio y en un teléfono de 360 px; además, un solo
`main`, «Saltar al contenido», título de página, `lang="es"`, un `h1` y sin desplazamiento lateral en el teléfono) y
`tests/accesibilidad10-unidad.spec.ts` (sin navegador: lecturas de ecuaciones y que ninguna de las ≈ 800 ecuaciones
del libro deje código de Typst en lo que se lee), `tests/accesibilidad10-teclado.spec.ts` (solo con el teclado: saltar
al contenido y el foco tras cambiar de ruta, los diálogos «Aa», «Buscar» y el visor de figuras,
responder una pregunta, comprobar un ejercicio, hacer y entregar un examen con su diálogo y los avisos de tiempo, montar
un circuito en el editor y en la protoboard, el multímetro, exportar y restaurar una copia de seguridad):

```sh
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.accesibilidad10.config.ts
```

`ACC_FILTRO=<expresión>` limita las rutas, `ACC_TEMAS=claro,oscuro` los temas y `ACC_INFORME=<fichero.json>` guarda
todo lo encontrado en vez de fallar (modo de auditoría).

## Simulador de circuitos

«Simulador» en la carril de iconos (`#/simulador`) abre el catálogo de las 309 netlists de ngspice que
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

### El circuito, dibujado

Encima de la netlist se ve siempre el **circuito**. Si el libro tiene una figura con ese esquema, es la figura
del libro; si no (la mayoría: unas 230 de las 313 netlists, además de «Nuevo circuito» y de cualquier netlist
que se edite), la aplicación **dibuja el esquema a partir de la netlist**, con el estilo de las figuras del
libro: resistencias rectangulares, bobinas de espiras, fuentes y transistores con círculo, masas de tres
rayas, alimentaciones (V<sub>CC</sub>, V<sub>DD</sub>, V<sub>EE</sub>…) como símbolos de carril, puntos de
unión, cada componente con su nombre y su valor (`R₁ 10 kΩ`, `C₁ 100 nF`, `V₁ ∿ 1 V · 1 kHz`). La señal va de
izquierda a derecha, las fuentes quedan a la izquierda y de pie, las masas abajo, y los nombres de los nodos
(los de `v(out)`, `v(b)`… de las gráficas) aparecen en pequeño junto a sus cables. Los amplificadores
operacionales de subcircuito se dibujan como triángulos, los puentes de diodos como el rombo clásico, las
bobinas acopladas (`K`) como transformador, las puertas lógicas como cajas IEC (&, ≥1, =1, 1) y los demás
subcircuitos como cajas con el nombre de cada patilla; «Ver el interior de …» dibuja por dentro cualquier
subcircuito de la netlist. Si una netlist trae varios circuitos independientes (variantes de un mismo
ejemplo), se dibujan uno junto a otro.

Algunos circuitos que el libro siempre dibuja igual se reconocen por su estructura (no por el nombre de las
piezas) y se dibujan en su forma de libro: el **puente en H** como la H clásica, con la alimentación arriba, la
carga en el travesaño y cada diodo de libre circulación junto a su interruptor; los **convertidores reductor y
elevador** con interruptor, diodo (o interruptor síncrono) y bobina en fila en su orden canónico, el interruptor
a masa colgando del nodo de conmutación, la entrada a la izquierda y el condensador de salida y la carga a la
derecha; el **oscilador en puente de Wien** con la red RC serie por encima del operacional, la RC paralelo a la
izquierda de la entrada + y la red de ganancia bajo la entrada −; los **reguladores** con la entrada a la
izquierda, el elemento de paso (transistor tumbado) en el camino serie, el amplificador de error, la referencia,
el Zener, el Darlington y el transistor limitador debajo, y la carga a la derecha (los ajustables tipo LM317 con
el divisor de realimentación en vertical); y los **circuitos lógicos** grandes (contadores y decodificadores)
de izquierda a derecha por profundidad lógica, cada contador en su fila, el reloj y las salidas que van lejos
con etiquetas de red y los enlaces entre columnas vecinas como cables rectos. Los **rectificadores** se dibujan
en su forma de libro: la fuente de alterna de pie a la izquierda, el puente como el rombo clásico (alterna
arriba y abajo, + a la derecha, − a la izquierda), el diodo de media onda o los dos de toma media en fila, y el
condensador de filtro y la carga colgando del + a la derecha; si el − del puente no va a masa, se une con una
etiqueta de red (sin ella, un cruce sería inevitable). Una netlist hecha de varios rectificadores
independientes (las variantes de un mismo ejemplo) se dibuja en una rejilla de celdas iguales, en el orden de
la netlist. Las **escaleras de celdas en paralelo** (varias resistencias, condensadores o bobinas entre los mismos
dos nodos, celdas unidas en serie) se dibujan como en el libro: la asociación de condensadores en serie con sus
resistencias de fuga y de equilibrado (figura 3.12) o la sonda compensada, como columnas apiladas con la masa
abajo; la red térmica de Foster (figura 47.8), como una fila de celdas con R arriba y C debajo y la última celda
colgando a masa. Un valor escrito como expresión constante (`{30e-6/0.058737}`) se rotula con su valor
(`511 µF`); si lleva parámetros, se deja como está.

Los nombres y valores de las piezas nunca quedan encima de un cable ni pegados a él: si un cable pasa a menos de
0,15 unidades (unos 4 px a la escala del libro), el rótulo se mueve al sitio libre más cercano alrededor del
símbolo (al lado, encima o debajo, o partido en dos líneas, «C₁ 11,1 pF» → «C₁» / «11,1 pF»). Un circuito nuevo
o editado se dibuja en unas decenas de milisegundos (los más grandes, en unos 0,1 s desde la 0.8, la mitad que
antes, con exactamente el mismo dibujo); al mover solo un valor, el dibujo no cambia y sale al instante. Al añadir
o quitar una pieza, el dibujo nuevo parte del anterior (las piezas que siguen ahí, en su sitio; la nueva, junto a
sus vecinas) y, si sale limpio, se queda: es más rápido que dibujarlo de cero y se reconoce el circuito.

Sobre el dibujo se ven las tensiones y corrientes de la última simulación (colores de los nodos y puntos
que se mueven por los cables). Al cambiar un valor con su control deslizante el dibujo no se mueve; al
añadir o quitar componentes en la netlist se vuelve a dibujar a los pocos instantes. Las netlists que no se
pueden simular aquí (XSPICE) también se dibujan, con zoom: botones + y −, `Ctrl` + rueda o pellizco,
arrastrar para desplazar cuando está ampliado, `0` para ajustar. **Pulsar un componente** del dibujo lleva a
su control deslizante (lo muestra resaltado).

El motor es **ngspice 45.2 con XSPICE** compilado a WebAssembly para esta aplicación
(`web/scripts/ngspice-wasm/`, ver «Desarrollo»; ngspice tiene licencia BSD), que se ejecuta en un *Web
Worker*: la interfaz no se bloquea, se ve el progreso y una simulación se puede detener. Se descarga solo al
abrir el simulador (6,5 MB, 2,1 MB comprimido; el arranque del lector no cambia). Hasta la 0.7 el motor era
el del paquete npm `eecircuit-engine` 1.8.0 (MIT), sin XSPICE; en la 0.8 se conserva como motor de reserva
(`src/simulador/motor/motores.ts`): se usa si el nuevo no se puede cargar, o en un dispositivo concreto
guardando `eecircuit` en la clave `epa:motor-spice` de `localStorage`.

- **Puertas digitales (XSPICE).** Las 4 netlists del capítulo 28 del libro impreso (carpeta `cap29`) usan
  puertas, biestables y puentes ADC/DAC de XSPICE y se simulan como en ngspice nativo, con los valores que da
  el libro. Cada una tiene además en el material complementario una versión analógica equivalente
  (`…_analogica.cir`: puertas como fuentes de comportamiento con umbral de 2,5 V, retardos exactos y
  biestables maestro-esclavo) con las mismas medidas, interesante para ver qué hay dentro de una puerta: la
  página de la original enlaza con ella («Ver la versión analógica») y viceversa. Con el motor de reserva, las
  originales no se pueden simular y la página lo explica.
- Solo 3 netlists dan errores, y a propósito: los ejemplos de errores de la figura 42.6 y la última medida del
  problema 29.C (el contador B no da un tercer pulso, como explica su cabecera).
- **Unas 9 son pesadas** (más de 8 s en un ordenador): no se ejecutan solas al abrirlas, y la página avisa.
- La aplicación usa el resolvedor SPARSE de ngspice, que da los mismos números que ngspice nativo; si un
  transitorio no converge («Timestep too small») repite la simulación con KLU y lo indica.
- `plot`, `quit` y similares del bloque `.control` se ignoran (la aplicación dibuja las gráficas).

## Editor de esquemas

La tercera pestaña del simulador, «Editor de esquemas» (`#/editor`), dibuja un circuito con los símbolos del
libro y lo simula sin escribir la netlist. También abre como dibujo editable cualquier netlist: el botón
**«Editar el esquema»** de la página de cada netlist del libro (o de la netlist libre) la dibuja con el mismo
trazado automático y la deja lista para cambiarla; la vuelta es **«Ver como netlist»**, que abre la netlist
generada en el simulador de texto.

- **Fuentes de control (1.1).** Una fuente cuyo nodo solo lo lee una fuente controlada (los nodos de control de E y G,
  también con `POLY(n)`) o una expresión (`V(a)`, `V(a,b)` de una fuente B o de `VALUE=`) ya no aparece con un
  terminal suelto ni con el aviso «un terminal no está conectado a nada»: el dibujo le pone una etiqueta de red con el
  nombre del nodo. La netlist que genera es la misma (comprobado con las 313 del libro).
- **Paleta** con buscador: resistencia, potenciómetro, condensador, bobina, transformador, cristal, interruptores y relé, sensores y cargas (0.10, abajo), fuentes
  de tensión y de corriente (continua, senoidal, pulsos, por tramos o texto SPICE; una de alterna con fase, como las
  trifásicas de las ampliaciones, se rotula «AC 231 V ∠−120°» y no con su texto SPICE: revisión 11c), fuentes controladas E y G,
  diodo, Zener, LED, Schottky, transistores NPN y PNP, MOSFET N y P, JFET N y P, operacional (con o sin
  patillas de alimentación), temporizador 555 (0.10, un modelo de comportamiento), masa, alimentación, etiqueta de red, sonda de tensión, voltímetro entre dos
  puntos y amperímetro. Un toque en la paleta y otro en el lienzo coloca la pieza; también se puede arrastrar.
- **Digital (XSPICE)**: puertas AND, OR, NAND, NOR y XOR de dos entradas e inversor, con su retardo; biestables
  D y JK (reloj por flanco de subida, S y R opcionales, estado inicial); puente analógico → digital (con sus
  umbrales del 0 y del 1), puente digital → analógico (niveles y flancos) y reloj digital (frecuencia y ciclo
  de trabajo). Las redes digitales no tienen tensión: una señal analógica entra por un puente ADC y, para ver
  o medir una salida, se pasa por un puente DAC (una sonda puesta en una red digital se señala como error).
- **Modelos** de las netlists del libro en una lista: 1N4148, 1N4007, Schottky, LED rojo y verde, Zener de
  5,1, 5,6 y 12 V, 2N3904, 2N3906, NPN y PNP de potencia, MOSFET de nivel 1, JFET y el operacional del libro
  (A₀ = 10⁵, polo de 10 Hz, ±14 V), un tipo 741 y uno con raíles. Los modelos definidos en las directivas
  también se pueden elegir.
- **Cables**: se arrastra desde una patilla (sale recto y dobla en L) o, con la herramienta Cable, se toca punto
  a punto. Un cable que termina sobre otro lo une con un punto; dos cables que se cruzan no se unen. Las
  patillas sin conectar se marcan con un círculo.
- **Propiedades** de la pieza elegida con los valores como se escriben en el libro: «4,7k», «4k7», «100n»,
  «2,2M» (M es mega), «1µ», «{expresión}»; cada campo se comprueba al escribir y explica el error en español.
- **Análisis**: punto de trabajo, transitorio, alterna y barrido de continua, con sus parámetros; «Simular»
  usa el mismo motor del simulador. Antes de simular se avisa de lo que falta (la masa, un valor, un modelo,
  un nombre repetido, una patilla suelta).
- **Resultados en el esquema**: tras simular se ven las tensiones de cada nodo y la corriente de cada
  componente escritas sobre el dibujo, los cables coloreados por su tensión y, en un transitorio, la
  corriente animada, con la reproducción y las fichas de las figuras vivas. Las sondas eligen las curvas de
  las gráficas, que son las del simulador (cursores, zoom, tabla).
- **Mis circuitos**: «Guardar» los deja en el dispositivo; desde entonces cada cambio se guarda solo. Se
  pueden abrir, renombrar y borrar. El dibujo sin guardar se conserva como borrador.
- **Exportar** la netlist (`.cir`) o el dibujo (SVG con las fuentes del libro dentro) e **importar** un `.cir`.
- **Netlist generada** (de solo lectura, con «Copiar») y **directivas SPICE** (modelos, subcircuitos,
  `.param`, `.meas`, `.control`), que se copian tal cual al final de la netlist. Una netlist del libro abierta
  como dibujo conserva en ellas todo lo que no es un componente dibujado, y da exactamente los mismos
  resultados que su texto.

| Gesto o tecla | Acción |
|---|---|
| Arrastrar una pieza (ratón o dedo) | Moverla (los cables conectados la siguen) |
| Arrastrar en vacío con el ratón · con un dedo | Seleccionar con un recuadro · desplazar |
| Rueda | Desplazar la página, como en el resto de la aplicación |
| `Ctrl` + rueda, pellizco (pantalla o panel táctil) | Acercar y alejar (solo el dibujo, nunca la página) |
| `Mayús` + rueda, deslizar de lado en el panel táctil | Desplazar el dibujo en horizontal |
| Botón central, `Espacio` + arrastrar | Desplazar el dibujo |
| Pulsación larga (táctil), botón derecho | Menú de la pieza |
| Doble toque o doble clic | Propiedades |
| `R` · `X` · `Supr` | Girar 90° · reflejar · borrar |
| `Ctrl Z` · `Ctrl Y` | Deshacer · rehacer |
| `Ctrl C` `Ctrl X` `Ctrl V` `Ctrl D` `Ctrl A` | Copiar, cortar, pegar, duplicar, seleccionar todo |
| `W` · `S` · `G` · `F` · `Esc` | Cable · seleccionar · masa · ver todo · cancelar |
| `A` | Ruta automática (toque dos patillas) |

### Novedades del editor en la 0.10

- **Interruptores**: interruptor (SPST), conmutador de dos posiciones (SPDT), pulsador normalmente abierto y
  normalmente cerrado, y relé con su bobina y un contacto conmutado (modelos de 5, 12 y 24 V: la bobina con su
  resistencia e inductancia; el contacto NA se cierra al pasar del 70 % de la corriente nominal y vuelve al NC
  por debajo del 37 %). El símbolo dibuja el estado: abierto o cerrado, pulsado o no, posición 1 o 2.
- **Transformador** de la paleta definido por su **relación de espiras** (10 para 10 : 1, con la inductancia
  del primario y el acoplamiento) o por sus inductancias, con **toma central** opcional. Las netlists del libro
  con transformadores (bobinas y sus líneas K) y con puentes de diodos se abren ahora como estas piezas
  (conservan los nombres de sus líneas) y dan las mismas medidas que su texto. Un puente escrito como
  subcircuito también, salvo si la netlist mira dentro de él (por ejemplo `@d.xb1.d1[id]`).
- **Sensores y cargas**: fotorresistencia (LDR, con la iluminación en lux), termistores NTC y PTC (con la
  temperatura), bombilla (filamento que en frío tiene la décima parte de su resistencia), zumbador activo,
  altavoz (bobina móvil y resonancia) y motor de continua (inducido, fuerza contraelectromotriz, inercia,
  rozamiento y par de carga; la velocidad en rad/s es la tensión de su nodo interno «w»).
- **Puente rectificador** y **cristal de cuarzo** (modelo de Butterworth–Van Dyke) en la paleta.
- **Mientras se simula**: en el esquema de resultados los interruptores y pulsadores llevan un recuadro
  naranja; un toque los cambia y el punto de trabajo se recalcula al momento (valores sobre el dibujo), y
  después el resto de la simulación. Debajo, **Mandos**: potenciómetros, luz de las LDR, temperatura de los
  termistores y valor de las fuentes con un deslizador; al moverlo cambian al momento las tensiones del
  dibujo, y al soltarlo se repiten el transitorio y las gráficas. En «Propiedades» esos valores también
  tienen su mando, y en la protoboard funcionan igual (un doble toque conmuta un interruptor o un pulsador).
- **Barrido de un valor** (como `.step`, que ngspice no tiene en modo por lotes): se elige un componente, su
  valor y una lista («1k; 2,2k; 4,7k») o un rango (lineal o logarítmico, hasta 8 valores); el circuito se
  simula una vez por valor y las gráficas muestran una curva por valor con su leyenda («v(out) · R1 = 2,2
  kΩ»); el punto de trabajo, una columna por valor.
- **Ordenar**: alinear (bordes o centros) y repartir la selección; **«Ordenar el esquema»** vuelve a colocar y
  cablear todo con el trazado automático de los esquemas del libro (sin cambiar ninguna conexión: si no lo
  consigue, avisa y no toca nada; «Deshacer» lo devuelve); y **ruta automática** entre dos patillas, con cables
  en ángulo recto que rodean los componentes y no tocan otras redes.
- **Notas de texto** en el esquema: se mueven como un componente, se editan en «Propiedades» (varias líneas),
  se guardan con el circuito y salen en el SVG exportado.
- **Revisión eléctrica** antes de simular, explicada en español: nodos sin camino de continua a masa, fuentes
  de tensión en paralelo o en cortocircuito (y lazos con bobinas), fuentes de corriente en serie o en circuito
  abierto, entradas de operacionales o de puertas al aire y componentes con todas sus patillas en el mismo
  nodo. «Señalar en el esquema» elige los componentes; si hay errores, «Simular» se detiene y ofrece
  «Simular de todos modos».
- **Ayuda cuando ngspice no converge**: explica las causas habituales y ofrece arreglos (más iteraciones con
  gmin y source stepping, transitorio con condiciones iniciales, una resistencia de 1 mΩ en serie con bobinas y
  fuentes, una resistencia de 1 TΩ de cada nodo a masa, integración de Gear); cada uno crea una copia del
  circuito en «Mis circuitos» y la simula, sin tocar el original.

## Protoboard (0.10)

Una protoboard virtual para montar los circuitos como en el laboratorio: cada pieza se dibuja como es (la
resistencia con sus bandas de colores, el LED con la pata larga y el lado plano, el electrolítico con la franja
del negativo, los transistores TO-92 y TO-220 con su patillaje según el modelo, los integrados DIP a caballo
del canal central, el trimmer, el conmutador deslizante) y la fuente de alimentación, el generador de funciones
o la fuente de corriente quedan encima de la placa con sus puntas enchufadas en los carriles o en las tiras.
Desde la 0.10 también el pulsador de 6 × 6 mm, el relé (cápsula azul con B1, B2, C, NC y NA), el transformador
(núcleo de chapas y bobinado), el motor, la bombilla en su portalámparas (se enciende con su tensión), el
zumbador, el altavoz, la LDR, los termistores, el cristal HC-49 y el puente en línea; un doble toque conmuta un
interruptor o un conmutador y pulsa o suelta un pulsador. El paso del tutor de «Medir» va en una barra encima
de la mesa, sin tapar la fuente ni los instrumentos.

**Rediseño de la 0.11** (montar sin ayuda un LED con su resistencia en menos de un minuto):

- **Bandeja de piezas** siempre a la vista (debajo de la placa en la tableta y el teléfono, en una columna a la
  izquierda en pantallas anchas), con tarjetas grandes de cada pieza dibujada como es, su nombre y su valor
  (resistencia, LED rojo y verde, pulsador, condensador, electrolítico, transistores NPN y PNP, potenciómetro,
  diodo, interruptor, LDR, zumbador, 555, operacional, puertas NAND, fuente) y «Más piezas» con la paleta
  completa. Se arrastra una tarjeta a la placa: mientras se arrastra, un fantasma de la pieza enseña los
  agujeros exactos donde caerán sus patas y sus tiras, en verde si cabe y en rojo, con el motivo, si chocaría
  con otra pieza, cae en un agujero ocupado o la tira la dejaría en cortocircuito (dos patas en la misma
  tira); al soltar en rojo no se pone. También se puede tocar la tarjeta y luego tocar la placa.
- **Barra flotante** junto a la pieza elegida: Girar, Voltear, su valor (valores comunes de la serie E12 en
  fichas, ‹ › para el anterior y el siguiente de la serie, o escrito; las bandas de la resistencia cambian al
  momento), Pulsar o Conmutar, Más (todas las propiedades) y Quitar. En un cable: Color y Quitar.
- **Cables sin herramienta**: un toque en un agujero libre empieza el cable (se ilumina su tira) y un toque en
  otro lo acaba; o se arrastra de uno a otro y el cable sigue al dedo, con las dos tiras iluminadas. Se pintan
  por encima de las piezas y con una zona de toque ancha; su color sale de lo que llevan (rojo al +, negro a
  masa, los demás variados) y se cambia en la barra; un extremo se arrastra a otro agujero sin elegirlo
  antes, y una pulsación larga lo quita (con «Deshacer»). Dos dedos desplazan y acercan; «+», «−» y «Ver
  todo» están en la esquina de la mesa.
- **Botones con nombre** siempre en el mismo sitio: Deshacer, Rehacer, Nombres, «Monta este circuito» y
  Simular/Detener. Los paneles (Piezas, Esquema, Resultados, Avisos, Pieza, Medir) van en pestañas bajo la
  placa (en el teléfono, al abrir uno se pliega la bandeja), así la placa queda grande; en el teléfono se ve
  de entrada con agujeros del tamaño de un dedo (las 18 primeras columnas; «Ver todo» enseña el resto).
- **«Monta este circuito»**, al estilo de Brilliant: «0 · La protoboard por dentro» y cinco montajes de serie
  (LED y resistencia, divisor de tensión, LED con pulsador, transistor como interruptor y 555 astable) y, desde
  «Ver en protoboard», el propio circuito del esquema. Paso a paso: la tarjeta de arriba dice qué poner y
  dónde (los agujeros brillan y la silueta de la pieza espera en su sitio), la bandeja tiene solo las piezas
  que faltan, cada paso se comprueba por las tiras (no por el agujero exacto) y, al acertar, una frase dice por
  qué va ahí (del libro, con su sección, cuando la hay); un paso mal se explica («D1 está al revés: la pata
  larga va en la columna 14…», «Ese cable une … ; este paso pide unir …») con su arreglo (Voltear, Quitarlo).
  «Hazlo por mí» hace el paso; el último es simular, y cuando el LED se enciende (o sale la tensión del
  divisor) lo celebra. Al salir vuelve la placa de antes.
- **La protoboard por dentro**, la primera vez que se usa la guía (se puede saltar; no vuelve): tocar un
  agujero ilumina todo lo que está unido a él (su tira de cinco, o el carril entero); una idea por pantalla
  (las tiras a–e y f–j, el canal central y por qué los DIP van a caballo, los carriles + y −) y cuatro
  preguntas con segundo intento («¿Están unidos los agujeros a10 y f10?», «Toque un agujero unido a c23») cuyas
  respuestas salen del propio modelo de la placa. Termina con «Siguiente: LED y resistencia».
- **Primera vez**: un recorrido de tres tarjetas (la bandeja, los cables, Simular) que no tapa la placa y
  no vuelve a salir; en una placa vacía, «Arrastre aquí una pieza desde la bandeja».

**«Ver en protoboard»** aparece en todo esquema que tiene un circuito real detrás:

- bajo las figuras del libro que comprueba alguna netlist (como «Simular»; si son varias, un menú) y bajo las
  que tienen un esquema simulable en sus datos; no en las figuras que son solo dibujos (diagramas de bloques,
  esquemas sin valores o sin fuentes, fotos) ni en las consolas;
- en la página de cada netlist del simulador (y en la netlist libre), con la netlist tal como esté (deslizadores
  y cambios incluidos);
- en el editor de esquemas, con el dibujo tal como esté.

Se abre a pantalla completa con el circuito ya montado: piezas colocadas, cables entre las tiras de cada red,
la alimentación y la masa en los carriles. Es una prueba: se puede cambiar todo y simularlo, y al cerrar (la X
o «Atrás») el esquema de partida queda exactamente como estaba. «Guardar como montaje propio» guarda una copia
en «Mis montajes».

- **Mover**: arrastrar una pieza la lleva a otros agujeros (en rojo donde no cabe: un agujero ocupado, una
  pata bajo otra pieza, dos cuerpos uno encima de otro). En las piezas de dos patas y en los cables, al
  elegirlos aparecen asas en las patas o los extremos: arrastrándolas se enchufan en otro agujero (las patas
  se doblan). Los cables no siguen a las piezas: como en una protoboard de verdad, mover una pieza cambia el
  circuito.
- **Girar** (90°) y **Voltear** (invierte las patas: el LED o el diodo al revés, el transistor girado, el
  integrado con la muesca al otro lado), en la barra flotante de la pieza. **Conmutar** cambia el interruptor
  (también con doble toque).
- **Cable**: toque un agujero libre (o un borne de la fuente) y luego otro, o arrastre de uno a otro.
- **Más piezas**: la paleta del editor de esquemas; la pieza aparece en un hueco libre a la vista y luego se
  arrastra a su sitio. Las fuentes y los generadores van encima de la placa: sus puntas se llevan tocando el
  borne y luego un agujero.
- **Pieza**: las propiedades del editor (nombre, valor, modelo, forma de onda…). Cambiar el modelo de un
  transistor cambia su patillaje (un BC547 tiene el colector donde un 2N3904 tiene el emisor); cambiar el valor
  de un condensador puede convertirlo en electrolítico.
- **Esquema**: el esquema que sale de lo montado, dibujado al momento con el trazado automático (o la figura del
  libro mientras el montaje coincide con ella): cambia con cada pieza y cada cable. Tocar una pieza en el
  esquema la elige en la protoboard.
- **Simulación**: «Simular» ejecuta el circuito montado con los análisis del original y muestra las gráficas y
  medidas del simulador; el esquema enseña tensiones y corrientes. Desde entonces cada cambio recalcula el punto
  de trabajo: los LED se encienden y, al tocar un agujero, se ve su tensión. Los errores de montaje también se
  simulan: así se ve qué pasa.
- **Avisos**, sin bloquear nada: cortocircuito entre los bornes de una fuente, una pieza cortocircuitada por su
  propia tira, LED, diodo o electrolítico al revés (respecto al esquema y por las tensiones), transistor o
  integrado girados, patilla de un integrado al aire, puntas que no llegan, dos patas en un agujero, y si el
  montaje corresponde al esquema original o qué red está partida o unida.
- Tocar un agujero marca su tira y todo lo unido a ella, con el nombre de la red y, tras simular, su tensión.

**Puertas lógicas en chips 74HC reales.** Las puertas y biestables de un circuito (los de las netlists
digitales del libro, escritas con XSPICE; los subcircuitos de sus versiones analógicas; las piezas «Digital» del
editor) se montan agrupados por tipo en chips DIP de la serie 74HC con su patillaje real: 74HC00 (NAND), 74HC02
(NOR), 74HC04 (inversores), 74HC08 (AND), 74HC32 (OR), 74HC86 (XOR), 74HC10, 74HC11 y 74HC27 (de tres entradas),
74HC20 y 74HC21 (de cuatro), 74HC30 (NAND de ocho), 74HC4078 (OR de ocho en la patilla 1 y NOR en la 13),
74HC74 (dos biestables D) y 74HC112 (dos JK). Un biestable T se monta con uno de los D del 74HC74 y una XOR del
74HC86 cableadas como D = T ⊕ Q (la XOR recibe T y Q, y su salida va a D): cambia en el flanco de subida, como el
del libro, así que el contador asíncrono cuenta hacia arriba también con chips reales. El chip lleva su nombre impreso; la patilla 14 (Vcc)
va al carril rojo y la 7 (GND) al azul (16 y 8 en el 74HC112), con una fuente de 5 V propia si el circuito no
tiene una de entre 2 y 6 V; las entradas que el circuito no usa se atan con un cable a un carril (a + en una AND
o NAND, a − en las demás; PRE y CLR de los biestables a +, inactivas). La simulación no cambia: sigue usando los
modelos digitales de XSPICE, y esos cables de atar no están en la netlist. «Pieza» enseña el patillaje del chip
(qué puerta lleva cada patilla, cuáles están libres) y deja elegir la puerta cuyas propiedades se editan. Si se
quita uno de esos cables, «Avisos» dice qué entrada CMOS ha quedado al aire, y también si el chip no tiene Vcc o
masa, o si falta uno de los cables de un biestable T (de la salida de la XOR a D, o de Q a la XOR). Una puerta
añadida desde «Añadir» llega en su chip, con lo demás por cablear. Diferencias con el chip real que se indican en
su descripción: el 74HC112 cambia en el flanco de bajada y PRE y CLR son activas a nivel bajo. Lo que no tiene pieza real (los puentes ADC/DAC,
el reloj digital, el decodificador del modelo analógico) sigue siendo un módulo.

**Medir en la protoboard** (pestaña «Medir», o el botón del velocímetro). Los mismos Brymen BM869s y FNIRSI
2C53T del banco de pruebas (ver «Instrumentos»), fieles a los de verdad, se usan como en el laboratorio: se gira
el selector, se pasa la punta roja al borne que toca (COM, ΩV, mA µA, A), se elige una punta o sonda y se toca un
agujero (o una pata, o un borne de la fuente): queda enchufada allí y mide la red de esa tira. Las puntas puestas
se arrastran a otro agujero, que marca su red al pasar. Lo que hay: las dos puntas de cada multímetro, las sondas
CH1 y CH2 con su pinza de masa, las dos puntas del generador del FNIRSI (añaden una fuente entre sus redes,
movida por el DDS) y un auricular. «Alimentación encendida» conecta o quita la fuente, como al desenchufarla; al
encenderla las fuentes suben desde cero, así que un oscilador como el 555 arranca como en la realidad.

- **¿Qué quieres medir?** es un tutor, no un piloto automático: tensión entre dos puntos, tensión de una pieza,
  corriente por una pieza, resistencia de una pieza, ver la señal en un punto y escucharlo. Dice paso a paso lo
  que se haría con el instrumento real («Gire el selector a A mA», «Pase la punta roja al borne mA µA», «Abra el
  circuito: arrastre una pata de R2 a una tira libre», «La punta roja en la tira de donde ha salido la pata»…),
  ilumina la posición del selector, el borne, el botón o los agujeros donde va cada cosa, marca cada paso cuando se
  hace y al final explica en una línea lo que marca el instrumento («El Brymen marca 6,000 V: la tensión en R2, de
  la pata 1 de R2 a masa»). «Hazlo por mí» solo existe como último recurso: hace los pasos que faltan uno a uno, a
  la vista.
- **Errores explicados** como lo haría un profesor, con qué hacer en su lugar: la punta roja en un borne de
  corriente con el selector en tensión (InErr y pitido), un amperímetro en paralelo (se funde el fusible: por qué, y
  «Ponerlo en serie»), resistencia con el circuito alimentado («Medir sin alimentación»), OL (rango manual o fuera
  de escala), sonda y canal con distinto ×1/×10, nivel de disparo fuera de la señal (la imagen no se queda quieta).
- El **AUTO** del FNIRSI busca la frecuencia en la señal (ensancha la base de tiempos hasta ver periodos enteros)
  y elige V/div y disparo; PRM muestra frecuencia, periodo, Vpp y media en la pantalla.
- **Escuchar**: el auricular (o una sonda del osciloscopio) en un punto y «Escuchar»: la señal de ese punto por el
  altavoz, sin continua, con un limitador suave y su volumen (0 dB: 1 V de pico llena el limitador). Solo suena lo
  que está en la banda audible; para una señal lenta explica por qué no se oye (y ofrece sus chasquidos) y para una
  de radio, por qué tampoco (y su envolvente, si cambia). Empieza solo al tocar un botón (Android) y se calla al
  salir.
- Una pista la primera vez (se cierra y no vuelve) y un «?» bajo cada instrumento con lo esencial de su manejo.

El editor de esquemas tiene **«Medir»**: abre el banco de pruebas con su netlist y su propio dibujo, cuyos nodos
reciben las puntas (y el auricular), con «← Editor» de vuelta. Para el tutor, «Ver en protoboard» y «Medir».

La pestaña **«Protoboard»** del simulador (`#/protoboard`), que también está en el menú de herramientas (el
carril de iconos o «Más»), parte de una placa vacía con la fuente de 5 V ya
conectada a los carriles; «Guardar» la deja en **Mis montajes** (cada cambio se guarda solo desde entonces) y
se sincroniza entre dispositivos como los circuitos del editor.

| Gesto o tecla | Acción |
|---|---|
| Tocar o hacer clic | Elegir una pieza o un cable; en un agujero libre, empezar (o acabar) un cable y ver su tira y su red |
| Arrastrar una pieza, una asa, un extremo | Moverla · enchufar esa pata o ese extremo en otro agujero |
| Arrastrar desde un agujero libre | Tender un cable hasta donde se suelte |
| Pulsación larga en un cable | Quitarlo |
| Arrastrar fuera de los agujeros · dos dedos | Desplazar · acercar y alejar (nunca la página) |
| `Ctrl` + rueda · `Mayús` + rueda | Acercar y alejar · desplazar en horizontal |
| `R` · `F` · `Supr` · `W` | Girar · voltear · quitar · herramienta Cable (opcional: un toque en un agujero ya empieza un cable) |
| `Ctrl Z` · `Ctrl Y` · `0` · `Esc` | Deshacer · rehacer · ver todo · cancelar |

Límites: una placa de 400 puntos para los circuitos pequeños y hasta cuatro de 830 para los grandes. Lo que no
es una pieza real (fuentes controladas, subcircuitos que no son operacionales, un 555 ni una puerta, puentes
y relojes XSPICE, interruptores controlados, líneas de transmisión) se monta como un **módulo**, una placa pequeña con sus
patillas en una tira. Los operacionales ideales del libro no usan su alimentación: sus patillas 4 y 7 se
conectan a los carriles cuando hay fuente simétrica, y si no se avisa de que en un montaje real hacen falta.
Los proyectos KiCad no tienen «Ver en protoboard» (ver ESQUEMA.md); las etapas que el libro simula (fuente,
preamplificador, etapa de salida…) sí lo tienen desde sus figuras y netlists.

## Componentes animados

«Componentes animados» en el carril de iconos (`#/componentes`) abre una galería de 39 animaciones agrupadas
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
  `node tests/animaciones-hz.mjs` comprueba que nada avanza por fotograma (144 Hz simulados);
  `tests/escenas-textos.spec.ts` comprueba que ninguna etiqueta pisa a otra en ninguna escena ni pestaña (de esta
  colección y de la de conceptos), en móvil, tableta vertical y escritorio, con la letra de la aplicación y con una
  de reserva más ancha (la que usaría Android si aún no ha cargado la suya).

## Conceptos animados

«Conceptos animados» en el carril de iconos o en la portada (`#/conceptos`) abre una galería de 34 animaciones de
las ideas que una figura fija explica mal, agrupadas en siete áreas, con la misma búsqueda (por nombre, idea o
número de sección: «Nyquist», «23.6», «Bode»). Cada página tiene la escena, controles con sus unidades, lecturas
con coma decimal y prefijos SI, la explicación con los números del momento y los enlaces «En el libro»; en el
libro, esas secciones y figuras llevan el botón «Ver animación» (o «Ver animaciones» con un menú, si también
tienen animación de componente), y «Volver» regresa al punto de lectura.

- **Campos, leyes y teoremas**: campo eléctrico y potencial (cargas y placas que se arrastran, una carga de
  prueba que cae de potencial), campo magnético e inducción (imán y bobina, Faraday y Lenz; campo de un hilo),
  Kirchhoff en dos mallas (el «caminante» que recorre un lazo y dibuja el potencial; ejemplos de 0.2 y 22.4),
  Thévenin y Norton (la red de la figura 22.6 y sus dos equivalentes con la misma carga), superposición (con
  el diodo que la rompe) y máxima transferencia de potencia.
- **Alterna**: fasores que giran (suma de senoides, derivar = ×jω), impedancia y tensiones en cuadratura,
  transitorio RLC (respuesta natural y forzada, energía, polos en el plano s), resonancia y Q (serie y tanque,
  la emisora a 9 kHz), potencia activa, reactiva y aparente con la corrección del factor de potencia (y el
  rectificador que no se deja corregir).
- **Señales**: series de Fourier con fasores giratorios y Gibbs, la FFT con su fuga y sus ventanas (THD del
  libro), muestreo y aliasing (700 Hz a 1 kHz), cuantificación y dither, modulación AM/FM con su espectro
  (Bessel, Carson) y el superheterodino del FM7303 (oscilador local, FI de 10,7 MHz, imagen).
- **Analógica**: realimentación y ganancia por ancho de banda, margen de fase (el seguidor de 52°), Bode
  construido con polos y ceros que se arrastran, oscilador de Wien que arranca desde el ruido (recorte, diodos o
  lámpara, con su THD), ruido y suma en cuadratura, control PID de un horno con retardo y windup.
- **Potencia**: fuente lineal (el rectificador y el condensador se **simulan con ngspice**, con la netlist del
  libro; rizado, pulsos de corriente, caída mínima y disipación del regulador), conmutadas buck, boost y
  buck-boost en cámara lenta (modo continuo y discontinuo) y PWM con su filtro RC.
- **Digital**: niveles lógicos y márgenes de ruido (3,3 V contra HC y HCT), retardo de propagación y glitches
  (con un contador que los cuenta), metaestabilidad y el MTBF del problema 28.B.
- **Alta frecuencia**: reflexiones en un metro de coaxial (lo que ve el osciloscopio en cada extremo), onda
  estacionaria con la carta de Smith, redes de adaptación en L sobre la carta, antenas (dipolo, diagrama y
  resistencia de radiación) y efecto pelicular (solución exacta con funciones de Bessel).

Todo se calcula en el momento (fórmulas del libro, integración numérica, FFT, simulación por eventos o
ngspice), no son vídeos. Las escenas siguen las reglas de rendimiento de las animaciones de componentes:
avanzan con el tiempo real, se paran fuera de pantalla, con la ventana oculta y con «reducir movimiento», y su
parte fija se dibuja una sola vez en caché. Algunas se manipulan directamente en el lienzo: arrastrar polos y
ceros en el Bode, cargas y la carga de prueba en el campo eléctrico, el imán, el punto de observación de la
onda estacionaria. Pruebas: `tests/conceptos.spec.ts`; capturas y hojas de contacto con
`node tests/conceptos-capturas.mjs` (en `tests/capturas/conceptos/`); `tests/animaciones.mjs` y
`tests/animaciones-hz.mjs` incluyen las escenas de conceptos (`--coleccion conceptos` para medir solo estas).
Medido con la CPU 4 veces más lenta: el paso más el dibujo cuestan de media entre 1 y 4,3 ms por fotograma en
los perfiles de Mac, tableta y móvil (unos 2 ms de media global), muy por debajo de los 16,7 ms de 60 Hz.

## Componentes en 3D

En «Componentes» (carril de iconos) y en cada animación de componente hay un interruptor **Animación | Pieza 3D**
(«2D | 3D» hasta la 0.7.0): «Animación» es la animación de siempre, que a menudo es un circuito y no un dibujo de
la pieza; «Pieza 3D» es el componente físico, en tres dimensiones, generado con sus medidas reales (milímetros
de la norma del encapsulado) y con lo que cuenta el libro de su construcción. La elección se recuerda en el
dispositivo: si se deja en 3D, la galería pasa a ser el **catálogo de modelos** y las animaciones se abren en 3D.

- **39 modelos paramétricos** (sin ficheros de modelos: se generan en el momento): resistencia axial con sus
  bandas calculadas del valor (4 bandas E24 o 5 bandas E96), SMD con el código de tres o cuatro cifras o EIA-96,
  potenciómetro y trimmer, NTC/PTC/varistor y LDR; cerámico de disco, MLCC (0402–1210), película, electrolítico
  radial (el tamaño de la lata sale de C·V) y SMD, tántalo y supercondensador; bobina axial (colores en µH), de
  tambor, toroidal (con sus espiras contadas) y SMD apantallada, transformador EI y relé; diodos DO-41, DO-35 de
  vidrio, SOD-123, Zener y Schottky, LED de 5 mm y SMD, puente rectificador; TO-92, TO-220, SOT-23 y D-PAK; DIP,
  SOIC, LQFP y QFN (el 555, el LM358, el CD4069…), optoacoplador; cristal HC-49, fusible 5 × 20, PTC rearmable,
  tira de pines y borna de tornillo. Cada uno con su marcado legible y sus parámetros (valor, tamaño, color,
  patillas…).
- **Por dentro**: «Corte» quita la mitad del componente con un plano que se desplaza (y en varios se elige la
  orientación: longitudinal, transversal o desde arriba, como al decapar un integrado) y «Explosión» separa las
  piezas. Se ven la película y su corte helicoidal sobre el cilindro cerámico, los electrodos alternos de un MLCC,
  las láminas de ánodo y cátodo enrolladas con el papel de un electrolítico, el bobinado de una película, el dado y
  los hilos de oro de diodos, LED, transistores e integrados, el disco de cuarzo de un cristal… La cara cortada es
  plana, con las secciones de las piezas interiores dibujadas sobre ella (como en un corte real, no en
  profundidad). Las **etiquetas** nombran cada pieza con los términos del libro y llevan a su sección; con el
  corte activo apuntan a la cara cortada de su pieza.
- **Mandos**: arrastrar gira (un dedo en pantallas táctiles), `Ctrl` + rueda o pellizco acerca, `Mayús` + arrastrar
  o dos dedos desplazan; con el modelo activo, flechas, `+` `−` y `0` (vista inicial). En la página de una
  animación, sus propios controles mueven el modelo: el valor de la resistencia cambia las bandas, el material del
  LED su color, la capacidad del circuito RC el tamaño de la lata, el relé cierra sus contactos…
- En el libro, junto a las secciones y figuras sobre cómo está hecho un componente, aparece **«Ver en 3D»**.
- Si el dispositivo no tiene WebGL 2, las páginas siguen en 2D y lo indican. La vista 3D se descarga solo al
  abrirla (three.js en un fragmento aparte), dibuja únicamente cuando algo cambia y se para fuera de pantalla.
- Desde la 0.8, si la GPU no llega a 60 cuadros por segundo mientras se gira o se acerca un modelo (o una placa),
  la vista dibuja con menos píxeles mientras se mueve y vuelve a la resolución completa, con un último cuadro
  nítido, en cuanto se suelta; en un equipo que ya va sobrado (los Android) no cambia nada. Los sombreadores del
  modelo se compilan antes de su primer cuadro, en paralelo donde la GPU lo permite, con «Preparando el modelo
  3D…» mientras tanto, y sin el plano de corte hasta que se activa «Corte» (así sirven los mismos que ya compiló el
  catálogo; los del corte se preparan en segundo plano).
- Desde la 0.12 el «entorno» del estudio (la sala cuyos reflejos hacen que el estaño, el cobre y el oro parezcan
  metal) se calcula una sola vez en cada dispositivo y se guarda: hasta la 0.11 cada vista 3D (cada modelo, cada
  placa, cada miniatura) lo volvía a calcular, con tres o cuatro sombreadores más que compilar al abrirla (ver
  «Proyectos KiCad»). Se ve exactamente igual.
- En pantallas estrechas las etiquetas pasan a ser números sobre el modelo con su lista debajo (si dos caen
  juntos, se separan para poder leerlos).
- Pensado también para las GPU de tabletas y móviles (0.7): ninguna pieza comparte una cara con otra (las caras
  pegadas o coplanarias «se peleaban» en el búfer de profundidad y dejaban bandas rayadas), los rótulos van
  separados de verdad de su cara y se dibujan a más resolución (nítidos al acercarse), el rango de profundidad se
  ajusta al modelo, la cámara no se mete dentro del modelo al acercar, las caras cortadas se rayan como en un
  plano técnico, una etiqueta no salta de un lado a otro al girar y pellizcar sobre el modelo (o sobre una
  etiqueta) acerca el modelo, nunca la página. `node tests/modelos3d-auditoria.mjs` revisa los 39 modelos en
  busca de caras coplanarias.
- Pruebas: `tests/modelos3d.spec.ts` y `tests/visor3d-tactil.spec.ts` (`npx playwright test -c
  playwright.modelos3d.config.ts`, con su propia compilación en el puerto 4193); capturas y hojas de contacto: `node tests/modelos3d-capturas.mjs --hoja
  --paginas` (en `tests/capturas/modelos3d/`); coste por fotograma al girar: `node tests/modelos3d-rendimiento.mjs`.

## Consolas

«Consolas» en el carril de iconos (`#/consolas`), o el botón «Explorar la placa» bajo las fotos de las figuras
36.16 y 36.22, abre las placas base de la NES (NES-CPU-07) y de la primera Neo Geo AES (NEO-AES) en cuatro
pestañas enlazadas entre sí:

- **Foto**: la foto del libro con un recuadro en cada chip, conector, cristal o regulador identificado (26 en la
  NES, 29 en la Neo Geo). Al tocarlo se ve qué es, la marca que lleva, su función y por qué buses pasa, con
  botones para saltar a su símbolo en el esquema o a su bloque en la arquitectura. Los recuadros continuos son
  piezas cuya marca se lee en la foto; los discontinuos, piezas identificadas por su posición. Con los botones
  de lupa se amplía la foto.
- **Arquitectura**: diagrama de bloques animado. Cada escenario reproduce con los tiempos reales (indicados en
  «Fidelidad de la temporización») los ciclos de bus de la CPU, la decodificación de direcciones, las lecturas
  de la PPU con ALE y el espejado de la CIRAM, el NMI del vblank (NES), y en la Neo Geo los ciclos del 68000, el
  diálogo 68000 ↔ Z80, la línea de sprites y capa fija, el cuadro con sus interrupciones y los relojes. Se
  reproduce, se pausa, se avanza paso a paso o se arrastra la barra de tiempo; la pantalla dice cuánto se ha
  ralentizado (p. ej. «1 : 4,5 · 10⁶»). En «Decodificar una dirección» se escribe una dirección en hexadecimal y
  se ve qué selección de chip baja. Debajo, un analizador lógico con las señales elegidas, sincronizado con la
  animación (rueda o pellizco para ampliar, arrastrar para mover el instante).
- **Esquema**: las hojas reales de KiCad (NES-CPU-11 de OpenTendo; las 13 hojas de la recreación NEO-AES3-5 de
  Board-Folk). Al pasar el ratón o tocar un hilo, un pin o una etiqueta se resalta toda la red, en esa hoja y
  en las demás, con la lista de chips y pines conectados y su grupo de buses. Se busca por nombre de red,
  referencia o chip; se desplaza arrastrando y se amplía con la rueda, el pellizco, doble clic o `+` `−` `0`.
- **Fuentes**: créditos y licencias (OpenTendo, TAPR OHL 1.0; Board-Folk, dominio público según su README),
  qué diferencia hay entre la placa de la foto y la del esquema, y la tabla de equivalencias de chips de la
  Neo Geo. La tabla dice, para cada chip de la 1.ª generación (LSPC-A0, PRO-B0, PRO-C0 y la lógica TTL), qué
  chip lo sustituye en la 2.ª, qué señales pasan y qué cambia, con la hoja de los esquemas de SNK de donde sale
  («MV4 h.4», «AES h.1», «NG Hw-10»…). Las fichas de la foto de la Neo Geo indican qué se ha comprobado con
  esos documentos. Los documentos de SNK no van dentro de la aplicación; las imágenes de las hojas citadas están
  en `/home/claude/consolas/neogeo/referencias/`.

**Las otras cinco consolas** usan las mismas pestañas:

- **Master System II** (placa 171-5922A, PAL): fotos de la placa montada (IC BD M4Jr. PAL, 1992) y de la placa sin
  componentes, de ConsoleMods (CC BY). El esquema es el del manual de servicio de Sega (abril de 1991),
  transcrito a mano y redibujado en tres hojas con etiquetas en cada pin; las lecturas dudosas del escaneo están
  en «Fuentes», y la tabla compara los pines con el SMS1 de slowcoder (Z80, RAM y cartucho coinciden del todo; en
  el VDP, 43 de 64). La arquitectura anima los ciclos del Z80 (3,55 MHz), el decodificador de memoria y de puertos
  de E/S (se elige el espacio), el paginador, la escritura en la VRAM por el bus multiplexado, la interrupción de
  línea, el cuadro con INT y pausa, y los relojes.
- **Mega Drive** (modelo 1 VA6.8 PAL, «IC BD M5 PAL» de 1993, y una VA6 NTSC de EE. UU. como segunda foto):
  fotos de ConsoleMods con las huellas del KiCad de stonedDiscord llevadas a cada una (cualquier componente del
  esquema se marca con una cruz; la foto PAL, hecha en ángulo, con una homografía ajustada). Los cables añadidos de
  la placa PAL se señalan como modificación. Arquitectura con un selector «PAL · 50 Hz / NTSC · 60 Hz» (PAL por
  defecto, como la placa): ciclos del 68000 (7,60 o 7,67 MHz), decodificador del 68000 y del Z80, BUSREQ/BUSACK, la
  ventana del Z80 sobre el 68000 con su registro de banco, DMA del VDP, cuadro de 313 o 262 líneas con sus
  interrupciones y relojes desde los 53,203424 o 53,693175 MHz. «Fuentes» añade las
  diferencias con el modelo 2 sacadas de su manual de servicio.
- **Game Boy** (DMG-CPU-05/06 y la placa de la pantalla DMG-LCD-06): foto de gbhwdb, el escaneo de Gekkio con
  las pistas de cobre (se elige un bus o una red y se ve en rojo sobre las dos caras) y las dos caras de la
  placa de la pantalla. Esquemas de Gekkio (CC BY 4.0). Arquitectura con dos capas, «Placa» y «Dentro del SoC»
  (bloques de msinger): ciclos de máquina a 4,194304 MHz, el MBC1, una línea de la PPU con sus modos, el cuadro
  con VBlank y STAT, el DMA de OAM y los relojes, con citas de GBCTR y Pan Docs.
- **Game Boy Color** (CGB-CPU-04): fotos de gbhwdb y el esquema de la placa original redibujado por Natalie the
  Nerd (CC BY-NC-SA 4.0), reconstruido a partir de su PDF y comprobado con la recreación opengbc (los 118 pines
  conectados de la CPU coinciden). Arquitectura: doble velocidad (KEY1), bancos de VRAM y WRAM, HDMA por línea y
  general, la PPU y las paletas.
- **Super Nintendo** (SNSP-CPU-01 PAL, 0.9): esquema y placa de **nonSNES** de stonedDiscord (GPL-3.0, commit
  `cf2e70b`), una recreación «1:1» de la SNSP-CPU-01 Rev5 con el esquema de arzi84; el texto completo de la GPL va
  en «Fuentes» (`web/public/consolas/snes/LICENSE-nonSNES.txt`). Dos fotos de esa misma placa, del propio
  repositorio: la cara de componentes escaneada sin los chips y la de soldadura con sus SMD (Wikimedia Commons no se
  pudo consultar desde aquí). Los recuadros **no se dibujan a mano**: son las huellas de la PCB llevadas a cada foto
  con un ajuste afín a sus vías (792 y 44 puntos; error mediano de 1,6 y 3,1 px), así que cualquier componente del
  esquema se marca en la foto de su cara. Arquitectura con selector PAL/NTSC (PAL por defecto: 21,28137 MHz, 312
  líneas): accesos de 6, 8 o 12 ciclos maestros por zona, decodificador del bus A y del bus B, DMA de la ROM a la
  VRAM o a la WRAM por los dos buses a la vez, una línea con el refresco de la WRAM y el HDMA, el cuadro con la NMI
  y la lectura automática de los mandos, los puertos CPU ↔ SPC700, la salida del S-DSP al DAC y los relojes.

  **Cambiar las fotos por otras** (por ejemplo, de la placa del dueño con sus chips): copiar la foto a
  `/home/claude/consolas/snes/fotos/`, escribir junto a ella un `<foto>.alineacion.json` como
  `nonSNES_front.alineacion.json` con al menos 4 puntos `[X mm, Y mm, x px, y px]` (un pad o taladro de la placa,
  con las coordenadas de `snes/pcb/SNSP-CPU-01_huellas.json`, y el mismo punto en la foto a su tamaño original;
  `"modelo": "homografia"` si la foto está hecha en ángulo, `"cara": "bottom"` si es la de soldadura), cambiar
  `origen` y `alineacion` de la foto en `MAQUINAS` (`contenido/consolas.py`, entrada `snes`) y ejecutar
  `python3 contenido/consolas.py snes`. Los recuadros y las marcas salen solos; los textos de cada pieza están en
  `contenido/consolas_snes.py`.

Los datos se generan con `python3 contenido/consolas.py` (también desde `generar.py`) a partir de la carpeta
de investigación `/home/claude/consolas`; si falta, se conservan los de `web/public/consolas/`.

**Placa en 3D y Placa en 2D.** Las siete consolas (la Master System II desde la 0.11, reconstruida a partir de sus fotos) tienen dos pestañas más con la placa dibujada por
el mismo visor que «Proyectos KiCad» (girar, ver desde arriba, abajo o de canto, separar capas, rayos X, cara
superior o inferior, aspecto real o por capas). La placa está enlazada con el esquema: elegir U1 o una red en el
esquema la elige en la placa («Ver en la placa») y al revés («Ver en el esquema», «Ver en la foto»); al tocar un
componente se ven sus pads con su red, y al tocar una red, todos sus pads.

- **NES** (0.8): la PCB de la recreación OpenTendo v1.4 de la NES-CPU-11 (KiCad 8, TAPR OHL 1.0), con las mismas
  referencias y redes que el esquema (98 referencias y 567 pads coinciden; 2 pads en otra red). Es un dibujo nuevo
  «casi 1:1» hecho desde escaneos de la placa original; la foto de «Foto» es de una NES-CPU-07. La copia del
  `.kicad_pcb` está en la carpeta de investigación (`/home/claude/consolas/nes/original/OpenTendo/Board Files/`);
  `python3 contenido/consolas_pcb.py nes` la regenera.
- **Mega Drive**: la PCB de la recreación de stonedDiscord (KiCad 9), el mismo proyecto que el esquema: 291
  componentes con su cuerpo, las dos caras de cobre, planos, 785 vías y la serigrafía. Las 291 referencias y los
  1291 pads conectados coinciden con el esquema. Es una recreación «1:1» dibujada a partir de escaneos de la placa
  desnuda, no la placa de Sega fotografiada.
- **Game Boy Color**, dos placas a elegir: «CGB-CPU-04 · Gerber», los Gerber de 4 capas de Natalie the Nerd (la
  misma placa que el esquema), leídos con un lector de Gerber propio; cada pad lleva su referencia, su patilla y su
  red, así que el enlace con el esquema funciona igual (124 de las 128 referencias; D3, Q5, TST3 y VR2 no tienen
  pads). Un Gerber no dice dónde va cada componente: desde 0.8.2 se reconstruye (`contenido/consolas_gerber_piezas.py`).
  112 componentes con cuerpo: 100 con la huella de la biblioteca de KiCad que nombra el esquema de Natalie, ajustada
  a sus pads (error 0,000 mm: ella usó esas huellas), 5 con el contorno de la serigrafía (CPU, amplificador,
  regulador, interruptor, rueda del volumen) y 7 con medidas aproximadas de las fotos (ranura del cartucho, conector
  de la pantalla, puerto de enlace, tomas, resonador y la placa del convertidor); los rótulos de los chips salen de la
  foto, los valores del esquema y las alturas son las típicas. 11 sin cuerpo (contactos de los botones y de las pilas,
  pads del altavoz, puente de soldadura) y C46 sin montar. Cada pieza lleva la marca `rec` y su ficha dice de dónde
  sale; la placa avisa de que las posiciones están reconstruidas. Casi todo va en la cara inferior (la de los
  botones queda arriba), así que la vista «Inclinada» enseña esa cara. «OpenGBC · placa moderna», la placa de
  sustitución de whatware con sus componentes (CPU y RAM con patillas, condensadores, tomas, rueda…): no es la
  original y se enlaza solo en parte, «enlazada en parte»: U1, U2, P1 y P2 (CPU, WRAM, cartucho y pantalla) son las
  mismas piezas y sus 228 pads caen en las redes del esquema; el resto son otras piezas con referencias que en la
  CGB-CPU-04 nombran otros componentes.
- **Game Boy** (0.8.2): «Super DMG-01 · recreación moderna», la placa de la CPU de la recreación en KiCad de kamicane
  (CC BY-SA 4.0, commit `bf540dd`; esquema basado en el de bit9). No es la DMG-CPU original: según su README cambia la
  toma redonda por USB-C, añade un circuito de distribución de la alimentación (U5), saca los auriculares sin pasar por
  el amplificador y usa componentes SMD 0805 actuales; la CPU, el interruptor y el puerto de enlace son de una DMG o de
  una SGB. 61 huellas, 50 con cuerpo; enlazada solo en parte con el esquema de Gekkio: 23 referencias con la misma referencia y
  todas sus patillas en las mismas redes (U1, U2, U3, X1 y 19 pasivos y diodos; 162 pads), a partir de las redes de la
  CPU y las RAM. No se enlazan DA1–DA4, R1–R6, C3, C4, SW1, U4, P1 y P2 (otra numeración, el audio cambiado o, con la
  misma referencia, otra pieza) ni las piezas nuevas. El `.kicad_pcb` (1,7 MB) no se guarda: para regenerarla, `curl -L -o super-dmg-cpu.kicad_pcb
  https://raw.githubusercontent.com/kamicane/Super-DMG-01/bf540ddf6e518167b68968f77fc7b9183c40c1e8/super-dmg-cpu/super-dmg-cpu.kicad_pcb`
  y `CONSOLAS_PCB_GB_SUPERDMG=/ruta/super-dmg-cpu.kicad_pcb python3 contenido/consolas_pcb.py gb-superdmg`.
- **Neo Geo**: la PCB de la recreación NEO-AES3-5 de Board Folk (KiCad, dominio público según su README), el mismo
  proyecto que el esquema: 320 componentes, 2287 pads, 631 redes, 1498 vías y 107 zonas de cobre; las 317
  referencias del esquema están en la placa y 2265 pads tienen la misma red. Es la 2.ª generación del chipset
  (LSPC2-A2, NEO-B1, NEO-C1), no la NEO-AES de 1.ª generación de la foto. El `.kicad_pcb` (53 MB) no se guarda: para
  regenerarla, `curl -L -o NeoGeoAES3_5.kicad_pcb https://raw.githubusercontent.com/Board-Folk/NeoGeoAES-3.5/75ef9665d5fc884c22607987b42478e3580d8f86/NeoGeoAES3_5.kicad_pcb`
  (si se corta, repetir con `curl -L -C - -o …`) y `CONSOLAS_PCB_NEOGEO=/ruta/NeoGeoAES3_5.kicad_pcb python3
  contenido/consolas_pcb.py neogeo`. La geometría que dibuja el visor ocupa 1094 kB (261 kB comprimida).
  En la 0.9 deja de colgar la tableta (Xiaomi Pad 6) en «Colocando los componentes… 236 de 320»: Chromium para
  Android pinta los lienzos 2D en la GPU, y las caras de esta placa se pintaban con todo el cobre recortado por sus
  2286 aberturas de máscara; ese recorte retenía la GPU minutos (en Chromium de escritorio con el lienzo en la GPU,
  más de cinco minutos sin primer cuadro; ahora, componentes en 4,5 s). Ahora los pads se acaban con un solo relleno, sin recorte,
  y el dibujo es el mismo. El regulador U37 (LM2576T-5, TO-220 de cinco patillas) ya no pasa por el TO-220 de tres
  patillas de la biblioteca: tiene su cuerpo, con una patilla en cada uno de sus cinco pads.
- **Super Nintendo**: la PCB de nonSNES (KiCad 10, GPL-3.0), el mismo proyecto que el esquema: las 400 referencias
  coinciden y los 1552 pads con red están en la misma red que en el esquema (el resumen cuenta 1548 porque P5 tiene
  cinco pads con el número 23, todos a masa). Los chips (QFP, SOP y las SRAM) se dibujan con patas; la vista
  inclinada enseña la cara de los chips aunque la mayoría de las huellas (puntos de prueba y SMD) estén debajo. El
  proyecto declara 4,69 mm de grosor y se dibuja con 1,6. El `.kicad_pcb` (4,5 MB) no se guarda: `curl -L -o
  SNSP-CPU-01.kicad_pcb https://raw.githubusercontent.com/stonedDiscord/nonSNES/cf2e70b35b141b551b1683b0fac1c4b29f9ed0d6/SNSP-CPU-01/SNSP-CPU-01.kicad_pcb`
  y `CONSOLAS_PCB_SNES=/ruta/SNSP-CPU-01.kicad_pcb python3 contenido/consolas_pcb.py snes`. El esquema se convierte
  con `python3 /home/claude/consolas/tools/kicad9to7.py SNSP-CPU-01.kicad_sch snes/kicad7/SNSP-CPU-01.kicad_sch`
  (también sirve para KiCad 10), su netlist y su SVG con `kicad-cli sch export netlist --format kicadxml` y
  `kicad-cli sch export svg`, y las cajas de las huellas con `python3 tools/huellas_cajas.py`; solo se guardan esos
  derivados.
- **Cada componente con su cuerpo y cada chip con su rótulo (0.10).** Hasta la 0.9.2 casi todas las piezas de la Neo
  Geo (295 de 320), muchas de la Super Nintendo (177), la Mega Drive (47) y la NES (16) salían como cajas grises, y
  los chips no llevaban nada escrito: estas recreaciones usan huellas con nombres propios («Resistor1-5mm»,
  «CAP3-5mm», «BF-2.5mm», «LSPC2», «CASSETTE»…) que el programa no reconocía. Ahora cada huella se clasifica
  (`contenido/consolas_cuerpos.py`): por su nombre, y si no se conoce, por la forma de sus pads (dos pads: resistencia,
  condensador o pieza SMD según el paso, el valor y la referencia; una fila: red de resistencias en línea o conector;
  dos filas a 2,54 mm: DIP; dos filas SMD: SOIC/SOP; cuatro lados: QFP). Las resistencias llevan las bandas de su
  valor (las pequeñas japonesas de la Neo Geo, de carbón, tumbadas entre sus dos pads), los condensadores cerámicos
  su disco y los electrolíticos su lata; los chips (DIP, SOIC, SOP, QFP, SIP) llevan sus patas sobre sus pads, el
  punto o la muesca de la patilla 1 y su rótulo escrito a lo largo del cuerpo como en el chip real: NEO-B1, LSPC2-A2,
  NEO-C1, HD68HC000P, YM2610, 43256 en la Neo Geo; S-CPU 5A22, S-PPU1 5C77, S-PPU2 5C78, S-WRAM, S-SMP, S-DSP,
  S-ENC, S-CLK, F413 y LM324 en la Super Nintendo; 315-5402 y 312-5313A en la Mega Drive; 3193A (el CIC) en la NES.
  También tienen cuerpo las perlas de ferrita, los cristales, el trimmer, las bobinas, los puentes de hilo, los
  interruptores, el potenciómetro deslizante de los auriculares, los conectores (ranuras de cartucho y de la tarjeta
  de memoria, puertos de mando, tomas de vídeo y de alimentación, con su abertura hacia el borde de la placa) y los
  moduladores de RF. Los puntos de prueba, las marcas, los taladros, los logotipos, los puentes de soldadura y los
  contactos del borde de la placa no llevan cuerpo. Ninguna pieza queda como caja genérica. Las placas cuyos ficheros
  originales no se guardan (Neo Geo, Super Nintendo, Super DMG-01) se reclasifican desde su propio JSON con
  `python3 contenido/consolas_pcb.py --reclasificar` (solo cambian los cuerpos); al regenerar una placa desde su
  fuente se clasifica igual. La Neo Geo tiene ahora más geometría (unos 260 000 triángulos en las piezas en lugar de
  23 000, 146 llamadas de dibujo en lugar de 30): construir, unir y compilar las piezas cuesta unos 0,8 s en lugar de
  0,25 s (Chromium con SwiftShader y agente de Android, mediana de cinco cargas alternadas); el tiempo hasta ver la
  placa con sus componentes no cambia de forma medible (unos 12 s las dos versiones en esa máquina cargada).
- **Master System II** (0.11): «171-5922A · reconstrucción». No hay ninguna placa publicada de la 171-5922A (el
  `.kicad_pcb` de slowcoder está vacío, KiCad 4 sin huellas), así que se **reconstruye a partir de los escaneos de la
  placa desnuda** de ConsoleMods (las dos caras, 600 ppp, CC BY), y la pestaña lo dice arriba: «Reconstrucción a partir
  de la foto: las pistas solo se ven en la imagen». Cada taladro de componente se ha marcado a mano sobre la foto de la
  cara de componentes (por la serigrafía, que lleva las referencias del manual) y se ha centrado en su anillo de cobre
  (669 de 702); la escala sale de las propias piezas: las patillas de los DIP, de la ranura del cartucho, de la red
  RA1, de los filtros EMI y del regulador están en una rejilla de 2,54 mm, y un único ajuste afín por mínimos cuadrados
  a todas ellas da 23,65 × 23,58 px/mm (601 ppp, el escaneo de 600 ppp), un giro de −0,32° y un error mediano de
  1 px (0,04 mm). La placa mide así 190,7 × 151,6 mm (contorno, 18 taladros de fijación y ranuras medidos en la misma
  foto). Las caras son las dos fotos, enderezadas a ese marco (la de soldaduras registrada sobre la de componentes con
  697 taladros comunes, error mediano 2,3 px) y reducidas a 2560 y 2048 px (1,2 MB y 0,7 MB). Exacto: posición de
  cada taladro y de cada pieza, encapsulado de los chips (DIP-40, DIP-28 de 600 mil, DIP-48, el VDP en QUIP-64 de
  cuatro filas, el CXA1145P en DIP-24 de 400 mil, el oscilador en huella DIP-14) y las redes de las patillas de los
  chips y conectores (las del esquema del manual, por referencia y patilla). Supuesto: qué taladro lleva cada red en
  las 100 piezas de dos patas sin polaridad (la foto no lo dice; electrolíticos y diodos siguen el «+» y la barra de
  la serigrafía), los números de los «CP» y «CE» sin número de la serigrafía (por su posición), qué contacto es cada
  taladro de la toma, los interruptores y el modulador, el orden de las patas 6–9 de RA1 (el manual la parte en RA1 y
  RA2: elegir RA2 en el esquema elige RA1 en la placa) y los cuerpos y alturas (los típicos; rótulos de los chips de la
  foto de la IC BD M4Jr. PAL). El cobre no se redibuja: al elegir una red se iluminan sus pads, no sus pistas. 153
  componentes (150 del esquema; C7, C54 y R26 solo están en la placa; CS4 y R31 del esquema no aparecen en ella) y los 14 taladros sin usar de la huella estrecha de IC3; 720 pads. Se genera con `python3 contenido/consolas_pcb.py sms` (`contenido/consolas_sms_placa.py`, con las posiciones
  en píxeles de la foto en sus tablas; necesita OpenCV). Pruebas en `tests/consolas-placas.spec.ts` y capturas con
  `node tests/sms11-capturas.mjs` (en `tests/capturas/sms11/`).
- De la DMG-CPU original no hay placa abierta (Gekkio solo publica los esquemas): por eso la Game Boy enseña una
  recreación moderna.

«Fuentes» da el autor y la licencia de cada placa. Se generan con `python3 contenido/consolas_pcb.py` (aparte de
`generar.py`) en `web/public/consolas/placas/` (unos 3 MB; cada placa se descarga al abrir su pestaña). Los
ficheros originales no se copian: solo la geometría que dibuja el visor. La reconstrucción de la CGB-CPU-04 lee las
huellas de la biblioteca de KiCad instalada (`/usr/share/kicad/footprints`, o `KICAD_FOOTPRINTS`). Pruebas en
`tests/consolas-placas.spec.ts` (`playwright.placas.config.ts`, puerto 4291; desde la 0.10 también comprueba en las
siete placas que no queda ninguna caja genérica y que todos los chips llevan su rótulo) y capturas con
`node tests/consolas-placas-capturas.mjs` (en `tests/capturas/consolas-gbc/` y `consolas-gb/`). Las de la Super Nintendo,
en `tests/consolas-snes.spec.ts` (`playwright.snes.config.ts`, puerto 4321), con sus capturas en
`tests/capturas/consolas-snes/`.

### Un fotograma (0.9)

La pestaña «Un fotograma» de las siete consolas explica, paso a paso y en orden, cómo llega a existir un punto de un
cuadro. No emula ningún juego: sigue un ejemplo genérico (una tesela con una pelota de 8 × 8 puntos, o el sprite de
16 × 16 de la Neo Geo) con valores de ejemplo coherentes de principio a fin: la misma tesela, la misma paleta y el
mismo punto en todos los pasos. Entre 13 y 15 pasos por consola:

1. la CPU lee una instrucción de la ROM del cartucho (la dirección en el bus, la selección del chip, el byte de
   vuelta por el bus de datos) y guarda un valor en la RAM;
2. llega el borrado vertical: la interrupción (NMI, /INT, VINT, IRQ de nivel 1…) y la copia a la memoria de vídeo
   por los puertos del chip de vídeo o por DMA donde la consola la tiene (OAM DMA, DMA del VDP, HDMA, canales de
   DMA de la Super Nintendo), del mapa, del dibujo y de la paleta;
3. el chip de vídeo, línea a línea: lee el número de tesela del mapa, los bytes del dibujo, junta los planos,
   aplica el desplazamiento, decide entre sprites y fondos y busca el color en la paleta;
4. el punto sale hacia el codificador de vídeo o el convertidor digital-analógico y la tele (o la pantalla de
   cristal líquido de las Game Boy);
5. fin del cuadro: la interrupción vuelve a llegar y todo empieza otra vez.

Cada paso enseña:

- **El texto**: título y una a tres frases, y la lista «Lo que viaja» con las direcciones, datos y señales activas
  («/ROMSEL 0», «A0–A15 $C0F0»).
- **El diagrama de bloques** de «Arquitectura» (los mismos nombres de chips y señales), con solo los chips y buses que
  intervienen encendidos, unos pulsos que corren por los cables en el sentido de la señal y una flecha al final, y el
  valor en la etiqueta de cada bus. Algunos pasos de la Game Boy se dibujan en la capa «Dentro del SoC». En el móvil
  el diagrama se acerca a la parte encendida (con «Ver el diagrama entero» para verlo todo); si un paso recorre media
  placa, el dibujo se desliza a los lados.
- **La pantalla de ejemplo**: el cuadro anterior atenuado mientras trabaja la CPU, la tesela colocada por el mapa, los
  bits de cada plano (o los bytes de dos puntos de la Mega Drive), el índice de cada punto, el color, el punto que sale
  y, al final, el cuadro terminado; al lado, la tesela ampliada.
- **En la placa**: la foto de «Foto» encuadrada en los chips del paso, con el resto oscurecido; cada chip enlaza con
  su ficha.

Controles: «Anterior», «Siguiente», la barra de segmentos (cada segmento salta a su paso) con el contador «4/15»,
«Reproducir» (avanza solo con una pausa para leer cada paso, de 7 a 20 s según su longitud) y «Pausa», y las teclas
← →. El paso va en la dirección: `#/consolas/<maquina>/fotograma/<paso>`.

Los textos están en un fichero por consola (`web/src/componentes/consolas/fotograma/maquinas/<maquina>.ts`) y se han
contrastado con los datos de la propia aplicación y con documentación pública (NESdev Wiki, Pan Docs, SMS Power!,
Plutiedev y Sega Retro, NeoGeo Development Wiki, SNESdev Wiki y los documentos de anomie, los artículos de Rodrigo
Copetti), sin copiar texto; la lista de cada consola está en «Fuentes». Pruebas en `tests/fotograma09.spec.ts`
(`playwright.fotograma09.config.ts`, puerto 4341): pasos de cada consola, Siguiente, Anterior, teclado, barra,
Reproducir y Pausa, el paso en la dirección, los chips y cables encendidos existen en el diagrama de su consola y en el
móvil no se sale ningún texto. Capturas con `node tests/fotograma09-capturas.mjs` (tres pasos de cada consola en
tableta vertical y móvil, claro y oscuro, en `tests/capturas/fotograma09/`).

Sustituye (0.9) al reproductor de trazas ciclo a ciclo de la 0.8: se quitaron el reproductor, las trazas, los
generadores y emuladores de `contenido/fotograma/`, las demostraciones y los juegos homebrew que solo usaba él
(`contenido/consolas_demos/`, `contenido/consolas_juegos/`) y sus pruebas.

## Proyectos KiCad

«Proyectos» en el carril de iconos (`#/proyectos`), o el botón «Ver la placa» junto a las figuras de las placas de KiCad
de los capítulos 48 a 51 (y junto a los esquemas del libro que esas placas llevan a la práctica), abre las siete placas
del material complementario (`complementos/kicad/`): la placa portadora de la **estación IoT** (cap. 48), el núcleo de
regulación de la **fuente de laboratorio** (cap. 49), las cuatro placas del **amplificador Hi-Fi** (potencia,
preamplificador, fuente y protección; cap. 50) y el **receptor SDR** (cap. 51). Cada placa tiene cinco pestañas enlazadas
por una misma selección (un componente, un pad o una red): lo que se toca en una se ve en las demás.

- **Placa en 3D**: la placa como saldría del fabricante: FR-4 de 1,6 mm con todos sus taladros, máscara (verde, la del
  README del proyecto), cobre bajo la máscara un tono más claro, pads estañados (HASL) o dorados (ENIG), serigrafía real
  (la que traza KiCad), taladros metalizados, y los componentes de la biblioteca de modelos 3D de la aplicación
  (resistencias con sus bandas de color según el valor, condensadores por encapsulado y valor, integrados con su
  marcado, conectores…). Se gira arrastrando, se acerca con dos dedos o Ctrl + rueda; vistas Inclinada, Arriba, Abajo
  (le da la vuelta a la placa) y Canto; capas (cobre de cada cara, máscara, serigrafía, componentes); «Separar capas»
  las despega; «Rayos X» enseña las dos caras de cobre a través del FR-4 (son placas de dos capas: no hay capas
  internas). Al tocar un componente se ve su nombre sobre él; si está bajo la cabina de blindaje del SDR, la cabina se
  vuelve translúcida. Desde la 0.7 la placa aparece enseguida (las caras se pintan primero a un cuarto de resolución
  y luego a la completa) y los componentes llegan después, con «Colocando los componentes… n de N» y una barra: cada
  modelo distinto se construye una sola vez (el SDR, 72 para sus 131 piezas) y la página sigue respondiendo mientras
  tanto. Lo que más tarda en un equipo sin GPU (Chromium con SwiftShader) es compilar los sombreadores, igual que en
  la 0.6; las cifras antes/después están en ESQUEMA.md («Proyectos KiCad»). En la 0.8, en macOS (WKWebView, que
  tardaba más de un segundo en pintar y subir las dos caras de 4096 px, bloqueando la página) las caras las pinta un
  hilo aparte y se suben a la GPU a trozos, sin que la página se quede parada; en Windows se pintan como antes, que
  allí ya era cuestión de milisegundos. En Android las caras completas son de 2048 px en vez de 4096: a 4096 las de la
  Neo Geo y la Super Nintendo cerraban la aplicación en la Xiaomi Pad 6 (0.9.0), y pintarlas en el hilo aparte la
  cerraba ya en la primera pasada (0.9.1). Si aun así una pasada de caras completas no termina porque la aplicación
  se cierra, la siguiente vez ese dispositivo usa la mitad (hasta 1024 px) y lo recuerda (`epa-caras-max`). Al girar, si la GPU no llega a 60 cuadros por segundo, la placa se
  dibuja con menos píxeles mientras se mueve y vuelve a la resolución completa al soltarla. En la 0.9, con
  «Componentes» apagado los componentes no se cargan (solo se ocultaban): se construyen al encenderlo. Mientras se
  cargan se revisa su geometría: un modelo con números no finitos o de tamaño absurdo, uno de la biblioteca con otro
  número de patillas que pads tiene la huella (el toroide trifilar T1 del SDR) o cuyas patillas caen fuera de sus
  pads (los toroides verticales y el trimmer 3296W del SDR, las ferritas verticales y la tira de 2 mm de la Mega
  Drive, los DIP de 400 y 600 milésimas, que la biblioteca solo dibuja a 7,62 mm) se cambia por un cuerpo propio con
  sus patillas en los pads. Las piezas se colocan en tramos de 6 ms y, donde la GPU no compila en paralelo, los
  sombreadores se compilan de uno en uno, cada uno en su tarea.
  **0.12, placas en 3D más rápidas** (la prueba de «equipo lento» de la QA de la 0.11, CPU × 4 y red «Fast 3G»: la
  placa IoT tardaba 40–47 s en verse). Lo que más pesaba no era la placa, sino el **entorno del estudio** (los reflejos
  de los metales): cada vista lo volvía a calcular en la GPU, y con la GPU por software de las pruebas eso eran 8–9 s
  durante los que la página se quedaba parada. Ahora se calcula **una vez por dispositivo**: se lee de la GPU sin
  parar la página, después del primer cuadro de la placa (así la primera vista no tarda más que en la 0.11), se guarda en memoria y en el almacenamiento del navegador (una base de datos propia,
  `epa-cache-3d`, que no forma parte de los datos del usuario ni de sus copias) y las vistas siguientes suben esos
  mismos píxeles: la misma imagen (las capturas antes y después coinciden píxel a píxel) y tres o cuatro
  sombreadores menos que compilar en cada placa o modelo que se abre (en la Xiaomi Pad 6, sin compilación en
  paralelo, cada uno para la página). Además: el código de la vista 3D (three.js) y la biblioteca de modelos se
  descargan a la vez que los datos de la placa, no después; las caras rápidas se suben antes del entorno y el
  lienzo toma su tamaño al crearse (con la GPU ocupada, cualquier subida o cambio de tamaño esperaba por ella con
  la página parada); el lienzo no se enseña hasta su primer cuadro (antes, un instante en negro); y la geometría
  de la placa se construye sin `Path2D.closePath()`, que en Chromium cuesta tiempo proporcional a todo el trazado
  (con miles de pads era cuadrático: la Neo Geo pasaba unos 3 s, con la CPU × 4, antes de poder abrir su vista 2D o
  3D). El tamaño de las caras en Android (0.9.2) y la liberación de cada placa al cerrarla (0.11) no cambian; una
  vista que se cierra mientras aún se lee el entorno suelta su contexto WebGL al terminar la lectura (como mucho un
  minuto). Las cifras antes/después están en ESQUEMA.md («Proyectos KiCad», 0.12). Pruebas:
  `npx playwright test -c playwright.rendimiento12.config.ts tests/rendimiento12.spec.ts` (compilación propia en el
  puerto 4531).
- **Placa en 2D**: la placa plana, vista desde arriba o desde abajo (espejada), con aspecto real o por capas al estilo de
  KiCad, contornos de fabricación y zonas sin cobre (la de la antena del ESP32). Al pasar el ratón se lee el pad, la
  pista o la red; al tocar una red se resalta todo su cobre.
- **Esquema**: el esquema de KiCad del proyecto con las redes interactivas (el mismo visor que el de las consolas).
- **Simulación**: las netlists del capítulo en el simulador y, donde se pueden emparejar sin ambigüedad, la tensión de
  continua de cada red de la placa: en la etapa de potencia y en la fuente de laboratorio, el punto de trabajo de los
  modelos SPICE del propio proyecto (que usan las mismas referencias y nombres de red que la placa), calculado con
  ngspice al generar los datos; en la estación IoT, las tensiones que anota su esquema. «Tensiones» colorea el cobre.
- **Comprobaciones**: lo comprobado al generar los datos (cada pad en la red de su esquema, cada red una sola pieza de
  cobre, valores, huellas y referencias de fabricante iguales en esquema, placa y lista de materiales, tamaño y número
  de componentes frente al libro y al README) y las posibles erratas para la próxima edición.

En el panel de la derecha (debajo en el teléfono) está la ficha de lo seleccionado: referencia, valor, encapsulado,
referencia de fabricante, su función (del README del proyecto, o deducida de sus conexiones si el README no la cita),
la sección del libro que la explica, su símbolo recortado del esquema y sus pads con sus redes.

Los datos se generan con `python3 contenido/proyectos_kicad.py` (también desde `generar.py`); necesita `kicad-cli` 7 y,
para las tensiones, `ngspice`. Si falta la carpeta de los proyectos o `kicad-cli`, se conservan los de
`web/public/proyectos/`. Pruebas: `npx playwright test -c playwright.proyectos.config.ts`; capturas de todas las placas:
`node tests/proyectos-capturas.mjs`; coste por fotograma al girar la placa: `node tests/proyectos-rendimiento.mjs
--perfil mac|tableta|movil` (con la web servida en el puerto 4189).

### Proyectos por etapas (1.1)

`#/etapas` monta los cuatro proyectos detallados del libro **por etapas en el editor de esquemas**. Cada etapa es un
bloque del proyecto con lo que pide el libro (sus cifras y la sección que las da), un circuito de partida que **no
cumple** y unos valores que elegir; «Comprobar» **simula el esquema** con el ngspice de la aplicación y dice, condición
por condición, qué se midió y, si no cumple, qué cambiar y hacia dónde. El diseño del libro siempre pasa, y también
los que cumplen sin ser el suyo (otro valor comercial de la serie, dos piezas en paralelo, otra topología): se juzga lo
que mide el circuito, no sus valores.

| Proyecto (capítulo impreso) | Etapas: lo que se elige → lo que se comprueba |
|---|---|
| Fuente de laboratorio (49) | 1 secundario y C de filtro → valle ≥ 33 V con la red al −10 % y 3 A, rizado ≤ 3 V, ≤ 48 V en vacío con la red al +10 % · 2 divisor de realimentación → 30 V ± 1 % con la consigna al máximo, regulación de carga < 0,1 %, 0 V con la consigna a cero · 3 R sensora (ejercicio 49.5) → unos 2 A en cortocircuito · 4 caída del prerregulador → 5 V sin dropout a 3 A y ≤ 12 W en el transistor de paso |
| Estación IoT (48) | 1 pull-up del I²C → subida ≤ 300 ns con 50 pF (400 kHz) y ≤ 3 mA · 2 ganancia y referencia del micrófono → 40–60 dB y 1,65 V · 3 R y C del detector de nivel → τ = 125 ms ± 10 % |
| Amplificador Hi-Fi (50) | 1 preamplificador A1 → 6 dB ± 0,5 y respuesta plana ± 0,5 dB con el tono al centro · 2 ajuste del multiplicador de V<sub>BE</sub> → corriente de reposo de 50 mA (40–60) · 3 raíles → ≥ 50 W sobre 8 Ω y ≤ 19 W por transistor |
| Radio SDR (51) | 1 atenuador en π → 10 dB ± 0,5 y 50 Ω ± 5 · 2 R<sub>G</sub> → ganancia de 31 ± 0,25 dB · 3 Sallen-Key → −3 dB por encima de 24 kHz y fuga a 7 MHz ≤ −68 dB |

- **Dónde se diseña.** Cada etapa tiene su circuito en «Mis circuitos» (se crea al abrirla por primera vez, con el
  nombre «Fuente de laboratorio · Etapa 1: …»). En la página de la etapa hay un campo por cada valor que se elige
  (serie E12, E24 o E96, o valor libre para un trimmer o una tensión), escrito como en el editor («4,7k», «10m», «30»),
  y el esquema dibujado con los valores actuales; «Abrir en el editor» lleva al mismo circuito, donde se puede cambiar
  cualquier cosa (y verlo en la protoboard); el editor muestra arriba qué etapa es y «Volver a la etapa y comprobar».
  «Restaurar la etapa» vuelve a dibujar el circuito de partida.
- **La teoría.** Cada etapa enlaza su sección del libro y, si la hay, la lección 1.1 de «Fundamentos» en que se apoya
  (la carga RC, el divisor, el rectificador, el detector de pico, el embalamiento térmico…).
- **Pistas y referencia.** Antes de simular se dice qué falta o no se entiende (una pieza borrada o renombrada, un valor
  fuera de su serie). Tras dos comprobaciones fallidas se ofrece «Ver el diseño de referencia» (el del libro, o un
  diseño que cumple cuando el libro da el requisito pero no los valores) y «Usar estos valores». Verlo ya se pregunta
  y deja la etapa sin XP (revisión 11c: escribir a mano los valores vistos daba todos los XP). Cuando fallan dos
  condiciones, cada pista dice también qué le hace su cambio a la otra, así que no se contradicen (el atenuador del
  SDR pedía a la vez subir y bajar las ramas en paralelo).
- **Progreso.** Cada comprobación simulada es una respuesta (10 XP la primera vez que se supera a la primera, 5
  después, una sola vez por etapa); lo superado se guarda en el almacén `proyectos` y se sincroniza. Entradas: una
  tarjeta al final de cada capítulo de proyecto y del 47 (que los presenta), un botón «Etapa n» junto a las secciones
  que las explican, un nodo en el camino de los cursos que contienen el capítulo («Proyectos completos» y el del tema)
  y «Proyectos por etapas» en el editor.
- **Lo que no se cubre**, porque no es un circuito que simular: el capítulo 47 (sus cuatro diseños son los mapas de
  bloques de estos proyectos, sin valores), el presupuesto de energía, el firmware y la red de la estación IoT, el lado
  de red de la fuente, masas y zumbido del amplificador, y el detector en cuadratura (su simulación tarda minutos) y el
  procesado digital de la SDR.

Pruebas: `EPA_SIN_SERVIDOR=1 npx playwright test -c playwright.proyectos11.config.ts tests/proyectos11-unidad.spec.ts`
(Node, cada etapa con el ngspice real) y `npx playwright test -c playwright.proyectos11.config.ts
tests/proyectos11-navegador.spec.ts` (puerto 4685, compilación en `/tmp/claude-0/epa-proyectos11/dist`).

## Figuras vivas

Las figuras del libro con datos (431 gráficas y 91 esquemas) se pueden leer y tocar sin salir del texto; el
dibujo es exactamente el del libro y lo interactivo va encima. Una fila discreta sobre la figura indica qué
ofrece («Lectura de valores», «Circuito vivo», «Conexiones») y tiene «A|B» y «Abrir en grande».

- **Gráficas**: al pasar el puntero (o el dedo) aparece una cruz que se pega a la curva más cercana y un
  cuadro con el valor de todas las curvas en ese punto, con sus unidades y prefijos (coma decimal). Un clic o
  un toque deja la lectura fijada; otro toque en el mismo sitio la suelta. «A|B» pone dos cursores que se
  arrastran, con una tabla de A, B y B − A (y 1/Δ si el eje es de tiempo). Cada gráfica de una figura con
  varias es independiente. Los bocetos sin números no tienen lectura.
- **Esquemas vivos** (25 figuras, 31 dibujos con la simulación de ngspice que guarda el libro): puntos que
  recorren los cables y los componentes en el sentido de la corriente convencional (ámbar) o de los electrones
  (azul), más deprisa cuanta más corriente (escala logarítmica) y quietos si no la hay; cables coloreados por
  su tensión (azul negativo, gris 0 V, rojo positivo) con leyenda. Al pasar o tocar un cable o un nodo se ve
  su tensión y su corriente; en un componente, su tensión, corriente y potencia, y (al tocarlo) los enlaces
  a su animación y a su sección. Con fuentes alternas o cuadradas se reproduce el transitorio de dos periodos
  (reproducir/pausa y una barra de tiempo) y, al elegir un nodo o una rama, una gráfica de su tensión y su
  corriente. «Valores» cambia resistencias, condensadores, bobinas y fuentes (×0,1 a ×10, E12) y vuelve a
  simular en el momento; «Valores del libro» lo deshace.
- **Esquemas sin simulación** (66 figuras): al pasar o tocar un cable se resalta su red y los terminales que
  une, y se explica por qué no se simula (faltan valores, componentes que el simulador no modela, sin fuentes).
- **Abrir en grande**: la figura a pantalla completa con zoom (rueda, pellizco, botones, doble toque) junto a
  sus controles; en las gráficas, la pestaña «Datos» las redibuja con la gráfica del simulador (zoom de
  recuadro, cursores, tabla).
- **En el simulador**, cada netlist muestra su **circuito** encima de los resultados: el de la figura del libro
  cuando su esquema coincide con la netlist, o uno dibujado automáticamente a partir de ella. Lleva las mismas
  corrientes, tensiones y fichas, calculadas con la propia netlist después de cada simulación, también al
  mover sus controles deslizantes. Tocar un componente lleva a su control deslizante; los circuitos grandes se amplían
  con los botones de lupa (44 px), `Ctrl` + rueda o pellizco, se desplazan arrastrando, y «Abrir en grande»
  los muestra a pantalla completa.
- Rendimiento: los datos de una figura se descargan solo cuando se acerca a la pantalla y nada se anima fuera
  de ella, con la ventana oculta o con «reducir movimiento» (entonces empieza en pausa). Medido con
  `node tests/figuras-vivas.mjs` (CPU ×4): 60 fps en los perfiles «mac» y «tableta», con menos de 1,5 ms de
  trabajo por fotograma.

## Instrumentos

«Instrumentos» en el carril de iconos (`#/instrumentos`) abre un **banco de pruebas** con los dos instrumentos del
libro dibujados (no son fotos), midiendo circuitos que simula el mismo ngspice del simulador. El circuito se ve
dibujado: en las prácticas, la figura del libro (o un esquema propio cuando la figura no lo tiene); en el banco
libre, el esquema automático de la netlist. Se elige una punta (roja o negra de cada multímetro, sondas CH1 y CH2,
pinza de masa) y se toca un nodo del dibujo o de la lista; para medir corriente, el multímetro se pone **en serie**
con un terminal de cualquier componente. Cada cambio (una punta, un valor, una función, la base de tiempos, el
generador) vuelve a simular en unos milisegundos. También hay un **auricular** (♪) para escuchar un nodo, como en
la protoboard (0.10), y un «?» con la ayuda de cada instrumento. El AUTO del osciloscopio sube los V/div cuando una
señal pequeña va sobre mucha continua (no cabría en pantalla con el mando de posición).

Los instrumentos **forman parte del circuito**, como en el banco real: el voltímetro son 10 MΩ ‖ 60 pF (en el
rango de mV la impedancia cae por encima de unos 3 V), el amperímetro es la derivación de su borne (BM869s:
0,15 mV/µA, 3,3 mV/mA, 45 mV/A; 2C53T: 10 Ω en mA), el óhmetro aplica su tensión de prueba, la sonda ×10 son
10 MΩ ‖ 20 pF y la ×1, 1 MΩ ‖ 100 pF, y las dos pinzas de masa del osciloscopio son el mismo punto. Con la punta
roja en un borne de corriente y el multímetro en paralelo con una fuente, el fusible se funde.

**Brymen BM869s.** Selector de 11 posiciones (tocar o arrastrar; flechas con el selector activo): OFF, VFD V∿,
V∿, V⎓, mV⎓, mV∿, T1 T2, ⊣⊢/diodo, Ω/continuidad/nS, A mA, µA; SELECT recorre las funciones de cada posición
(pantalla doble: V⎓ y V∿, AC+DC, Hz, dBm, ciclo de trabajo, 4–20 mA); RANGE (manual; mantenido, automático;
referencia de dBm y T1/T2/T1−T2), Δ (relativo; mantenido, 500 000 cuentas en continua), HOLD, CREST (picos de
1 ms) y REC (máximo, mínimo, media); pulsación larga = mantener un segundo (o `Mayús Intro`). Pantalla principal de
50 000 cuentas, secundaria y barra analógica de 41 segmentos; zumbador de continuidad (por debajo de unos 94 Ω) y
aviso BeepJack con Web Audio. Lo que muestra no es el valor exacto: cada rango tiene un error fijo dentro de su
especificación ± (% + dígitos) (por bandas de frecuencia en alterna), ruido en el último dígito, el autorrango del
instrumento, valor eficaz verdadero con su ancho de banda (filtro VFD aparte) y la incertidumbre según el manual
debajo del instrumento.

**FNIRSI 2C53T.** Los diez botones y la cruceta como en la sección 21.3: MENU (osciloscopio, multímetro,
generador), CH1/CH2 (canal, acoplamiento AC/DC, factor de sonda del menú y conmutador de la sonda, invertir),
TRIGGER (Auto/Normal/Single, fuente, flanco, nivel), PRM (Vpp, Vef, Vmed, Vmáx, Vmín, frecuencia, periodo, ciclo),
SELECT (Math: CH1±CH2, CH1×CH2, FFT; cursores de tiempo con 1/Δt o de tensión; X-Y), MOVE (canal activo;
mantenido, las flechas mueven las trazas), AUTO, RUN/STOP y SAVE (imagen PNG). En la pantalla se tocan los menús y
se arrastran los cursores. Sus límites, emulados: 50 MHz de ancho de banda (6 MHz con la sonda en ×1), **1 000
puntos** en 12 divisiones (muestreo real = 1 000/(12·s/div), como máximo 250 MS/s: aparece el aliasing), **8 bits**
en 8 divisiones (lo que se sale se recorta y las medidas fallan sin avisar), ruido de 1–2 mV en la entrada. El
generador DDS da 13 formas de 1 Hz a 50 kHz y de 0,1 a 3 V, siempre de 0 a la amplitud, y excita la fuente del
circuito que se elija. El multímetro del 2C53T (19 999 cuentas, detección automática de V⎓/V∿ por encima de
0,7 V) usa sus propias puntas.

**Prácticas guiadas** (`#/instrumentos/practica/1` … `12`, y «Practicar» junto a cada práctica en el libro, con
«Leer en el libro» de vuelta): divisor y ley de Ohm, carga RC, curva del diodo (también en X-Y), media onda y rizado,
Bode del RC, armónicos con la FFT, 555 astable, BJT como interruptor, resonancia RLC y Q, tiempo de subida, AM y
su demodulador, y medida de L y C. Cada una tiene sus montajes (variantes), los pasos del libro con «Preparar este
paso en el banco» (conecta y ajusta los instrumentos como dice el libro), la tabla **«Tu medida frente a lo
esperado»** (valor del libro, tolerancia, la lectura del instrumento en vivo y «Anotar») y, en las prácticas de
barrido (diodo, Bode, resonancia), una tabla de puntos con su gráfica frente a la teoría. Los valores esperados se
han comprobado con el mismo motor; donde la práctica real difiere de la cuenta del libro, la diferencia está en el
circuito, como dice el libro: la resistencia de la bobina y los 50 Ω del generador bajan el Q de 3,16 a 1,86, la
derivación del amperímetro se suma a la tensión del diodo si se pone en serie con él, la sonda de 10 MΩ deja la
carga RC con 1 MΩ en el 90,9 %.

**Laboratorio guiado (1.1)** (`#/instrumentos/laboratorio/1` … `12`; «Laboratorio» junto a «Practicar» en cada
práctica del libro, «Laboratorio guiado» en cada práctica de `#/instrumentos`, «Hacerla como laboratorio guiado» en
la práctica libre, y un nodo después de cada lección del capítulo 21 en el camino del curso «Taller e instrumentos»,
y en su lista): la misma práctica, con el circuito ya montado en el banco y los instrumentos **sin preparar**. Cada
paso pide hacer algo con el instrumento (girar el selector, pasar la roja al borne mA, ponerlo en serie, quitar la
alimentación para medir Ω, llevar la sonda a un nodo, AC o DC, ×1 o ×10, la base de tiempos, la fuente y el flanco del
disparo, PRM, cursores, FFT, X-Y, el generador) y, cuando hay lectura, escribir lo que marca. «Comprobar» mira el
estado del instrumento y compara lo escrito con lo que muestra el instrumento simulado, con una tolerancia que sale de
su resolución (el Brymen da cinco cifras y bastan tres: ± 0,5 %; el 2C53T tiene 8 bits, un escalón es 1/32 de
división: ± 3 %; sus cursores saltan 0,04 div; la FFT se lee en una cuadrícula de 10 dB/div: ± 2 dB). Si algo falla,
la pista nombra el error, también los que el libro avisa: sonda y menú en ×1/×10 distintos, acoplamiento AC o DC
equivocado, el disparo en el canal o el flanco que no es, la pinza de masa en otro nodo, el amperímetro en paralelo
(fusible), el óhmetro con el circuito alimentado, la roja en un borne de corriente, puntas cambiadas, un valor diez
veces desviado, sin su prefijo o con la unidad sin prefijo («100,5 F» por 100,5 µF), o con el signo cambiado (unos dB
de una atenuación escritos en positivo). El capacímetro del simulador (un modelo de pequeña señal) mide igual con el
circuito alimentado: su pista lo dice y explica por qué uno real no. «Mostrar dónde» ilumina el mando en el instrumento (cuenta como pista: 5 XP en vez de
10), «Hágalo por mí» hace el paso (sin XP). Los cursores, que el instrumento solo deja arrastrar, tienen aquí dos
deslizadores para el teclado, y lo que muestra la pantalla del FNIRSI (un canvas) se lee también en texto. Cada paso es
una respuesta como una tarjeta de lección (10 XP una sola vez, 5 a la segunda o con pista, nada tras dos fallos o con
«Hágalo por mí»); el resumen compara cada lectura con el valor que espera el libro. Lo hecho se guarda en el almacén
`laboratorio` y se sincroniza (unión de los pasos de todos los dispositivos; revisión 11a: también los pasos que hizo
«Hágalo por mí», que ya no dan XP en otra visita ni en otro dispositivo, y la portada da por completado el laboratorio
cuando entre los dispositivos se hicieron todos sus pasos); «Repetir» vuelve el banco al principio
sin borrar nada y prepara cada paso como la primera vez (por dónde va ese repaso se guarda en `sessionStorage`,
`epa:laboratorio-repaso`, así que una recarga lo continúa: revisión 11c), y al volver a entrar se continúa en el
primer paso pendiente con el banco como lo dejaron los anteriores. «Hágalo por mí» de un paso que cambia la base de
tiempos calcula los cursores en segundos y los pasa a divisiones de la base que aplica (la fase de la práctica 5 los
dejaba a la mitad del tiempo: revisión 11c). En el móvil el paso va arriba, antes del circuito y de los instrumentos, y
mientras sus botones no se ven una barra fija abajo lleva el paso, la lectura, «Comprobar» y la pista: se lee el paso y
se maneja el instrumento sin subir y bajar. Al hacer los laboratorios salió un fallo de la 1.0: el montaje «Diodo suelto» de la práctica 3 no tenía
circuito y el Brymen marcaba OL en la prueba de diodos (corregido, con prueba). En la práctica 12, el laboratorio usa
la relación de valores eficaces (los dos canales en AC): el ruido de la sonda ×10 infla las medidas de pico de una
señal de 0,3 Vpp lo bastante para sacar |Z| de la tolerancia.

Simplificaciones: el instrumento no tiene memoria entre sesiones; la persistencia, el modo «rolling», la
compensación de la sonda, los disparos especiales y el registro por el puerto óptico no están; la temperatura
se fija en el banco (no hay termopar simulado); el 2C53T muestra a menos de 4 µs/div la reconstrucción
sen(x)/x (la forma analógica) y su FFT usa ventana de Hann (el manual no dice cuál).

Supuestos donde ni el libro ni el manual dan el dato: impedancia de salida del DDS 50 Ω y flancos de 0,2 µs;
ancho de banda del convertidor de verdadero valor eficaz del BM869s, un polo a 1,07 MHz (5 % menos a 350 kHz,
medido por lygte-info); filtro VFD de cuarto orden a 700 Hz (5 % menos a 530 Hz); tensiones y resistencias
internas de prueba del óhmetro y del diodo según las medidas de lygte-info (1,15 V y 0,38 mA; 2,94 V); del
multímetro del 2C53T, entrada de 10 MΩ, convertidor de valor eficaz de un polo a 3 kHz y umbral de continuidad de
50 Ω. El libro sitúa resistencia, continuidad, diodo y capacidad en una sola posición del selector; el BM869s real
(manual y foto del libro) separa ⊣⊢/diodo y Ω/continuidad/nS, que es lo que se ha dibujado.

Fuentes de las especificaciones: capítulos 20 (2C53T) y 21 (prácticas) del libro impreso y sección 52.7 (BM869s);
[manual del Brymen BM867s/BM869s](https://storage.eleshop.eu/files/BM860s-manual-ES636.pdf) (rangos, exactitud,
bandas de alterna, tensión de carga, sensibilidad del frecuencímetro, ciclo de trabajo, capacidad, diodo);
[prueba del BM869s de lygte-info.dk](https://lygte-info.dk/review/DMMBrymen%20BM869s%20UK.html) (orden del selector,
impedancia del rango de mV, tensiones de prueba, umbral de continuidad, respuesta en frecuencia);
[ficha del FNIRSI 2C53T en Elektor](https://www.elektor.com/products/fnirsi-2c53t-3-in-1-2-ch-oscilloscope-50-mhz-multimeter-signal-generator)
(sensibilidad 10 mV–10 V/div, base de tiempos 10 ns–20 s, 1 Kpts, ±400 V, multímetro de 19 999 cuentas y su
exactitud, formas del generador) y el
[hilo del 2C53T en EEVblog](https://eevblog.com/forum/testgear/new-handheld-scopedmm-fnirsi-2c53t-2ch-50mhz250msps-(aug-2024)).

Pruebas de los laboratorios: `EPA_SIN_SERVIDOR=1 npx playwright test -c playwright.laboratorio11.config.ts
tests/laboratorio11-unidad.spec.ts` (en Node, sin navegador: cada laboratorio en un banco real con el ngspice de la
aplicación —cada paso rechazado antes de hacerlo y aceptado al hacerlo, la lectura frente al libro, cada error típico
con su pista—, el almacén, su fusión y los XP) y `PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c
playwright.laboratorio11.config.ts tests/laboratorio11-navegador.spec.ts` (puerto 4684: el laboratorio 1 entero con el
teclado, axe en claro, sepia y oscuro, 360 px, los enlaces).

Rendimiento: el instrumento lee cinco veces por segundo y el osciloscopio adquiere ocho, solo con la ventana
visible; la pantalla del 2C53T es un canvas que se redibuja solo cuando cambia lo que muestra. Una simulación del
banco tarda de unos milisegundos (continua) a unos 2 s (la AM de 100 kHz, la más pesada).

## Kit FM7303

«Kit FM7303» en el carril de iconos (`#/fm7303`), o el botón del mismo nombre junto a los esquemas del capítulo 15
(figuras 15.25, 15.26, 15.9…) y a las secciones de bloques, puntos de prueba, alineación, averías y mapa de
tensiones, abre el receptor entero en cuatro pestañas que comparten el mismo esquema:

- **Esquema y tensiones**: el esquema completo del kit (las 219 piezas del original de la figura 15.26, redibujadas
  y agrupadas en los ocho bloques de colores de la figura 15.9) con desplazamiento y zoom (arrastrar, rueda o
  trackpad, pellizco, doble toque, `+` `−` `0` y flechas). Al abrir cada pestaña, al girar el dispositivo o
  cambiar el tamaño de la ventana, el esquema se vuelve a encuadrar centrado en su recuadro (entero, o a toda la
  altura desde la izquierda si el recuadro es estrecho); «ver todo» (`0`) lo centra en ambos ejes. Encima, la capa viva de las figuras: puntos que recorren
  los cables con la corriente continua y cables coloreados por su tensión, calculadas con ngspice para el kit
  entero. Al tocar una pieza se ve su valor, su función en la radio, la sección del libro que la explica, su
  bloque y su animación de componente. El **multímetro** mide entre dos puntos tocados en el esquema (la negra
  en masa por defecto) y, si el punto está en el mapa de tensiones, muestra el valor del libro y si está dentro
  de la tolerancia (±5 % alimentaciones, ±10 % polarizaciones, sección 15.21). La tabla del **mapa de tensiones**
  pone lado a lado los valores del libro y los simulados.
- **Señal**: el camino antena → RF/mezclador → FI → detector → MPX → decodificador → desénfasis → volumen →
  amplificador → altavoces, animado sobre el esquema, con la señal de cada etapa (la banda y el circuito de
  entrada, la FI con los filtros cerámicos y B1, la curva en S del discriminador, la respuesta del desénfasis
  simulada con la netlist del libro…) y un **osciloscopio** en TP1–TP4, los altavoces y el raíl de 12 V, con
  los ajustes que recomienda el libro (sonda ×10 en TP2, acoplo AC y FFT en TP3, medida automática de
  frecuencia en TP4).
- **Alineación**: el procedimiento de la sección 15.11, paso a paso y en su orden, sobre un kit que sale de la
  bolsa desajustado: C4A', B1, B2 (TP3 = 4,6 V), cobertura con C4B' y L2, seguimiento con L1 y C4A', AFC con W1
  (TP1 = 4,6 V), VCO con W3 (38 kHz en TP4 con el puente «Monitor») y sensibilidad del mute con W2. Cada paso
  muestra el texto del libro, los mandos y el instrumento que necesita y dice cuándo se ha llegado al ajuste.
- **Averías**: diez averías que el libro describe (antena, L3 abierta, W1 o W3 desajustados, R13 abierta, un
  condensador de salida abierto, oscilador parado, display sin alimentación, K4, L1 deformada) escondidas en el
  kit. Se ve el síntoma, se mide con el multímetro y el osciloscopio, se usan las dos pruebas rápidas del libro
  (pinzas en TP2, tono inyectado en el amplificador) y se señala la pieza culpable en el esquema.

**Qué es del libro y qué es modelo.** Todo valor marcado «libro · 15.x» procede del capítulo 15 (el generador
comprueba cada cita contra el texto de `cap16.typ`) o de sus figuras (15.26, el esquema original; 15.28, el mapa
de tensiones y las bobinas; 15.16, las trazas del FNIRSI). Lo marcado «modelado» o «sintetizado» lo calcula la
aplicación: los integrados son macromodelos con las tensiones y consumos que da el libro (las patillas cuya tensión
depende del interior del chip quedan sin valor, «—»), la física de la alineación usa f = 1/(2π√(LC)) con los
valores del esquema más unas capacidades parásitas elegidas para que, alineado, cubra exactamente 88–108 MHz, y
las formas de onda de los puntos de prueba se generan a partir de la descripción del libro. Las emisoras son
ficticias.

Los datos se generan con `python3 contenido/fm7303.py` (también desde `generar.py`): escribe
`web/public/fm7303/esquema.svg` y `kit.json`, comprueba las conexiones del dibujo, las citas y, con el ngspice
del sistema, que el modelo de continua reproduce el mapa de tensiones del libro. Pruebas: `tests/fm7303.spec.ts`
(capturas en `tests/capturas/fm7303-*.png`).

## Aprender con el libro: ejercicios, deducciones y progreso

**Ejercicios y problemas que corrigen la respuesta.** Debajo de cada ejercicio (373) y tras el «Se pide» de cada
problema (113) hay un panel con un campo por cada magnitud pedida. Se escribe el valor como en el papel: coma
decimal, prefijos y unidad opcionales (`4,7 kΩ`, `4k7`, `2R2`, `2,2 µF` o `2,2u`, `20 mA`, `1,2e-3`, `−6 dB`);
la unidad del campo se muestra a la derecha. «Comprobar» (o `Intro`) responde campo a campo:

- **Correcto**, dentro de la tolerancia (la del redondeo del libro, entre el 2 % y el 6 %, o la que fija el
  curado); también se aceptan las alternativas válidas (el valor comercial E12 frente al calculado, otro
  redondeo), con una nota.
- **Casi**: las cifras están bien pero sobra o falta un prefijo (o la coma está corrida), el signo está cambiado,
  o el valor está a menos de un 10 %.
- **No es correcto**, o «esa unidad no es de esta magnitud» (no cuenta como intento).

«Pista» descubre primero el planteamiento (la fórmula o el método, sin números) y después un resultado
intermedio; la tercera pulsación abre la solución del libro. «Ver solución» la abre en cualquier momento. Las
preguntas que no son numéricas (elegir, explicar, deducir, diseñar) ofrecen «comparar con la solución» y, al
verla, «¿Lo tenía bien? Sí / No». En los problemas, «Ocultar solución» tapa el análisis del libro mientras se
intenta. De cada ejercicio se guardan los intentos, si está resuelto (a la primera, con pistas o tras ver la
solución) y lo último escrito; «Reiniciar» lo borra.

De los 486, **249 se comprueban solos** (601 campos) y 237 se comparan con la solución; todos tienen dos pistas.
Las respuestas las saca `contenido/ejercicios.py` de las soluciones y se revisaron una a una en
`contenido/ejercicios_curado.txt`, que manda sobre lo automático (formato al principio del fichero).

**1.0: todos los ejercicios del libro, resolubles en la aplicación.** Se revisaron los 486 (373 ejercicios y 113
problemas; todos traen su solución en el libro) y se clasificaron: 130 ya se comprobaban enteros; 5 eran numéricos o
simbólicos sin comprobar (prefijos de ej-0.1, pareja E12 de ej-2.9, De Morgan de ej-9.2, hexadecimal y BCD de ej-29.6,
biestables de prob-29.B); 79 tenían una respuesta estructurada (decidir sí o no, elegir, ordenar, clasificar, tabla
de verdad); el resto pide explicar, describir un procedimiento o diseñar. Ahora:

- **300 se comprueban solos** (604 campos numéricos y **99 preguntas** en 82 ejercicios): elegir una opción, ordenar
  los pasos con los botones ↑ ↓ (con teclado, el foco sigue al paso movido), clasificar cada elemento (también la
  tabla de verdad de ej-9.1), una respuesta exacta («D», «0001 0011»), una expresión lógica («A + B»; se acepta
  cualquier equivalente, y una equivalente sin simplificar es «Casi») o dos resistencias E12 en serie o en paralelo
  (cualquier pareja válida, no solo la del libro). Todo se comprueba a la vez con «Comprobar»; cada pregunta dice
  «Correcto», «Casi» o lo que falla («3 de 5 están en su sitio», «7,5 kΩ no es un valor de la serie E12»).
- **Desarrollo**: cuando una pregunta queda resuelta (acertada, tras dos comprobaciones fallidas o con la solución
  abierta) se ve la respuesta y, debajo, «Del libro» con la frase de la solución que la justifica, copiada literalmente
  (la generación se para si no está tal cual en el libro); en las pocas donde el libro no lo dice con esas palabras,
  «Desarrollo», comprobado por otro camino en las pruebas. Al resolver un ejercicio, o tras dos fallos, «Ver el
  desarrollo» abre la solución completa del libro.
- **Autoevaluación** de lo que no se puede comprobar solo (186 ejercicios enteros y la parte abierta de otros 125):
  «Su respuesta» (opcional, hasta 4000 caracteres con su contador; se guarda en el dispositivo y se sincroniza, también
  si se cambia de página en seguida), «Ver solución» con la lista de **lo que se pide** para marcar punto por punto, y
  «¿Lo tenía bien? Sí / No», que cuenta para el progreso y el dominio igual que antes (nunca como acierto automático).
- Los ejercicios de preguntas entran, como los numéricos, en la práctica inteligente, el dominio por concepto y el
  problema del día. Fuera de los 486 quedan los cinco «Ejemplo» resueltos dentro del texto (no se plantean como
  ejercicio) y las doce prácticas de laboratorio del capítulo 21 impreso, que se guían en Instrumentos.

Pruebas 1.0: `PLAYWRIGHT_BROWSERS_PATH=… npx playwright test -c playwright.ejercicios10.config.ts` (puerto 4611,
compilación en `/tmp/claude-0/epa-ejercicios10`): `tests/ejercicios10-contenido.spec.ts` (sin navegador; con
`EPA_SIN_SERVIDOR=1` no compila: los 486 con enunciado, comprobación o autoevaluación y desarrollo, cada pregunta
acepta su respuesta y rechaza otra, cada cita está en la solución, propiedades del comprobador numérico y del
estructurado, el escritor de `valores`, «usted») y `tests/ejercicios10-navegador.spec.ts` (elección con campos,
ordenar con teclado, tabla de verdad, expresión lógica, pareja E12 en la página «Ejercicios», autoevaluación con
recarga y navegación, práctica inteligente, 44 px en el teléfono y axe en claro, sepia y oscuro).

**1.1: erratas de las soluciones** (tras un recálculo independiente de los 300 autocomprobables). En dos problemas el
libro imprime un valor que no corresponde a su propio planteamiento, y la aplicación acepta el correcto, no el impreso,
con un «Aviso» que explica la diferencia: 1.B (pérdida del cable de 6 mm² a 60 °C: 1,33 W; el libro da 1,15 W, que es a
20 °C) y 3.B (corriente eficaz por diodo: 1,19 A; los 1,68 A del libro son la del secundario). 33.A acepta 12,3 bits
(log₂ 5000, como el libro) y también 13, el número entero de bits del convertidor. 43.B pregunta «¿Qué velocidad
recomienda el libro…?» (antes «¿Qué velocidad…?», con dos respuestas defendibles) y una nota recoge que el libro dice
10⁸ m·bit/s y su tabla usa 1,2·10⁸. En los 34 ejercicios cuya solución usa un dato que el enunciado no da (una
tolerancia, una resistencia de devanado, ε_r, pF por dispositivo, el reparto de pérdidas…; casi todos de la serie
«Problema N.X», más el ejercicio 52.12), el panel muestra junto a «Se pide» «Dato que usa la solución del libro:» (por
ejemplo, 0,4 Ω de devanado en 5.B; 2,4 GHz en 35.B), copiado de la propia solución y comprobado: con él sale el valor
del libro. En el modo docente, el examen imprime ese dato tras el enunciado, y las soluciones el dato, la nota y el
aviso antes del desarrollo del libro. Pruebas:
`playwright.erratas11.config.ts` (puerto 4674, compilación en `/tmp/claude-0/epa-erratas11`):
`tests/erratas11-unidad.spec.ts` (sin navegador, `EPA_SIN_SERVIDOR=1`: respuestas aceptadas y rechazadas, avisos, la
calificación del examen y los PDF; los 34 datos, presentes y en el examen y las soluciones) y
`tests/erratas11-navegador.spec.ts` (aviso y dato con la solución oculta y a la vista, axe en los tres temas; los 34
datos, cada uno en su panel).

**1.1: ejercicios nuevos, «Aún no en el libro».** Los tres capítulos que el libro deja sin ejercicios —21 «Prácticas de
laboratorio con el FNIRSI 2C53T» (10), 24 «Cuadripolos, función de transferencia y filtros» (11) y 34 «Sensores y
acondicionamiento de señal» (9)— tienen 30 ejercicios nuevos, al nivel y con el estilo de los del libro y hechos solo con
lo que enseña cada capítulo (sus ejemplos, figuras y tablas): enunciado con «Se pide», respuestas numéricas con su
unidad y tolerancia (80 campos), preguntas de elección con la explicación de cada opción incorrecta («Por qué no…»), una
de ordenar y una de clasificar, dos pistas (planteamiento y resultado intermedio) y la solución desarrollada. Se ven al
final de su capítulo como «Ejercicios nuevos», con la marca **«Aún no en el libro»** (también en la página «Ejercicios»,
la búsqueda y el banco del modo docente; en los PDF, «aún no en el libro»), y funcionan como los demás: práctica
inteligente, problema del día, dominio, exámenes y sus PDF. Sus explicaciones se rotulan «Desarrollo», nunca «Del
libro». Cinco del capítulo 21 llevan «Medir en el banco (práctica N)»: lo que se pide se lee en el FNIRSI o el Brymen
simulados de esa práctica (la sonda ×1 y ×10 sobre el divisor de 1 MΩ, la carga RC con los cursores, la ganancia y el
retraso del RC, los armónicos en la FFT, la curva del RLC con los 50 Ω del generador), con una tolerancia que cubre lo que
muestran. Tres del capítulo 24 son **problemas de diseño abiertos** —un paso bajo RC con f<sub>c</sub> = 1 kHz ± 5 %,
un paso alto de 50 Hz ± 5 % para bloquear la continua y un Sallen-Key de ganancia unidad con el corte a −3 dB en
1 kHz ± 5 % y Q entre 0,65 y 0,75—: vale cualquier diseño que cumpla. Se escriben los valores (con su serie E12 o E24 y
su margen; un valor fuera de su serie o de su margen se avisa antes de simular, sin contar como intento ni acercar la
solución: revisión 11c) y «Comprobar» **simula el circuito con el ngspice de la aplicación** (un análisis de alterna y las medidas
`meas`, como las netlists del libro) y comprueba cada condición sobre lo medido; si no cumple, dice qué ha medido y qué
cambiar («El circuito simulado da f<sub>c</sub> = 1,06 kHz, por encima de 1 kHz ± 5 %: para bajarla, aumente R o C»).
Lo simulado se guarda con los valores, así que al volver se ve el veredicto sin simular otra vez y un examen se califica
con lo que se simuló al entregarlo. Las etiquetas (`ej-22.1`…, `ej-25.1`…, `ej-35.1`…) son las que tendrán en el libro:
cuando el autor los pegue y se regenere, el del libro sustituye al de la aplicación y el progreso se conserva. La fuente
es `contenido/ejercicios_nuevos11/<parte>.yaml` (no el libro); el mismo texto da el HTML de la aplicación y el Typst para
la próxima edición (`python3 contenido/ejercicios_nuevos.py --typst FICHERO`, con dónde pegar cada bloque y las líneas
para el curado). Pruebas: `playwright.ejnuevos11.config.ts` (puerto 4683, compilación en `/tmp/claude-0/epa-ejnuevos11`):
`tests/ejnuevos11-unidad.spec.ts` (sin navegador, `EPA_SIN_SERVIDOR=1`: cada respuesta reproducida desde los datos del
enunciado por un segundo camino —aritmética compleja, integración numérica, coeficientes de Fourier, el puente exacto…— y
las del banco simulando el circuito de su práctica; cada respuesta aceptada y otra rechazada; cada opción incorrecta con
su explicación; la marca; la fusión —el del libro gana, idempotente—; diseños válidos aceptados e inválidos rechazados con
su pista, simulados con ngspice en Node; el examen y los PDF; el Typst) y `tests/ejnuevos11-navegador.spec.ts` (la marca,
una respuesta, un diseño mal y luego bien, axe en claro y oscuro).

Desde la revisión 10e, lo que se escribe en los campos y se elige en las preguntas se guarda mientras se hace (sin contar
como intento) y vuelve al regresar al ejercicio; el veredicto solo se enseña de lo que se comprobó. Se aceptan también
las grafías equivalentes de una unidad («0,165 m» o «16,5 cm» para mm, «960 g» para kg, «31 °C/W» para K/W, «38,5 mS»
para mA/V, «R33», «5 V.», «- 6 dB»), y las mayúsculas cuentan donde cambian la unidad («4,7 mS» no vale por 4,7 ms). Un
ejercicio autoevaluado dice «Autoevaluado: lo tenía bien» (o «no lo tenía bien»). «Practicar con otros valores» ya no
saca variantes fuera del régimen del enunciado (transistor cortado o saturado, rizado de 40 Hz con onda completa a 50 Hz,
emisoras fuera de la banda de FM, LED azul a 60 mA…): pruebas `tests/ejercicios10-r10e.spec.ts`.

Revisión 10g: un borrador escrito en un dispositivo que aún no tenía el ejercicio ya no deshace, al sincronizar, el
«resuelto» de otro; lo escrito sin comprobar nunca vuelve con veredicto, tampoco tras «Reiniciar» o si otro dispositivo
comprobó entretanto (revisión 10j: un ejercicio resuelto en un dispositivo sigue resuelto aunque otro, que aún no lo
sabía, falle después una comprobación —una autoevaluación «No» posterior sí lo deshace—; «Ocultar/Ver solución» de un
problema se conserva al sincronizar y gana el último pulsado; un intento fallado tras un «Reiniciar» que ese dispositivo no
había visto cuenta como «fallado», y la XP de un ejercicio nunca es mayor que la que dio el dispositivo que lo resolvió); se leen «10⁴», «10^4» y «10⁻³ A», y horas, minutos y segundos o m², cm² y mm² se convierten entre
sí; los enunciados que escribe la aplicación dicen «Calcule…». Si el problema del día guardado es un ejercicio que una
corrección retiró (prob-6.C en la 10e) y aún no se había respondido, se elige otro; respondido, se conserva su
resultado. Al haber cambiado los valores posibles de algunos ejercicios, «La solución de ayer» de un problema elegido con
la 0.12 puede enseñar otros valores que los que se vieron entonces. Pruebas: `tests/ejercicios10-r10g.spec.ts` (incluye
los casos e10 del motor real).

Revisión 10i: se acepta el prefijo femto («744 fF», como lo escribe la propia aplicación; «2,2 f» solo es femto, los
faradios se escriben «F»). En «Practicar con otros valores», el problema del día y los exámenes del modo docente, el
resultado esperado se calcula con los datos tal como se muestran (tres cifras): antes, una tensión térmica escrita
25,9 mV pero usada como 25,85 mV daba un 4 % de diferencia. Ya no salen variantes que repiten los valores del libro, las
velocidades se escriben «1,8 × 10⁸ m/s» y los enunciados generados dicen «Calcule I (corriente del diodo) con estos
datos: …». Pruebas: `tests/ejercicios10-r10i.spec.ts`.

QA final de la 1.0 (variantes y examen): lo que pide cada variante («En esta variante se pide: …», y «se pide solo»
cuando el ejercicio del libro pide más cosas) se escribe con los valores de la variante —ej-3.3 pedía «X<sub>C</sub> a
50 Hz» con la frecuencia cambiada, prob-4.A «Rizado con 100 µH» con otra bobina— y es también la etiqueta del campo (ej-3.4
decía «X<sub>C</sub> =» donde se pide una resistencia). Los dos ejercicios que piden un valor comercial (ej-3.4 «Elige el
valor E12 más cercano» y ej-5.1 «Elige valores comerciales») piden ahora el valor E12 más cercano a la resistencia
calculada y solo aceptan ese valor (el calculado queda en «Cerca»: «Ese es el valor calculado; se pide el valor E12 más
cercano a él»); antes se corregía la resistencia calculada al 2 % y el E12 correcto se quedaba en «Cerca». La primera
pista avisa cuando el párrafo del libro que cita usa los valores del libro. En el modo docente cada variante dice lo
mismo que la práctica, en pantalla y en el PDF (y las soluciones, «2,2 kΩ (el valor E12 más cercano a 2,26 kΩ)»), y
«Solo lo que la aplicación corrige sola» deja fuera los 125 ejercicios que también piden explicar o diseñar (quedan
175; en la lista salen como «En parte autoevaluado»). Un ejercicio de ordenar (ej-11.5) comprobado sin mover nada dice
«Ordene los elementos con las flechas antes de comprobar.» (y cualquier «Comprobar» sin nada que comprobar lo dice en
pantalla). Pruebas: `tests/ejercicios10-qa10b.spec.ts` (sin navegador), `tests/qa10b-variantes.spec.ts` y cuatro
casos nuevos en `tests/ejercicios10-navegador.spec.ts` (sesión con semilla 12, que saca ej-11.5).

Los ejercicios autoevaluados no dan XP al resolverse: abrir la solución (que es como se autoevalúan) anula los XP del
ejercicio, sin excepción (decisión del dueño); sí cuentan para el progreso y el dominio como siempre.

**1.1: razonar en vez de autoevaluarse («aprender haciendo»).** De los 186 ejercicios que en la 1.0 solo se comparaban con
la solución, **181 se comprueban ahora solos**, porque su razonamiento clave cabe en una elección, un orden, un
emparejamiento o un valor: 280 preguntas de elegir (en 162 ejercicios), 54 de emparejar causa y efecto o clasificar (en
52), 20 de ordenar los pasos de un procedimiento o de una cadena de causas (en 20) y 4 valores numéricos que calcula la
solución (en 3: la deriva de un día con el 1 % de error en ej-20.8, el muestreo de Nyquist en ej-52.1, las medidas de la
bisección en ej-14.1). Todo sale del libro: el enunciado de cada pregunta resume lo que se pide, la opción correcta
justifica con la frase de la solución copiada literalmente («Del libro», o «Desarrollo» en las tres donde el libro lo da
en una tabla) y **cada opción incorrecta lleva su «Por qué no»**, escrito con lo que dice la solución, y los distractores
son, siempre que se puede, los errores contra los que avisa el propio libro (un cortocircuito en el nudo de 5,9 V que
arrastraría el regulador en ej-16.13, el bajo factor de potencia «por desfase» en ej-33.4, el ERC que avisaría de
RESET/RESET_ en el problema 11.B, desconectar la tierra de protección en ej-32.4…). Ocho conservan, opcional, la parte que
pide redactar («También se pide», como los 125 de la 1.0); los cinco que siguen autoevaluados piden enumerar o son de
respuesta abierta (ej-12.8, 40.5, 42.2, 46.4 y 48.5). Un convertido funciona como cualquier autocomprobable: «Comprobar»,
pistas, «Por qué no», la práctica inteligente, el problema del día, el dominio por concepto y los exámenes del modo
docente (se califican solos; las soluciones en PDF dicen «Por qué no B): …» de cada opción incorrecta), y da los XP de
los autocomprobables (15, u 8 con ayuda; ninguno si se abrió la solución). Ninguno tiene «Practicar con otros valores»
(no hay fórmula que lo reproduzca). El progreso de la 1.0 se conserva: lo autoevaluado sigue resuelto o fallado, sin XP
(se resolvió viendo la solución), y una respuesta escrita que ya no tiene parte abierta donde verse sigue a la vista bajo
«Su respuesta». Arreglo: un problema autoevaluado con la solución a la vista (los problemas la enseñan si no se oculta)
daba 15 XP al decir «Sí» sin haber pulsado «Ver solución»; ahora autoevaluarse cuenta siempre como solución vista. La
fuente es `contenido/ejercicios_curado.txt` (líneas `?`, `>`, `porque N:` y `=`). Pruebas: `playwright.razonar11.config.ts` (puerto 4687, compilación en
`/tmp/claude-0/epa-razonar11`): `tests/razonar11-unidad.spec.ts` (sin navegador, `EPA_SIN_SERVIDOR=1`: los 181 y los 5,
una sola correcta y una explicación por opción, órdenes con una sola solución, categorías usadas, los valores
recalculados desde el enunciado, la regla de XP, candidatos de la práctica y sin variantes, el examen y el PDF de
soluciones) y `tests/razonar11-navegador.spec.ts` (ej-4.8 resuelto solo con el teclado, sus XP, el arreglo de los XP de un
problema autoevaluado, 360 px y axe en claro y oscuro).

**Resolver paso a paso (1.0).** En 45 ejercicios numéricos (116 pasos, todos revisados a mano uno a uno) el panel
ofrece resolverlo por partes: tras dos comprobaciones fallidas aparece «¿Lo resolvemos por partes…?» con «Resolver
paso a paso», y en cualquier momento hay un botón discreto con ese nombre. Cada paso es una pregunta corta con su
propia comprobación (un valor con su unidad, prefijos y coma decimal, con la tolerancia de siempre, o elegir una
opción), una «Pista» y, en las opciones equivocadas, «Por qué no»; acertado (o tras dos fallos, con la respuesta) se
ve «Del libro» con la frase de la solución de la que sale, y se pasa al siguiente. El último paso es el resultado del
ejercicio: «Ha llegado al resultado… Escriba ahora las respuestas del ejercicio y compruébelas». «Salir del paso a
paso» vuelve al ejercicio en cualquier momento. Mientras se responde, las pistas del ejercicio (que dan resultados
intermedios) no se ven. El paso a paso cuenta como ayuda en cuanto se usa, lo que de verdad se vio: comprobar un paso o
ver su pista equivale a la primera pista del ejercicio (el planteamiento) y ver la respuesta de un paso o llegar al
resultado, a las dos (los resultados intermedios); al cerrarlo, las pistas del ejercicio se ven hasta ahí. Abrirlo y
salir sin usarlo no cuenta nada. No se guarda nada más del paso a paso. No aparece en los exámenes del modo docente (el examen
no usa el panel de ejercicios). Los pasos salen de las soluciones del libro: `python3 contenido/pasos.py --proponer
FICHERO` propone uno por cada cadena «X = … = valor» de la solución, se revisan y reescriben a mano en
`contenido/pasos_curado.json` (solo se publica lo que lleva `"aprobado": true`) y `contenido/pasos.py` (lo llama
`generar.py`) escribe `libro/pasos.json` comprobando que cada paso cita literalmente la solución, que su valor está
escrito en la cita y que el último es una respuesta del ejercicio. Pruebas: `tests/ejercicios10-pasos.spec.ts`.

**Teoría que se mueve (1.0).** Bajo 14 ecuaciones del libro, en su propia sección (divisor de tensión, ley de Ohm,
potencia V²/R, resonancia LC, carga y descarga de un RC, reactancia capacitiva, corte de un RC, corriente de un RL,
resistencia de un LED, resistencia serie de un Zener, polarización por divisor, ganancia del inversor y del no
inversor), cada magnitud es un deslizador: se arrastra con el ratón o el dedo, o con el teclado (flechas, Re Pág / Av
Pág, Inicio, Fin), y el resultado y una gráfica pequeña del resultado frente a una de ellas cambian al momento (cálculo
puro con el motor de las calculadoras; nada se simula). Las resistencias, condensadores y bobinas recorren la serie
E12; las tensiones de alimentación, valores redondos; y se empieza en los valores del ejemplo del libro cuando lo hay
(12 V, 10 kΩ y 5 kΩ → 4,00 V; LED de 2,0 V a 20 mA desde 5 V → 150 Ω…). «Volver a los valores del libro» los
restituye. En las lecciones está abierta; en el lector es un botón discreto «Mover los valores de esta fórmula».
Lectores de pantalla: cada deslizador anuncia su valor con prefijo y unidad, y la gráfica, el punto actual. Nada se
anima. Se eligen a mano en `contenido/teoria_viva_curado.json` (fórmula, rangos, series, valor inicial, eje de la
gráfica) y `web/scripts/teoria10.mjs` (lo llama `generar.py`; idempotente) escribe `libro/teoria-viva.json`.
Pruebas: `tests/ejercicios10-teoria.spec.ts`.

**Página «Ejercicios»** (carril de iconos, `#/ejercicios`): todos por capítulos, con lo resuelto de cada uno, filtros
(pendientes, fallados, resueltos; ejercicios o problemas; solo los que se comprueban solos) y cada uno se abre
ahí mismo. **Repaso de fallados** (`#/ejercicios/repaso`) los recorre uno a uno con «Anterior» y «Siguiente».

**Deducciones paso a paso.** Las 46 deducciones del libro se descubren de una en una: «Siguiente paso», la flecha
`→` o la barra espaciadora (con la deducción seleccionada) o un toque sobre ella; `←` vuelve atrás y «Ver todo» la
muestra entera. Cada una recuerda hasta dónde se llegó.

**Progreso de lectura.** Una sección cuenta como leída cuando se ha visto su final y ha estado en pantalla el
tiempo suficiente para su longitud (unos 5 s por pantalla, entre 4 y 75 s); también se marca o desmarca a mano
con el botón ✓ junto a su título. El índice lateral muestra un anillo por capítulo, una barra por tomo y una ✓ en
cada sección leída; la portada añade «Progreso»: el porcentaje del libro leído, los ejercicios resueltos, el
acceso al repaso y los capítulos en curso (lectura y ejercicios de cada uno). La detección usa un
IntersectionObserver: no hace ningún trabajo mientras se desplaza la página.

Pruebas: `tests/ejercicios.spec.ts` (capturas en `tests/capturas/ejercicios-*.png`).

## Calculadoras

**351 fórmulas del libro, vivas.** Cada ecuación del libro que es una relación de ingeniería con uso numérico (ley de
Ohm, divisores, constantes de tiempo, reactancias, resonancia y Q, cortes de filtros, ganancias, potencias y
decibelios, polarización, operacionales, 555, reguladores, rizado, efecto pelicular, líneas de transmisión, ruido,
conversión A/D, enlaces de radio, fiabilidad…) lleva debajo un botón **«Calcular»** (497 de las 911 ecuaciones; la
misma fórmula repetida en otro capítulo también lo lleva). En el ordenador y la tableta abre la calculadora justo
debajo de la ecuación, sin mover el texto; en el teléfono, como una hoja desde abajo que se cierra con «Atrás», un
toque fuera o deslizando el asa. Si una ecuación reúne varias fórmulas, unas pestañas las separan.

- **Cualquier variable**: «Calcular» elige la incógnita (τ, R o C de τ = R·C). 836 despejes son exactos; los 53
  que no tienen forma cerrada (la C de una impedancia RLC, el tiempo de una senoide…) se resuelven numéricamente,
  y si hay varias soluciones se muestra la más cercana al valor anterior y se avisa.
- **Valores como en el papel**: coma decimal, prefijos y unidad opcionales (`4k7`, `2R2`, `100n`, `100 nF`,
  `2,2 µ`, `1e-3`, `1 000`); `↑`/`↓` cambian el valor un 10 % (`Mayús`: ×10). El resultado se da con cuatro cifras,
  prefijo SI y espacio fino. Un valor fuera de lo habitual en el libro (o un resultado) se marca con un aviso.
- **El ejemplo del libro**: los valores por defecto son los del ejemplo resuelto en esa sección cuando lo hay (276
  fórmulas), con «Valores del libro» para volver a él. El generador comprueba que la fórmula reproduce el
  resultado impreso.
- **Sensibilidad**: «Ver cómo depende» dibuja el resultado frente a cualquier entrada en su intervalo habitual
  (escala logarítmica cuando abarca décadas), con la gráfica del simulador (cruz de lectura, cursores, zoom).
- **Tarjetas de fórmulas vivas**: las 23 tarjetas con fórmulas catalogadas tienen «Calcular con la tarjeta»: cada
  magnitud se escribe una vez y todas las fórmulas de la tarjeta se recalculan. Si una magnitud la calcula otra
  fórmula de la tarjeta (τ = R·C para la curva de carga), «Calcularla con…» la enlaza.
- **El dibujo**: cada fórmula se ve dónde vive. 153 llevan un esquema (divisor, RC, RLC, puente, operacionales,
  transistores, 555, reguladores, conmutadas, líneas, antenas, disipador…) con cada magnitud escrita sobre su
  componente y el resultado resaltado; 92, una curva propia (carga RC con τ y el 63 %, Bode con −3 dB, resonancia con
  su ancho de banda, decibelios, diodo, rizado, PWM, 555, histéresis, espectro de una FI, amortiguamiento, suma en
  cuadratura…), y las demás, el resultado frente a la última magnitud que se ha movido. Todo se redibuja mientras se
  arrastra.
- **Intuitiva**: un deslizador por dato (logarítmico cuando abarca décadas, con una marca en el valor del libro y,
  para R, C y L, «E12/E24» para quedarse en valores comerciales), el campo de texto y un selector de prefijo (un
  número sin prefijo toma el del selector). La incógnita se elige tocando la letra en la fórmula o la etiqueta en el
  dibujo. Un valor fuera de lo habitual se explica («unas 1000 veces mayor que lo más alto que usa el libro; ¿sobra o
  falta un prefijo?»).
- **Explicativa**: «Paso a paso» (la fórmula, los valores con sus prefijos, las cuentas intermedias con la unidad
  simplificada —2π·10 kΩ·100 nF = 6,283 ms— y el resultado); «¿Qué pasa si…?» (flechas ↑/↓ y la proporcionalidad
  sacada de la expresión: «f<sub>c</sub> ∝ 1/R: doblar R divide f<sub>c</sub> entre 2», con «Probar»); «Qué
  significa» (2–4 frases de las 351 fórmulas con el texto del libro, cuándo vale, valores típicos y el error
  frecuente, con enlaces a la sección, la animación, el circuito del simulador y los ejercicios que la usan).
- **Página «Calculadoras»** (carril de iconos, `#/calculadoras`): una galería de 18 familias con su miniatura
  (leyes básicas, redes, transitorios, alterna, resonancia, filtros, decibelios, diodos, BJT, MOSFET, operacionales,
  osciladores, fuentes, magnetismo, ruido, digital, RF, térmica), todas por capítulos, búsqueda sin tildes por
  nombre, símbolo, palabra clave, sección o «cap 33», filtro por capítulo y **favoritas** (la estrella; se guardan
  como los marcadores). `#/calculadoras/<id>` abre una a página completa, con la gráfica y las demás fórmulas de su
  sección.

El catálogo lo escribe `contenido/formulas.py` (lo llama `generar.py`, o se ejecuta solo) a partir de las fórmulas
curadas a mano en `contenido/formulas_cat1.py` … `formulas_cat4.py`: nombre, ecuación en un lenguaje de expresiones
propio (sin `eval`), variables con su nombre en el libro, unidad, intervalo habitual y el ejemplo resuelto. Para
publicarse, cada fórmula tiene que encontrar su ecuación en el libro, reproducir el ejemplo (tolerancia del
redondeo del libro), y cada despeje tiene que volver al valor de partida; si el libro cambia, el generador lo dice.
La aplicación solo descarga el mapa pequeño de botones (`formulas-ec.json`, unos 20 kB) al leer, y el catálogo
completo (`formulas.json`) al abrir una calculadora; los dibujos, en un módulo aparte que se pide al abrirla.
Familias, dibujos y huecos están en `contenido/formulas_visual.py` y las explicaciones en `contenido/formulas_texto.py`;
el generador comprueba que cada frase entre «» está literalmente en la sección citada (como las preguntas del
repaso). Pruebas: `tests/calculadoras.spec.ts` (capturas en `tests/capturas/calculadoras-*.png`; las de antes del
rediseño, en `tests/capturas/calculadoras-antes/`). `node tests/calculadoras-capturas.mjs` fotografía una fórmula por
plantilla y por tipo de gráfico en el teléfono, el portátil y la tableta, claro y oscuro, con una hoja de contactos
por pantalla (`tests/capturas/calculadoras/`).

## Repaso: tarjetas y tests

**Página «Repaso»** (carril de iconos, `#/repaso`). Reúne lo que hay para hoy, las aprendidas y los días seguidos de
repaso, con un mapa de actividad de las últimas cuatro semanas.

**Tarjetas del glosario.** Cada uno de los 1 054 términos es una tarjeta: delante el término, detrás la definición
del glosario y los enlaces «En el libro» a sus secciones. Con «Tarjetas inversas» se estudia también al revés (de
la definición al término: 2 108 tarjetas). Mazos: todo el glosario, por tomo, por capítulo o apéndice y por tema.
Tras ver la respuesta se elige **Otra vez · Difícil · Bien · Fácil**; cada botón dice cuándo volverá la tarjeta
(1 min, 10 min, 4 d…). El planificador es el de Anki (SM-2): las nuevas pasan por dos pasos cortos (1 y 10 min) y
después vuelven a intervalos de días que crecen con cada acierto; un fallo las devuelve a un paso corto y baja su
facilidad. Se presentan como mucho las nuevas al día que se elijan (15 por defecto). Teclado: `espacio` o `Intro`
muestra la respuesta, `1`–`4` califican (`espacio` = Bien), `Ctrl`/`⌘` `Z` deshace la última. En pantalla táctil:
tocar la tarjeta la gira; deslizar a la derecha es «Bien» y a la izquierda «Otra vez».

**Tests por capítulo.** 1 118 preguntas (de 10 a 20 por capítulo y de 5 a 12 por apéndice), de opción múltiple y
numéricas (con coma decimal y tolerancia). Los distractores recogen los errores contra los que el libro previene.
Cada respuesta se corrige al momento con la explicación, la **cita literal del libro** y el enlace «Ver la
sección…» (o «Ver el problema…») de donde sale. Al final, la puntuación y la lista «Para repasar»; los fallos
quedan en **«Repasar fallos»** hasta acertarlos. El **examen mixto** saca 10, 20, 40 o 60 preguntas al azar de los
capítulos elegidos. Al final de cada capítulo del lector hay un botón **«Test del capítulo»**. Teclado: `1`–`5` o
`A`–`E` eligen, `Intro` pasa a la siguiente.

**Fidelidad.** Las preguntas están en `contenido/repaso/<capítulo>.json`; `contenido/repaso.py` (lo llama
`generar.py`) no publica nada si una cita no aparece literalmente en la sección del libro a la que remite, si una
referencia no existe o es de otro capítulo, o si el número de una pregunta numérica no está en su cita. Pruebas:
`tests/repaso.spec.ts` (capturas en `tests/capturas/repaso-*.png`).

**Preguntas (0.9).** Los tests, el examen y «Repasar fallos» usan la misma pregunta que las lecciones, como en la
maqueta aprobada: barra de progreso por segmentos con «3/8», opciones A–D (o el número con su unidad), corrección al
momento con icono y palabra («Correcta», «Tu respuesta»; nunca solo color), la explicación, la **figura del libro**
cuando está junto a la cita (la que cita el párrafo citado o la más cercana, sin cruzar un subapartado; si no la
hay con seguridad, no se pone), la cita «Del libro · Sección 5.2» y «Probar otra vez». Abajo, «Ver la sección 5.2»
y «Continuar». Solo cuenta la primera respuesta: «Probar otra vez» es para aprender, no cambia la nota.

## Estudiar por pasos (0.9)

El botón discreto con huellas junto a las herramientas de cada sección del lector, bajo el marcador
(`#/leccion/<capítulo>/<sección>`)
abre la sección como una **lección**, a pantalla completa y en una columna de unos 640 px en el ordenador, la tableta
y el teléfono:

- **Pasos automáticos «por subapartados»**: cada subapartado (`===`) es un paso, y el texto anterior al primero, si
  lo hay, es el paso «Introducción». Las 109 secciones sin subapartados se reparten en sus `====` o, si no tienen,
  en tramos de una pantalla aproximada (unos 2000 caracteres; nunca se corta tras un párrafo que termina en «:»).
  Un subapartado muy largo (el 1 % de ellos) sigue en pasos «Continuación». Funciona en las 754 secciones.
- **Cada paso es una pantalla**: cerrar, barra por segmentos con «n/N», «Capítulo 5 · Diodos · 5.2 …», «Paso 4» y
  el título del subapartado, y el texto con los mismos bloques del lector (figuras y figuras vivas, ecuaciones con
  «Calcular», tablas, deducciones, cajas, «Simular», «Ver animación»…). Abajo, «Atrás» y «Continuar»; teclado: `→`
  o `Intro` sigue, `←` vuelve, `Esc` cierra.
- **Preguntas**: tras el último paso, las de Repaso cuya referencia es esa sección (o algo dentro de ella: un
  subapartado, un problema), una por pantalla. **Resumen**: «Sección completada», que la marca como leída, con
  «Siguiente sección» (su lección) y «Volver al libro».
- **Historial**: la lección es una sola entrada; cada pantalla reemplaza la dirección (al recargar se vuelve a la
  misma), así que «Atrás» del navegador o de Android sale de la lección a donde se abrió.
- **Progreso**: pasos hechos, último paso y lecciones completadas por sección (clave `lecciones`, sincronizada); cada
  paso y cada pregunta cuentan para el objetivo diario y la racha de la portada.

1.0: el `Intro` que sigue a una respuesta numérica (dada también con `Intro`) hace continuar siempre; antes, si llegaba
antes de que el navegador quitara el foco del campo ya desactivado, se perdía (el fallo intermitente de la lección de 5.2
en las pruebas).

Revisión 11a (pendiente de la 1.0): el avance de las lecciones se **une** entre dispositivos y pestañas (las tarjetas
hechas se suman, la primera compleción se conserva, la última pantalla es la más reciente): abrir en el teléfono una
lección que ya se completó en el ordenador ya no borra la compleción ni las tarjetas hechas. Pruebas:
`tests/revision11a-unidad.spec.ts` (con dos dispositivos reales del motor de sincronización, escenario `r11a·1`).

Pruebas: `npx playwright test -c playwright.leccion09.config.ts tests/leccion09.spec.ts` (compilación propia,
puerto 4311); capturas en el Mac, la tableta y el teléfono, en claro, oscuro y sepia:
`node tests/leccion09-capturas.mjs` → `tests/capturas/lavado09/leccion/`.

## Ampliaciones del libro (1.1)

> **1.2: ya están en el libro.** La edición 4.0 trae las diez ampliaciones y la 4.1 da a los dos capítulos nuevos sus
> identificadores definitivos (`cap55`, `cap56`), así que `generar.py` ya no las fusiona ni las marca «Aún no en el
> libro»: el contenido sale del libro como el resto. Lo que solo tenía la capa pasó a las fuentes propias de la
> aplicación (preguntas de repaso a `contenido/repaso/`, respuestas y pistas de sus ejercicios a
> `ejercicios_curado.txt`, la práctica de la antigua 32.13 a `contenido/practica_retirada.json`) y la renumeración de
> las citas de las fuentes curadas (`renumerar_fuentes`) la sigue llamando `generar.py`. Lo que sigue describe la capa
> tal como era (la carpeta `contenido/ampliaciones11/` se conserva como historia). Sus pruebas de la capa
> (`tests/ampliaciones11-*.spec.ts` y `playwright.ampliaciones11.config.ts`) se han retirado en la 1.2; lo que seguía
> teniendo sentido está en `tests/sync41-ampliaciones-unidad.spec.ts` (con `playwright.sync41.config.ts`, sin
> navegador): los 90 ejercicios de las diez ampliaciones y los 31 nuevos de la 4.1 son del libro, se comprueban solos,
> con dos pistas y sus respuestas aceptadas; las 116 netlists validadas y enlazadas; las preguntas de repaso con su id;
> las secciones nuevas con su número impreso. Lo que se describe a continuación sobre las pruebas es historia.

Los autores escriben ampliaciones del libro (secciones nuevas, problemas, ejercicios, un capítulo entero) en Typst, con
sus figuras, netlists, preguntas de repaso y los datos de los que salen sus números. La aplicación las trae ya, marcadas
con «Aún no en el libro», y deja de traerlas en cuanto el libro las incluye. Hoy son diez (numeración de la app, con
los dos capítulos nuevos):

| Id | Qué | Dónde (numeración nueva) |
|---|---|---|
| P01 | Sistemas trifásicos | sección 23.10 (el resumen pasa a 23.11), figuras 23.17–23.22, ejercicios 23.9–23.16 |
| P02 | Máquinas eléctricas y accionamientos | **capítulo nuevo 34** tras «Electrónica de Potencia» (33); **absorbe la antigua 32.13** (véase abajo) |
| P03 | Automatismos y autómatas programables | **capítulo nuevo 31** tras «Control y Comunicaciones» (opción A) |
| P04 | Inversores y rectificadores controlados | secciones 33.10–33.11, problema 33.D, ejercicios 33.9–33.16, cinco fórmulas en la tarjeta |
| P05 | Análisis y compensación clásicos del lazo | secciones 30.10–30.12, problema 30.D, ejercicios 30.9–30.17 |
| P06 | Modelado de sistemas físicos y simulación por diagramas de bloques | sección 30.15 (tras P05), figuras 30.27–30.30, ejercicios 30.18–30.25 |
| P07 | Instalaciones y protecciones de baja tensión | sección 48.8, figuras 48.14–48.17, ejercicios 48.6–48.13 |
| P08 | Álgebra lineal y métodos numéricos | final de 0.12 (autovalores, figura 0.13) y **sección nueva 0.13**; las 0.13–0.21 pasan a 0.14–0.22; ejercicios 0.11–0.19 |
| P09 | Ecuaciones de Maxwell | sección nueva 37.1 al principio del capítulo (las demás suben una), figuras 37.1–37.3, ejercicios 37.6–37.14 |
| P13 | Comunicaciones industriales | secciones 45.6–45.7, problema 45.D, ejercicios 45.6–45.14 |

Con los dos capítulos nuevos, los impresos 31–32 pasan a 32–33 y los 33–53 a 35–55. Unas citan a otras por etiqueta:
P02 a P01, P03 y P04; P03 a P13 y P01; P06 a P05; P07 a P02 (si se quita una, hay que quitar las que la citan).

`contenido/ampliaciones.py` convierte cada pieza con el propio conversor de la app (`typst_parser.py` y `convertir.py`,
sin cambios), la inserta donde dice su `ampliacion.json` y **renumera**: las secciones, figuras y ejercicios que van
detrás, y todos los capítulos que siguen a un capítulo nuevo, en los títulos, las referencias de todas las partes, el
índice, la búsqueda, los repasos, el simulador y las fórmulas. Las **claves de almacenamiento no cambian** (los ficheros
`capNN` y las etiquetas del libro son los de siempre; los capítulos nuevos tienen las suyas, `cap-new-automatas` y
`cap-new-maquinas`), así que el
progreso guardado sigue valiendo y no hace falta migración. Además: las figuras (las SVG con la paleta de la identidad,
convertidas como las del libro, con el texto en trazos), las ecuaciones (Typst), los ejercicios con sus soluciones y sus
respuestas autocomprobables (sacadas de `datos/` de la ampliación y comprobadas contra el texto de la solución), las
preguntas de repaso (con las reglas de `repaso.py`), la búsqueda, el glosario (los términos que la ampliación trata
enlazan a su sección), las netlists (validadas en el ngspice de la aplicación; se abren en el simulador, el editor y la
protoboard como las del libro) y las lecciones «Estudiar por pasos» de cada sección nueva, que salen solas. Las citas de
las fuentes curadas que dan un número impreso («sección 31.10») se renumeran por etiqueta (`numeracion.json`).

Cuando el autor pegue una ampliación en el libro y regenere, gana la del libro: cada sección, problema, ejercicio,
capítulo, línea de tarjeta, pregunta o netlist que el libro ya tenga se omite, sin duplicados (también si solo pega una
parte). El paso es idempotente y reversible: cada ejecución deshace primero la anterior.

Revisión 11a (lo que el lector ya tiene guardado no se mueve al pegar ni al insertar): los ejercicios de «ordenar los
pasos» se identificaban por la posición de su lista en la parte, que una ampliación desplaza; ahora su id sale del
registro `contenido/ids_practica.json` (huella de la lista → el id con el que se publicó: todos los de la 1.0 y la 1.1)
o, si no está, de la posición contando solo los bloques del libro. Antes de publicar contenido nuevo hay que registrar
sus ids: `node web/scripts/practica10.mjs --registrar-ids` (la cadena avisa de los que faltan). Los ejercicios nuevos
de los capítulos 22, 25 y 35 llevan en `ejercicios_nuevos.py --typst` su apartado «Para el curado» completo (los
«porque N:» de cada opción incorrecta y las preguntas de diseño como `? diseno: {JSON}`): pegado al curado junto con el
Typst, el ítem del libro es el mismo y las respuestas guardadas siguen valiendo. La página de marcadores muestra el
número impreso actual de lo marcado. Pruebas: `tests/revision11a-unidad.spec.ts` (Node) y
`tests/revision11a-navegador.spec.ts` (navegador).

```sh
python3 contenido/ampliaciones.py               # todo; sin las fuentes del libro, también ejercicios.py, pasos.py y la cadena de Node
python3 contenido/ampliaciones.py --comprobar   # convierte y comprueba, no escribe nada
python3 contenido/ampliaciones.py --deshacer    # el libro tal como se generó
python3 contenido/ampliaciones.py --importar /ruta/P02   # copia una ampliación nueva y escribe el esqueleto del manifiesto
```

**P02 absorbe la antigua 32.13** («Ampliación: Máquinas Eléctricas y Accionamientos»): todo su contenido está en el
capítulo 34, con el mismo motor y las mismas cifras. Mientras P02 está fusionada, una pieza `retirar` de su manifiesto
saca de `cap33` los 26 bloques de esa sección y cinco fórmulas de motores de la tarjeta (la tarjeta se queda, al final
de 33.14), y lo de detrás vuelve a numerarse. Lo guardado no se pierde ni se reescribe, y todo vuelve al deshacer:

- **La etiqueta sigue existiendo**: `sec-33.13` queda en `refs.json` como alias de `sec-new-maquinas.3` (lleva a 34.3),
  así que un marcador, una nota, un enlace antiguo, «Continuar» o la ruta de su lección de la 1.0 (`#/cap33/sec-33.13`,
  `#/leccion/cap33/sec-33.13`) abren donde está ahora su contenido.
- **Cada referencia a la 32.13 va a su tema**: la del BLDC de 36.5 y el «Motor paso a paso» del glosario, a 34.5; el
  arranque directo de P03, a 34.4; el variador y la ley V/f de P04, a 34.6; el motor de continua de P06 y la fuerza
  contraelectromotriz y el par del glosario, a 34.3.
- **Mismos identificadores**: la pregunta de repaso `cap33-18` (V/f, su historial de repaso sigue) cita 34.6; la netlist
  `cap33/sec-33.13_motor_cc` (su estado guardado y la figura viva) se ve en 34.3; los cuatro ejercicios de práctica de
  la 1.0 de esa sección (`cap33-num-velocidad-sincrona`, `cap33-num-ley-v-f`, `cap33-num-ej-33.1`,
  `cap33-parejas-sec-33.13`) siguen publicados con su id (`contenido/ampliaciones11/P02/practica-retirada.json`, con los
  números al día), así que lo respondido, los XP y el dominio siguen teniendo su ejercicio. La compleción guardada de
  la lección de la 1.0 de 32.13 se conserva tal cual, pero ya no cuenta en el curso: la sección no está en el índice.
- Si el autor pega P02 en el libro y quita la 32.13, la etiqueta desaparece del libro; mientras otra ampliación aún sin
  pegar la cite (P06), sigue como alias, sin entrada del libro.

**Las lecciones 1.1 citan bloques del libro por su índice** (`libro:` de `contenido/lecciones11/…`), y una ampliación
que inserta bloques delante los desplaza (P08 mete 41 antes de la 0.13). El generador encuentra cada bloque por su cita
literal: el índice escrito si aún la contiene; si no, el único bloque (de la sección, para un número suelto) que la
contiene; si son varios, el que dice el desplazamiento de las demás citas de la lección. Así una lección sigue valiendo
con la ampliación, sin ella y cuando el autor la pega. Los índices de las lecciones de `cap00` ya son los del libro con
P08. La lección nueva de la 0.13 (`cap00/sec-new-0-numericos`, 11 tarjetas: el diodo sin fórmula, el primer paso de
Newton desde 0 V, cada paso un circuito lineal, la matriz de nodos, los picoohmios, el condensador como conductancia
C/h, el paso más largo de Euler explícito, por qué SPICE limita el paso y los tres métodos anidados) y cuatro tarjetas
de la 0.12 (los modos de dos etapas RC, 26,2 y 3,82 ms; la salida al 63 %; el arranque de un oscilador; traza y
determinante) siguen la propuesta de P08. Necesitan P08: sin ella, el generador dice qué citas le faltan y no escribe.

**Pistas** de los ejercicios de las ampliaciones: de su propia solución, la primera sustitución («Empiece por: I₀ =
10⁻¹²·(e^0,6/0,02585 − 1).») y el primer resultado intermedio, nunca uno de los valores que se comprueban.

**Añadir una ampliación** es un paso de datos: `--importar` la carpeta que entregan los autores (copia
`<ID>.typ`, `figures/identidad/*.svg` o `figures/*.svg`, `spice/*.cir`, `app/repaso-*.json` y `datos/*.json`; volver a
importarla actualiza esos ficheros y conserva el manifiesto) y completar su `ampliacion.json` con lo que dice su
`NOTAS.md` (dónde va cada `PARTE`, el título en español de cada netlist y sus etiquetas, las respuestas de cada
ejercicio con su clave en `datos/`, los términos del glosario, lo que retira del libro); `--comprobar` dice lo que
falta. Ojo al reimportar: las correcciones hechas aquí a sus ficheros (tolerancias de repaso de P02, P03 y P09, que
venían en valor absoluto) hay que repetirlas. El formato está en ESQUEMA.md («Book expansions»). Después, `node
web/scripts/practica10.mjs --registrar-ids`. Pruebas: `EPA_SIN_SERVIDOR=1 npx playwright test -c
playwright.ampliaciones11.config.ts tests/ampliaciones11-unidad.spec.ts` (conversión, fusión, numeración con los dos
capítulos nuevos, P02 retirando la 32.13 y deshaciéndolo, idempotencia, deshacer byte a byte, partes no tocadas
idénticas, el libro ya las trae —todas, o P01–P04 y P13—, citas, respuestas y pistas, netlists, repaso, las lecciones
de `cap00` con P08 y sin ella) y, con navegador, `tests/ampliaciones11-navegador.spec.ts` (capítulos y secciones nuevos
marcados, un ejercicio resuelto, un circuito en el editor, la 32.13 que abre la 34.3, la lección de la 0.13, los números
de la app al día, axe en claro y oscuro, 360 px); las lecciones de `cap00`, con `EPA_RECORRER='^cap00/'
tests/lecciones11-recorrido.spec.ts`.

## Lecciones hechas a mano (1.1)

Las secciones del curso «Fundamentos» (capítulos 0–6) pasan a tener lecciones escritas a mano, al estilo de la maqueta
aprobada («Divisor de tensión»): **una idea por tarjeta**, como mucho 40 palabras, un elemento interactivo en el centro
y la secuencia explorar → predecir → la regla → reto → sorpresa → por qué → resumen. En la 1.1 la tienen todas
las secciones de los capítulos 0 a 6: 100 lecciones (las 99 secciones del libro y la sección nueva de la ampliación
P08 en el capítulo 0). Las dos primeras, de referencia, fueron:
**1.4 «Asociación de resistencias»** (12 tarjetas: el divisor con R₁ y R₂ que se mueven, la predicción con el
ejemplo del libro, la fórmula viva, el reto del ejercicio 1.4 con valores E24, la carga que hunde la salida, por qué
baja, la carga mínima, el paralelo, el divisor de corriente, el método de las redes mixtas y la potencia) y **0.3
«Trigonometría y la señal senoidal»** (9 tarjetas: una senoide cuya amplitud y fase se arrastran sobre la propia curva,
el periodo de la red, del eficaz al pico, un cuarto de periodo, seno y coseno, por qué radianes, cada símbolo con su
papel). Las demás se escribieron después con la guía de autor `contenido/lecciones11/GUIA.md`.

- **Dónde se abren.** En la misma dirección de siempre, `#/leccion/<capítulo>/<sección>[/<n>]`: el icono «Estudiar
  por pasos» del libro, los nodos del camino del curso, «Continuar», «Siguiente sección» y el repaso abren la lección
  nueva cuando la sección la tiene, y la de la 1.0 si no. La de la 1.0 (el texto del libro por pasos, con sus
  prácticas y preguntas) sigue a mano en `…/clasica` (enlace en el resumen de la nueva), y sus pantallas propias
  (`practica-N`, `pregunta-N`, `fin`) la abren directamente.
- **Cómo se ve.** Tipografías Space Grotesk (títulos) e Inter (texto), que van con la aplicación (licencia OFL, sin
  internet); azul y naranja, tarjetas suaves, barra de progreso por tarjetas, lecturas grandes, avisos de acierto y de
  «por qué no». En claro, sepia y oscuro, todos con contraste AA. Desde la 1.1 el resto de la aplicación usa el
  mismo estilo (véase «Estilo visual 1.1 en toda la aplicación»).
- **Qué se hace en cada tarjeta.** Mover deslizadores (valores continuos, series E12 y E24, listas, también con un
  nombre en cada posición: los colores del código de colores se leen «rojo (2)»), conectar una
  carga, arrastrar los puntos de una gráfica, elegir una opción (teclas 1–5 o A–E, también con el foco en una opción,
  como lo deja «Volver a intentarlo»), estimar con un deslizador que
  puntúa por cercanía, ordenar pasos (arrastrando o con «Subir/Bajar») y emparejar (arrastrando la ficha a su hueco o
  eligiendo ficha y hueco). «Continuar» se abre al interactuar; cada respuesta, también la incorrecta, se explica; un
  reto da una pista según hacia dónde falla y, tras dos fallos, una ayuda más y «Saltar». La corriente se mueve más
  deprisa cuanta más hay, y se queda quieta con «reducir movimiento». Todo con el teclado (→ o Intro sigue, ← vuelve,
  Esc cierra) y con lector de pantalla (las fórmulas del libro se leen en palabras; las lecturas se anuncian cuando
  dejan de cambiar).
- **Circuitos para los capítulos 1–6.** Además del divisor y el paralelo, las lecciones pueden enseñar resistencias
  en serie, una red mixta, dos fuentes sobre un nodo (Kirchhoff y superposición, con cada fuente apagable), el puente
  de Wheatstone, el equivalente de Thévenin (o una pila con su resistencia interna) y el de Norton, un transformador
  con carga, la carga y descarga de un condensador y el transitorio de una bobina, RC, RL y RLC en alterna (tensiones y
  corriente frente al tiempo, o amplitud y fase frente a la frecuencia en escala logarítmica, con la resonancia), un
  tanque LC, un diodo con su resistencia (caída constante de 0,7 V o la ecuación de Shockley), un LED que brilla según
  su corriente, el regulador Zener, los rectificadores de media onda y en puente con su condensador (la forma de onda y
  el rizado), y el transistor como interruptor y polarizado por divisor. Sus curvas llevan marcas fijas (τ, la
  frecuencia de corte, f₀) y los rótulos del dibujo, sus subíndices. Todos usan los modelos del libro y todos se
  comprueban con el simulador antes de publicarse.
- **Progreso, XP y repaso**, como las lecciones de la 1.0 y con las **mismas claves**: lo completado con la 1.0 sigue
  completado, y terminar la nueva marca la misma sección. Cada tarjeta pasada cuenta para el objetivo diario; cada
  respuesta da XP una sola vez (10 a la primera, 5 a la segunda; nada si se falla dos veces) y alimenta el dominio de la
  sección, que decide el repaso espaciado («Repaso programado en 3 días» en el resumen). Si se sale a medias, la
  aplicación pregunta antes (y al volver sigue en la misma tarjeta). No se guarda nada nuevo. Revisión 11c: «Seguir en
  la lección» deja la dirección en la tarjeta que se ve (`reemplazarDireccion` de lib/ruta.svelte.ts); una dirección
  sin número de tarjeta (el «Estudiar por pasos» del libro, el nodo del camino) abre la tarjeta guardada de una lección
  a medias, en vez de la 1 (que además pisaba lo guardado); las preguntas pasadas en otra visita se ven respondidas al
  volver a ellas; y la lectura oculta de una predicción («¿? V») solo se enseña al acertar o al saltar la tarjeta, no
  con el «Por qué no» de un fallo. Las etiquetas de las gráficas y los rótulos de los esquemas crecen en el móvil hasta
  verse a 11 px o más (lib/leccion11/ejes.ts `tamMarca`, kit/Lienzo.svelte), y en la esquina del origen la primera
  etiqueta del eje x ya no pisa la más baja del eje y. Pruebas de la revisión 11c y de su arreglo (también las del
  laboratorio, los problemas de diseño, las etapas, el editor y los enlaces): `tests/revision11c-unidad.spec.ts` (Node)
  y `tests/revision11c-navegador.spec.ts` (`playwright.revision11c.config.ts`, puerto 4696).
- **También en «Práctica inteligente» y en el repaso de la sección.** Las predicciones, preguntas (opciones, estimar,
  ordenar, emparejar) y retos de cada lección nueva son ejercicios más de la práctica (`#/practicar`, y
  `#/practicar/<capítulo>/<sección>`, que es lo que abre el repaso espaciado): se responden sueltos, con su circuito o
  su gráfica, sus explicaciones y pistas, y cuentan con el **mismo id** que en la lección, así que dan XP una sola vez
  donde se respondan y suman al mismo dominio (responderla otra vez enseguida no cuenta dos veces). Las «¿por qué?»
  no salen sueltas: preguntan por la sorpresa de la tarjeta anterior. Siete secciones de los capítulos 0–2 que no
  tenían nada que responder de la 1.0 (0.10, 0.12, 0.14, 0.16, 0.17, 1.13 y 2.2) ya se pueden practicar.
- **Lector de pantalla con valores pequeños.** Los mandos dicen su valor en palabras («220 nanofaradios», «21
  nanovoltios por raíz de hercio») y `aria-valuenow` va siempre sin exponente, también al moverlos (antes volvía a
  «2.2e-7» en cuanto se movía un mando de nF o de ns).

Se escriben en `contenido/lecciones11/<capítulo>/<sección>.yaml` y las genera `node web/scripts/lecciones11.mjs`
(también `contenido/generar.py`, tras `conceptos11.mjs`), que **comprueba** cada lección y no escribe nada si hay un
error: palabras por tarjeta, una explicación por opción, que todo lo que se nombra exista en el modelo de la lección,
que cada número esté en los bloques del libro que la lección cita o lo dé el modelo, que cada cita esté literalmente en
su bloque, que los retos tengan solución y pista para cada fallo, y que los circuitos dibujados den con el ngspice de
la aplicación lo mismo que calcula la lección: en continua, en alterna y en el tiempo, en el estado inicial y en los
extremos de cada mando. Con diodos y transistores en el modelo de caída constante del libro, el simulador usa un
dispositivo real, lee lo que cae de verdad y corrige la lectura con la sensibilidad del propio modelo, así que un
error de planteamiento (β en lugar de β + 1) se detecta igual; la caída real no puede alejarse de la del libro más de
lo que este admite (± 0,1 V un diodo, ± 0,2 V un LED). Cada esquema es una carpeta de
`web/src/lib/leccion11/esquemas/` (definición y dibujo): añadir uno no toca ningún fichero común. Pruebas: `PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test
-c playwright.lecciones11.config.ts` (puerto 4671, compilación en `/tmp/claude-0/epa-motor11/dist`):
`tests/lecciones11-unidad.spec.ts` (sin navegador con `EPA_SIN_SERVIDOR=1`: contraste de los colores en los tres
temas, formato, modelo, cada regla del generador rota a propósito, el motor de las tarjetas, la elección de lección y el
generador idempotente y al día) y `tests/lecciones11-navegador.spec.ts` (las dos lecciones enteras, solo con el
teclado, arrastrando, axe en los tres temas, 360 px, movimiento reducido, el progreso de la 1.0 y el aviso al salir);
`tests/lecciones11-esquemas.spec.ts` (sin navegador: el registro de esquemas, cada esquema frente a ngspice con la
lección de catálogo `web/tests/lecciones11-catalogo/cap01/sec-1.5.yaml`, ocho modelos equivocados a propósito que el
simulador detecta, las tolerancias y las reglas nuevas del generador) y `tests/lecciones11-catalogo.spec.ts` (esa
lección en el navegador, servida desde la prueba: cada dibujo y gráfica, cada mando con el teclado, axe en los tres
temas, 360 px).
`tests/lecciones11-practica.spec.ts` (las tarjetas practicables y el índice al día, el estado en que se preguntan, y
en el navegador una sección practicada solo con su lección: dominio y XP con el id de la tarjeta, una vez).
`tests/lecciones11-recorrido.spec.ts` recorre **cada lección publicada** a partir de sus datos (paramétrico; filtre
con `EPA_RECORRER='^cap00/'`): abre cada exploración moviendo lo que pide, responde mal y luego bien cada pregunta
(con su explicación), falla y resuelve cada reto con el teclado en una posición que el modelo da por buena, estima por
los dos lados, ordena y empareja, pasa axe en cada tarjeta y repite a 360 px en el tema oscuro sin desplazamiento
horizontal. Con otra compilación: `EPA_DIST` y `EPA_PUERTO`. 1.2: también recorre los pasos de aprender haciendo a
partir del modelo: `simular` (escribe el valor bueno y espera al ngspice de la app), `banco` (compara la lectura
esperada), `ajuste` (lleva el mando a la banda), `averia` (mide, falla un sospechoso y acierta el de la primera
ronda), `dibujar` (pone cada punto en la curva con el teclado, espaciados por igual en log x si el eje es
logarítmico, como los dibuja la app) y `diseno` (como un reto, en una posición del modelo).

### Enlaces del libro impreso: códigos QR (1.1)

La maquetación nueva del libro imprime un código QR por sección con el enlace `epa://leccion/<parte>/<sección>`
(por ejemplo `epa://leccion/cap01/sec-1.4`). La aplicación lo abre en la lección de esa sección
(`#/leccion/cap01/sec-1.4`: la lección hecha a mano si la tiene, la de la 1.0 si no). Un capítulo o una sección que esta
edición no tiene, o un enlace mal formado, muestran «No se encuentra esa lección» con un botón al índice del libro;
nunca un error. El enlace se comprueba de forma estricta (solo `epa://leccion/`, un capítulo `capNN`, un apéndice
`apX` o un capítulo nuevo de las ampliaciones `cap-new-<nombre>`, una sección `sec-…`, letras, cifras, punto y guion): no puede llevar a ninguna otra parte de la aplicación ni a
ninguna dirección de fuera. Mayúsculas y minúsculas dan igual (`EPA://LECCION/APA/SEC-A.1` abre el apéndice A).
1.2 (libro 4.1): los capítulos nuevos se llaman `cap55` (31, automatismos), `cap56` (34, máquinas) y `cap57` (54,
robótica), y el apéndice K, `apK`; un QR impreso en la 4.0 con los nombres provisionales
(`epa://leccion/cap-new-automatas/sec-new-automatas.3`) abre la misma sección de la 4.1 (`cap55/sec-55.3`). Los 792
QR del libro 4.1 abren una sección de la aplicación (comprobado en `tests/sync41-unidad.spec.ts`).

Cómo probarlo en cada equipo (con la aplicación cerrada y también abierta: debe abrir la lección en la ventana que ya
está, sin abrir otra):

- **Windows.** Instale con el instalador (NSIS o MSI): es el instalador el que registra el esquema `epa` para el
  usuario; `npm run tauri dev` no lo registra. Pulse Win+R y escriba `epa://leccion/cap01/sec-1.4`, o en PowerShell
  `Start-Process "epa://leccion/cap01/sec-1.4"`. Con la aplicación abierta, Windows lanza una segunda copia que se
  cierra sola y pasa el enlace a la primera (instancia única).
- **macOS.** Copie la aplicación a Aplicaciones y ábrala una vez (así el sistema registra el esquema). En Terminal:
  `open "epa://leccion/cap01/sec-1.4"`.
- **Android.** Instale el APK (preparado con `npm run android:preparar`, que escribe el filtro del esquema en el
  manifiesto generado). Con el móvil conectado: `adb shell am start -a android.intent.action.VIEW -d
  "epa://leccion/cap01/sec-1.4"`, o escanee un QR del libro con la cámara o Google Lens y toque «Abrir».
- **Navegador.** No hay esquema propio: la misma dirección va detrás de `#`, `…/#epa://leccion/cap01/sec-1.4` (también
  `#/epa://…`), y la aplicación la cambia por la ruta de la lección.
- **Linux (paquete .deb).** `xdg-open "epa://leccion/cap01/sec-1.4"` (el AppImage no registra el esquema).

Pruebas: `tests/enlaces11-unidad.spec.ts` (sin navegador: el analizador con cada sección del libro y una lista de
enlaces maliciosos, el hash del navegador, el manifiesto de Android a partir de la plantilla de `tauri android init`, la
configuración de Tauri) y `tests/enlaces11-navegador.spec.ts` (el enlace como hash abre la lección nueva, la clásica y
un apéndice; «Atrás» no vuelve al enlace; «No se encuentra esa lección» con axe en los tres temas y a 360 px), con
`playwright.enlaces11.config.ts` (puerto 4686). La parte nativa se comprueba con `cargo check` y `cargo test --lib`
(`solo_enlaces_epa_cortos_y_ascii`); lo que solo se ve en los equipos es la lista de arriba.

## La forma de las lecciones 1.2: circuito vivo, ritmo e identidad del libro

Vale para todas las lecciones hechas a mano (también las de Fundamentos, que no cambian como datos). Toma los
principios de diseño de Brilliant (una idea por pantalla, el dibujo que se toca, el ritmo de tarjetas), nunca su aspecto.

- **Circuito vivo** (`componentes/leccion12/CircuitoVivo.svelte`). La corriente son partículas que recorren el circuito
  (el motor de las figuras vivas, `figuras-vivas/esquema/particulas.ts`): más deprisa con más corriente (escala
  logarítmica absoluta: 0,1 A a toda velocidad, 10 µA la más lenta), en el sentido de la corriente y de ida y vuelta con
  una fuente alterna. Los hilos toman el color de la tensión de su nodo (azul negativo, gris 0 V, rojo positivo) con una
  leyenda en voltios y «Ver valores», que escribe la tensión de cada nodo en el dibujo: el color nunca es la única pista.
  Las tensiones salen del propio netlist del esquema resuelto en la página (`lib/leccion12/cc.ts`, análisis nodal en
  continua; en 88 tarjetas de Fundamentos da lo mismo que el modelo de la lección, que el generador comprobó con ngspice);
  un circuito con diodos o transistores colorea solo los nodos que se saben exactos (las fuentes y masa), y los de
  alterna o de conmutación no se colorean. Una predicción no da pistas: sin colores ni leyenda, y las partículas a una
  velocidad neutra. Las partículas van solo por los hilos (fix12): no se dibujan dentro del cuerpo de una pieza (entran
  por un borne y salen por el otro), ni sobre una etiqueta o un punto de unión, con un hueco de 3 px; los cuerpos los
  declara el kit (`data-cuerpo`) y, para lo demás, se miden en el propio dibujo. Igual en las figuras vivas del libro
  (cuerpo de cada pieza entre sus `istart`/`iend`, puntos de unión y anotaciones); y en ellas el color de tensión de un
  hilo no se pinta sobre el cuerpo de una pieza de dos bornes (en 33.11 y 53.33 el libro trae un hilo a lo largo de
  toda la pieza: su halo se recorta). Ningún hilo de los 32 esquemas de las lecciones pasa por el cuerpo de una pieza
  ni bajo una etiqueta (en RLC serie y paralelo la frecuencia y Rₚ pisaban un hilo: se han movido). El LED brilla según su corriente y la lectura grande late al cambiar. Con «reducir movimiento»,
  flechas quietas en el sentido de la corriente. Solo se anima mientras el dibujo está en pantalla y la página visible;
  mide su ritmo y, en un equipo lento, dibuja la mitad de partículas a 30 fps y, si aún no llega, pasa a las flechas.
- **Tocar el esquema** (`lib/leccion12/manipular.ts`). Cada pieza cuyo valor mueve un mando de la tarjeta se arrastra en
  el dibujo (arriba o a la derecha sube; los valores son los del mando, así que se ajusta a la serie E12/E24), se toca
  para abrir «−» y «+», o se enfoca con el tabulador y se mueve con las flechas, Re Pág/Av Pág, Inicio y Fin; el lector
  de pantalla oye el valor como en el mando de abajo. Un interruptor del dibujo se abre y cierra con un toque. Las
  tarjetas de «ajuste» y «diseño» de la 1.2 lo tienen solo por usar el widget de circuito.
- **Una idea por pantalla.** Arriba el dibujo (o la fórmula), debajo el texto corto y después lo que se responde. El
  generador avisa (no para) con `lib/leccion12/una-idea.ts` de una tarjeta de más de 40 palabras, de más de dos frases o
  sin nada que mirar; en Fundamentos hoy daría 407 avisos en 1149 tarjetas (293 de preguntas solo con opciones): es
  trabajo de los redactores.
- **Ritmo** (`lib/leccion12/ritmo.ts`). Barra de progreso por tramos, «Continuar» fijo abajo y abierto al interactuar
  (como en la 1.1), las tarjetas entran deslizándose (sin movimiento con «reducir movimiento»), un toque corto de
  vibración y sonido en cada comprobación (también en las que ya no cuentan; en el escritorio no vibra) y **las tarjetas
  falladas vuelven al final**: las que fallaron a la primera o se saltaron se repiten una vez, frescas, antes del
  resumen, con sus propios tramos en la barra y «Repaso» como fase. Empiezan con los valores que tenían la primera vez y
  son una ronda nueva para el repaso espaciado (si en su primera ronda no dieron XP, la dan ahora). No se guarda nada
  nuevo: al recargar, la visita es normal.
- **Mapa del curso** (`componentes/cursos/Camino.svelte`). El camino de nodos (con la vista de lista para el teclado y
  los lectores) muestra cuatro estados con su leyenda: por hacer, en curso, hecha y **dominada**. «Dominada» es una
  lección hecha cuya sección está en el nivel «Dominado» del dominio y no tiene el repaso pendiente
  (`dominadaDe`, `lib/aprendizaje/camino.ts`); si se olvida o le toca repaso, vuelve a «hecha» hasta repasarla. El
  resumen de la lección lo dice («Sección dominada») junto a la celebración de siempre.
- **Identidad de la edición 4.0/4.1** (`estilos/tokens11.css`, `estilos/fuentes12.css`). Inter para el texto, Space
  Grotesk para los títulos y JetBrains Mono para el código (OFL, de las fuentes del libro, 400 y 700, recortadas a 11 KB
  cada una, sin ligaduras); la tinta #1B1F27, los grises de la plantilla y los cinco colores de serie (azul #2457D6, rojo
  #B3261E, verde #1C7A4B, violeta #6A45C0, naranja #D9661C) en claro, sepia y oscuro; los hilos de los circuitos en el
  color del bloque del capítulo (un tono oscuro de él, para no confundirse con las piezas). Contraste comprobado por
  script: cada par de tokens ≥ 4,5:1 (texto) o ≥ 3:1 (gráficos), cada paso de la escala de tensiones ≥ 3,26:1 sobre el
  panel y los hilos de los seis bloques ≥ 6,98:1.

Pruebas: `tests/lecciones11-ui12-unidad.spec.ts` (sin navegador: ritmo, «dominada», contraste, el solucionador frente a
cada tarjeta de circuito publicada, manipulación, una idea) y `tests/lecciones11-ui12-navegador.spec.ts` (partículas,
colores y valores, arrastre, toque y teclado, predicción sin pistas, vibración, leyenda del mapa, axe en oscuro, reducir
movimiento y el ritmo con la CPU 4× y 6× más lenta), con `playwright.lecciones11.config.ts`. Lo que solo se ve en los
equipos: la fluidez en el Android (el elemento del circuito dice `data-vivo-fps` y `data-vivo-nivel`) y la vibración.

## Aprender haciendo en las lecciones (1.2)

Las lecciones hechas a mano tienen, además de las tarjetas de la 1.1, **pistas escalonadas** en cada pregunta
(«Pista», «Otra pista», «Ver la solución»; los peldaños abiertos cuentan como ayuda en el dominio) y **siete pasos
nuevos** para aprender haciendo, que el autor escribe como datos (guía: `contenido/lecciones11/GUIA.md` §10; ejemplos
probados: `web/tests/lecciones12-catalogo/cap01/sec-1.4.yaml`):

- **Prediga y simule** (`simular`): se escribe una estimación con su unidad, se fija y el ngspice de la app simula el
  circuito; se ve el error relativo y su causa (los errores típicos de la tarjeta: olvidar la carga, pico por eficaz;
  o un prefijo equivocado, el signo).
- **Diseñe** (`diseno`): valores E12/E24 para una especificación con tolerancia; se comprueba el diseño nominal y con
  las tolerancias de las piezas (todas las esquinas o placas de Monte Carlo con semilla), con su informe.
- **Busque la avería** (`averia`): una avería escondida (abierta, corto, otro valor, al revés), un multímetro virtual
  (y un osciloscopio en alterna) con medidas que cuestan pasos, y nombrar la pieza; un sospechoso equivocado se
  explica con las propias medidas. El dibujo no delata la avería (fix12): hasta encontrarla (o saltar la tarjeta)
  enseña los valores nominales de la placa sana («R₂ 5 kΩ», no «1 GΩ»; también en la descripción para lectores de
  pantalla) y se comporta como una predicción: sin lectura, sin colores de tensión, leyenda ni «Ver valores», y las
  partículas a velocidad neutra. Al acertar se ve la placa averiada con sus tensiones; «Otra placa» la vuelve a ocultar.
  Solo las sondas miden la placa averiada.
- **Ajuste** (`ajuste`): un mando hasta que una medida entre en su banda, con un medidor en vivo.
- **En el banco** (`banco`, opcional): piezas, qué medir y lo que debería dar; se escribe lo medido y la app compara y
  aconseja, con la ficha del cuaderno de prácticas.
- **Dibuje la forma de onda** (`dibujar`): con el dedo, el ratón o el teclado; se compara con la curva del modelo con
  una medida de error que perdona un pequeño desfase y un pequeño escalón, y se superpone la buena. El eje x puede ser
  logarítmico (`escala: log`, un Bode frente a la frecuencia): los puntos van espaciados por décadas y el desfase que se
  perdona es una fracción del eje en esa escala.
- **SQL** (`sql`, sección 17.10): SQLite en WebAssembly (sql.js 1.14.2, licencia MIT, unos 700 kB que solo se cargan al
  abrir una tarjeta SQL), una base de ejemplo con el esquema del libro y datos generados por la app; escribir la
  consulta, rellenar sus huecos u ordenar sus cláusulas, ver la tabla y los errores explicados en español.
- **Figuras con zonas y electrónica digital (1.2, motor12c)** (guía: `contenido/lecciones11/GUIA.md` §11; ejemplos
  probados: `web/tests/lecciones12-catalogo/cap29/sec-29.2.yaml`):
  - widget **`figura`**: una figura o foto del libro, o una foto de placa del explorador «Consolas» (sus piezas ya
    identificadas, `hotspots`, son zonas), con zonas que se tocan; se amplía con «+ / −» o con dos dedos y las zonas son
    también una lista de botones (teclado y lector de pantalla). Paso nuevo **«Toque»** (`tocar`): toque el defecto o
    la pieza; cada zona equivocada se explica y queda tachada.
  - widget **`logica`**: un circuito digital vivo (puertas AND, OR, NOT, NAND, NOR, XOR, XNOR; biestables D, JK y T;
    contador, multiplexor y decodificador; interruptores, reloj con «Pulso» y LED), simulado en la página por eventos y
    de forma determinista, dibujado solo y con cada cable del color de su nivel (y su «1»/«0» escrito); con su
    **tabla de verdad** (fila actual marcada) o su **cronograma** (un cursor que lleva el circuito a cada momento).
  - pasos sobre el circuito: predecir la salida (LED «?»), **«Tabla de verdad»** (`tabla`, rellenarla), **buscar la
    avería con la sonda lógica** (salida atascada a 0 o a 1, entrada al aire que el TTL lee como 1), **diseñar** una
    función con el mínimo de puertas (el generador demuestra que no hay un circuito más pequeño) y **dibujar** una señal
    en modo digital, tramo a tramo y ajustada a los flancos del reloj.
  - De paso: los nombres de un mando de lista admiten cifras («Sn63Pb37», «0805»), y el generador avisa de un widget
    oculto sin lectura y de una estimación que empieza en el extremo más alejado; no avisa de pocas medidas en una
    avería por bisección (`adaptativa: true`).
  - Pruebas: `tests/lecciones12-digital-unidad.spec.ts` (simulación, dibujo, generador y motor, en Node) y
    `tests/lecciones12-digital-navegador.spec.ts` (cada tarjeta con teclado y ratón, axe; 360 px en oscuro y sepia).
- **Esquemas nuevos (1.2, motor12b)**, a petición de los autores de Análisis de circuitos (catálogo en
  `contenido/lecciones11/GUIA.md` §5.4): `fuente-controlada` (una tensión de control manda una fuente dependiente,
  dibujada como un rombo: VCCS g_m·v con r_o en paralelo o VCVS A_v·v con r_o en serie, y su carga; secciones 22.11 y
  22.8), `fuente-corriente-y-tension` (el circuito de la figura 22.9: 12 V con 4 Ω, 3 Ω y 2 A entre los mismos
  terminales), `sallen-key` y `sallen-key-alto` (paso bajo y paso alto de ganancia unidad, sección 24.5; el operacional
  ideal o, con `gbw` y `rsal`, con un polo y resistencia de salida, para ver lo que deja pasar muy por encima del corte).
  Piezas nuevas del kit: `FuenteDep` (rombo con flecha o ±) y `AO` (operacional). Cada uno tiene su tarjeta en la
  lección de catálogo de las pruebas, comprobada con ngspice (`tests/lecciones11-esquemas.spec.ts`) y recorrida en el
  navegador (`tests/lecciones11-catalogo.spec.ts`, `tests/lecciones12-fix12.spec.ts`: ningún hilo bajo una pieza o una
  etiqueta y ninguna partícula sobre ellas). Con ellas la lección de catálogo pasó de 50 tarjetas y destapó un fallo de
  la cabecera de las lecciones: a 360 px los huecos de 5 px entre los segmentos de la barra de progreso empujaban
  «Cerrar la lección» fuera de la pantalla; con más de 24 tarjetas los huecos son de 2 px.
- **Esquemas nuevos (1.2, esquemas12)**, a petición de los autores de Analógica (cap07, cap08) y de Análisis (cap24,
  cap42), en `contenido/lecciones11/GUIA.md` §5.4 bis: `mosfet` (canal N con R_D, R_G, R_GS y R_S; la ley cuadrática del
  libro es el LEVEL=1 de ngspice con KP = k y VTO = V_th; puerta continua o PWM), la familia del operacional
  (`ao-no-inversor` con el seguidor, `ao-inversor`, `ao-sumador`, `ao-integrador`, `comparador-schmitt`) con un solo
  modelo de operacional documentado (A₀ = 10⁵, raíles sin «wind-up», un polo de GBW, slew rate; en continua, la parte
  lineal de su región, así que el circuito vivo colorea los hilos también con operacional), `regulador-lineal`
  (elemento de paso ideal, referencia, divisor y dropout; mide la potencia del paso), `ne555-astable` (con sus dos
  comparadores, el biestable y el transistor de descarga dibujados), `muestreo-retencion` (adquisición, pedestal Q/C y
  caída I/C), `rlc-escalon` (respuesta de segundo orden), `trifasica` (estrella con el neutro conectado o cortado, o
  triángulo) y `transformador-real` (magnetizante y dispersión: la banda pasante); `rlc-serie` mide además su impedancia
  (`z_amp`, `z_fase`: un condensador de desacoplo con ESR y ESL). Piezas del kit: `Mosfet` (N o P, con diodo interno),
  `Entrada` (la fuente de entrada: pila o senoidal), `EtiquetasAO`; `AO` con patillas de alimentación opcionales y
  `FuenteI` que puede apuntar hacia abajo. La comparación con ngspice admite, en los esquemas de conmutación, que un
  salto del modelo caiga un paso de tiempo antes o después (± 0,15 % del eje; ± 0,4 % en el 555), y en una curva con eje
  `y` logarítmico la tolerancia ya no es el 0,01 % de la altura del eje (con una impedancia de 0,01 Ω a 10 kΩ, 1 Ω, más
  que todo el valle del desacoplo). Pruebas: la lección de catálogo (272 comprobaciones con ngspice),
  `tests/lecciones12-esquemas12.spec.ts` (cada esquema frente a los valores del libro: 139/263/331 V del neutro cortado,
  687 Hz del 555, ±1,09 V del Schmitt…), `tests/lecciones12-fix12.spec.ts` (cada esquema registrado tiene su tarjeta
  dibujada; ningún hilo bajo una pieza y ninguna partícula sobre ella). El recorrido de las lecciones
  (`tests/lecciones11-recorrido.spec.ts`) toca los interruptores cuando una tarjeta no tiene deslizadores bastantes, y
  la primera estimación equivocada nunca es la posición de partida.
- **Esquemas nuevos (1.2, esquemas12b)**, a petición de Taller (cap15), en `contenido/lecciones11/GUIA.md` §5.4 bis:
  `mosfet` con **carga inductiva** (`l` en serie con R_D, la avalancha `bv` y el diodo de rueda libre `vf` con su
  interruptor `rueda`: el pico al apagar con y sin diodo, sección 4.5; la bobina parte de la corriente de conducción y
  se extingue en el t = (L/R)·ln(1 + I·R/V) del libro), `rectificador-toma-media` (secundario 15-0-15 con la toma media
  a masa, un diodo por rama, un condensador por raíl para ±V, carga resistiva o de corriente constante y 78xx/79xx
  opcionales con su dropout: los 20,5 V y el rizado de la sección 14.2) y `lm3914` (escalera de diez resistencias, diez
  comparadores, salidas de corriente 10·V_ref/R_ref, modo barra o punto y la disipación del integrado: los 400 mW de la
  sección 14.4); y `ao-no-inversor` documentado como bloque de ganancia con recorte (el LM386 de la sección 14.3,
  ganancia 20 o 200). Sin la bobina, la netlist de `mosfet` es la de antes (las lecciones que ya lo usan no cambian).
  Pruebas: cinco tarjetas más en la lección de catálogo (292 comprobaciones con ngspice) y tres en
  `tests/lecciones12-esquemas12.spec.ts`.
- **Una prueba que fallaba a veces (fix12, «espejo»).** La prueba de las partículas medía cada pieza por la caja que
  envuelve su trazo fuera de los hilos con corriente; la carga del espejo cuelga del hilo de arriba en una T, así que su
  caja era tan ancha como el zigzag y llegaba a 3 unidades del hilo, y una partícula que pasaba junto a la T, a 7
  unidades del trazo, encendía 6–7 px «dentro» (107 de 8 436 posiciones en 200 cuadros, ninguna sobre el trazo): según
  el momento muestreado, fallaba o no. Ahora la tinta de cada pieza se mide trazo a trazo (media anchura + 0,5); las
  zonas entre trazos siguen siendo los cuerpos declarados y las formas cerradas. Cinco repeticiones seguidas pasan.

Todo se comprueba al generar (una regla rota es un error que dice tarjeta y motivo: retos sin solución con tolerancias,
averías que no se distinguen, consultas que dependen del día…), y las averías se simulan con ngspice como cualquier
otro estado. Los números son deterministas (semillas fijas). No cambia nada de lo guardado: ni claves nuevas ni
migración; el formato de las lecciones sigue en la versión 1 (`ESQUEMA.md`, «Learning-by-doing steps»).

Pruebas: `tests/lecciones12-unidad.spec.ts` (sin navegador) y `tests/lecciones12-navegador.spec.ts` (la lección de
catálogo de punta a punta, axe y 360 px), con `playwright.lecciones12.config.ts` (puerto 4312).

## El libro 4.1 en la aplicación (1.2)

La aplicación es un espejo de la edición 4.1.0 del libro: todo `web/public/libro/` (y `proyectos/`, `fm7303/`,
`miniaturas/`) sale de sus fuentes (`EPA_FUENTES`, «Generar el contenido»). Con la 4.1 hay 72 partes (57 capítulos, 11
apéndices, glosario y tres anexos), 804 secciones, 2 702 etiquetas numeradas, 1 057 figuras (952 dibujos y 105 fotos),
1 076 ecuaciones, 1 054 términos de glosario, 637 ejercicios y problemas (518 + 119; 632 autocomprobables), 442
netlists, 1 118 preguntas de repaso y 670 ítems de práctica. La numeración impresa coincide con la del libro etiqueta por
etiqueta (`figuras/numeros.json`, 0 diferencias). Los tomos (títulos y reparto, con los capítulos que cambiaron de tomo)
salen de `tomos.json` y `tomos_titulos.json`; la aplicación no los tiene escritos en ningún otro sitio.

- **Identificadores definitivos.** Los capítulos nuevos de la 4.0 dejan los provisionales: `cap-new-automatas` →
  `cap55` (capítulo 31), `cap-new-maquinas` → `cap56` (34), con sus etiquetas (`sec-55.N`, `fig-`, `ej-`, `prob-55.A`) y
  las preguntas de repaso (`cap55-01`…). Lo que el lector guardó con la 1.1 se migra al arrancar (`lib/esquemas.ts`,
  «Data 1.0» de ESQUEMA.md): lectura, marcadores, notas (su texto no se toca), ejercicios, lecciones, XP, dominio,
  repaso, circuitos del editor, cursos propios y el estado de la sincronización, con copia previa de los originales. El
  fichero de sincronización pasa al **formato 3**: un equipo con la 1.1 ya no puede escribirlo y pide actualizar.
  **Sincronice cada equipo justo antes de actualizarlo a la 1.2.** Un QR impreso con los nombres provisionales abre la
  sección de la 4.1.
- **Contenido nuevo.** El capítulo 54 de robótica (`cap57`) en «Proyectos completos» (no en «Potencia y energía»: es un
  sistema entero, no electrónica de potencia); el apéndice K (C para sistemas empotrados, `apK`) cierra «Digital y
  programable», donde está también la sección 39.16 de ensamblador (`cap38`); las secciones nuevas 17.10 (SQLite), 30.17
  (control muestreado), 48.4 (GUM), la 30.16 ampliada y lo añadido a 34.5 salen solas en su capítulo. 42 preguntas de
  autoevaluación del paratexto del libro son ya preguntas de repaso (apK 6, 39.x 2, cap55 6 + 6, cap56 6 + 6, cap57 10;
  con `"paratexto": true` cuando el número de la respuesta solo lo escribe la solución del paratexto, `repaso.py`).
- **Lo que hacía la capa de ampliaciones de la 1.1**, ya en las fuentes propias (véase «Ampliaciones del libro»): sus
  preguntas de repaso, las respuestas y pistas de sus 90 ejercicios (en `ejercicios_curado.txt`, como las de los 30
  ejercicios nuevos de la 4.0 con su «Para el curado»), el título, las etiquetas y la descripción en español de sus
  netlists (`contenido/spice_curado.json`, 126, también las 10 nuevas de la 4.0/4.1 sin etiquetas en su cabecera) y las
  cinco fórmulas de motores (`formulas_cat3.py`, ahora en `cap56`). La pregunta `cap33-18` (V/f) conserva su id y cita la
  34.6 (`"retirada": "sec-33.13"`).
- **Ejercicios curados (1.2).** Los 31 ejercicios nuevos de la 4.1 (17.9–17.11, 30.26–30.29, 34.10, 39.6–39.8,
  48.14–48.16, el capítulo 54 y el apéndice K), que solo tenían lo que sacaba el analizador, y 59 de los 90 de las
  ampliaciones de la 1.1 que se habían quedado en «comparar con la solución» o con menos de dos pistas, tienen ya su
  entrada en `ejercicios_curado.txt`: respuestas con unidad y tolerancia, preguntas de elegir o clasificar con el «por
  qué no» de cada opción, la cita literal de la solución y dos pistas. Cada valor se ha recalculado (NumPy, SciPy para
  la t de Student, aritmética entera de 16, 32 y 64 bits para el apéndice K). Quedan 632 de 637 autocomprobables (los
  cinco de la 1.0 que siguen autoevaluados, `tests/razonar11-unidad.spec.ts`). En 30.29 la solución da los
  coeficientes del diseño sin redondear (K<sub>p</sub> = 1,5993, el de las netlists): se aceptan también los de 1,60.
- **«Por qué no» de las preguntas nuevas.** Las 46 propuestas de `porque10.mjs` sin revisar (de las preguntas de
  repaso de las ampliaciones y de la 4.1) se han revisado: 6 frases del libro aprobadas (2 con la anterior) y 40
  rechazadas que llevan en su lugar una explicación breve del error de esa opción, escrita en la revisión con lo que
  dice el libro (`"propio"` en `contenido/porque_curado.json`; `PorQueNo` la muestra sin comillas ni «Del libro»).
- **Lo que el libro ya corrige.** Los 33 «Dato que usa la solución del libro» cuyo dato ya da el enunciado se han
  quitado del curado (queda el de 45.A: los 3 mA a 0,4 V de la norma I²C), y las dos notas «errata» (1.B y 3.B), que
  el libro ya resuelve. La lección 2.5 dice «la combinación de dos tolerancias» y la 5.7 cita la tabla nueva («Pérdida
  (100 V, I<sub>RM</sub> = 2 A)»).
- **Figuras.** La 4.1 redibujó todas las figuras con guion (Inter y colores por papel); sus datos interactivos
  (`datos/`, que el libro ya no trae) se llevan al dibujo nuevo con `contenido/datos_figuras_recolocar.py`, que vuelve a
  ejecutar el guion de cada figura en una copia de trabajo y mide el recorte real: 381 movidos de 1 a 4 puntos, 140
  iguales y uno retirado (0.11: su gráfica pequeña cambió de sitio; queda como figura sin datos).
- **Glosario.** 1 054 términos, los de `glosario.typ` y los que dicen los créditos y las novedades del libro (rama
  `fix-4.1.1`, F1–F3): el libro ha separado las 28 entradas que iban pegadas a la anterior (lo que hacía el generador
  para separarlas se queda, ya no encuentra ninguna) y ha fundido «Control vectorial» en «Control vectorial (FOC)»
  (34.6, también término clave del capítulo 34), como antes «Deslizamiento» en «Deslizamiento (s)».
- **«sen» para el seno** (F7): las fórmulas y el texto de 30.10, 30.12, 30.D, 33.10 y 34.x dicen «sen» y «arcsen», y
  también la fórmula de la máquina síncrona del paratexto de `cap56` y la explicación de la pregunta de repaso de
  `cap31` sobre la red de adelanto.

### Paratexto del libro (`contenido/paratexto/`)

El paratexto de los capítulos (objetivos, términos clave, correspondencia con el grado, resumen, normas y lecturas,
fórmulas, autoevaluación, dificultad, índice de cada tomo) lo genera este paquete a partir de los datos de la aplicación
(el `paratexto11` de la entrega 1.1, ahora en el repositorio). Desde la 4.0 el libro lo ha cambiado también a mano; para
que regenerarlo no deshaga esos cambios, se traen al paquete:

```sh
python3 contenido/paratexto/scripts/importar_libro.py   # lo cambiado a mano en Fuentes/paratexto → redaccion/libro41.yaml, redaccion/libro41/, redaccion/grado.typ, paratexto.typ
python3 contenido/paratexto/scripts/generar.py          # datos/<parte>.json desde web/public/libro y contenido/repaso
python3 contenido/paratexto/scripts/generar_typ.py      # el Typst, en contenido/.cache/paratexto (EPA_PARATEXTO_SALIDA para otra carpeta)
python3 contenido/paratexto/scripts/comparar.py         # frente a Fuentes/paratexto: contenido/paratexto/DIFERENCIAS.md
```

Traído del libro: las piezas redactadas de cada parte (`objetivos-cap`, `terminos` —los términos clave que añadió la
4.1, G5—, `grado`, `resumen` y `normas` con las lecturas de cada capítulo y sus ediciones, E8), la página
«Correspondencia con el grado» con la numeración de la 4.1 y la auditoría CIN/351/2009 (E3, G1–G7), el paratexto entero
de las partes escritas fuera del paquete (`cap55`, `cap56`, `cap57`, `apK`) y las preguntas de repaso de la aplicación
que la autoevaluación del libro no recoge (las 42 de las ampliaciones de la 1.1: `autoev_fuera`). Reglas nuevas del
generador: «Problema N.X» se escribe `Problema #nr("prob-…")` en las preguntas y en las soluciones (E3). Resultado: 43
de 78 ficheros iguales byte a byte; las diferencias que quedan, todas en piezas que salen de los datos de la
aplicación (detalle en `DIFERENCIAS.md`):

- **Números de reserva** (`soluciones`, `formulas`): el libro conserva los números impresos de la 3.0.2 como reserva y
  la aplicación escribe los de la 4.1; la plantilla imprime siempre los de `NUMS`/`PARTES`, así que el PDF no cambia.
- **Dificultad** (`niveles`, 8 capítulos: 0, 17, 23, 30, 33, 37, 45 y 48). Desde la 1.2 los puntos que el libro
  imprime mandan (`importar_libro.py` los trae a `libro41.yaml`, `niveles`), así que regenerar ya no cambia ninguno de
  los 556 que tiene; los 81 ejercicios que imprime sin puntos (los nuevos desde la 4.0) toman los de
  `redaccion/niveles.yaml`: los 10 que propone G5 (`propuesta`) y 71 de la aplicación (`aplicacion`, con la misma
  escala: 1 un cálculo directo aunque dé varios valores, 2 varios pasos o un razonamiento, 3 un diseño o una cadena
  larga); la regla de `generar.py` solo queda de reserva y avisa si la usa. Cada `dificultad` de `datos/<parte>.json`
  dice su `origen` (`libro`, `propuesta`, `aplicacion` o `regla`) y el nivel de la regla. **Para el autor**: llevar
  esos 81 niveles a `niveles` de su `Fuentes/paratexto/<parte>.typ`, y el libro los imprimirá.
- **Fórmulas** de `cap33`: resuelto en el libro (rama `fix-4.1.1`, F4): ha adoptado la línea que genera la aplicación,
  `cap33-18` cita la 34.6 y el término clave «Fuerza contraelectromotriz» sale del 33 (`importar_libro.py` lo trae);
  `cap33.typ` solo difiere ya en los niveles y en los números de reserva de las soluciones, y `cap56.typ` es igual byte
  a byte (término clave «Control vectorial (FOC)», «sen» en sus fórmulas).
- **`cap38`**: las dos preguntas nuevas de la 4.1 llevan la unidad como contenido (`[ciclos]`) y sin escapar el guion.
- **Índice de cada tomo** (`tomo*.typ`): las entradas y sus secciones salen del texto de hoy de la aplicación.

Pruebas (Node, sin navegador): `EPA_SIN_SERVIDOR=1 npx playwright test -c playwright.sync41.config.ts` — los ids frente
a `Informes/ids_4.1.json`, la migración de un perfil de la 1.1 (`tests/fixtures/perfil-11-capitulos-nuevos.json`: cada
id renombrado existe en el contenido de la 4.1, notas intactas, copia previa, idempotente), el fichero de formato 2, la
numeración frente a `numeros.json`, los 792 QR (y los de la 4.0) y los cursos. Con las fuentes del libro ausentes, las
comprobaciones del libro se saltan.

## Aprender haciendo (0.10)

Las lecciones «Estudiar por pasos» intercalan, tras el paso que contiene su figura, ecuación o lista, unas pocas
pantallas para **practicar** (como mucho cuatro por sección, una de cada tipo), todas sacadas del libro: no hay texto
inventado más allá de frases fijas alrededor de nombres y valores del libro.

- **Prediga y compruebe** (89 secciones): «Si duplica R<sub>2</sub> (de 5 kΩ a 10 kΩ), ¿la tensión en V<sub>sal</sub>
  aumenta, disminuye o se queda igual?». Tras responder, la aplicación simula con su ngspice el circuito del libro
  con los dos valores y califica con lo que sale; el esquema de la figura se ve vivo con el valor nuevo (corriente y
  tensiones), o se enlaza la netlist en el simulador.
- **Calcule** (124 secciones): problemas con **valores distintos en cada intento**, de las fórmulas de las
  calculadoras y de 41 ejercicios del libro que una fórmula reproduce con los datos de su enunciado (el enunciado del
  libro con los números cambiados). Valores realistas: E12 en resistencias, condensadores y bobinas, alimentaciones
  habituales, series redondas; se acepta «4,7 k», «4k7», «0,5 mA», «2,2e-3»… con la tolerancia del ejercicio (2 %
  si no dice otra).
- **Ajuste** (32): un deslizador por los valores E12 de una resistencia hasta que una corriente o tensión llegue al
  objetivo; cada posición se simula.
- **Señale en el esquema** (66): «Toque el transistor en el esquema de la figura 21.16».
- **Complete el montaje** (21): la protoboard de «Ver en protoboard» con un cable o una pieza de menos; se acepta
  cualquier arreglo que conecte como el esquema.
- **Ordene** (15): los pasos de un procedimiento numerado del libro. **Una las parejas** (162): términos del glosario
  con su definición, o símbolos con su componente.
- Cada respuesta: **pistas en escalera** (primero la fórmula o la idea del libro, después el planteamiento con los
  números), **un segundo intento** antes de la solución, y la explicación con **el fragmento del libro** que la
  justifica y el enlace a su sección; en los cálculos, la solución paso a paso con los números de esa variante.
- La pantalla final muestra las **ideas clave** de la sección (recuadros destacados, fórmulas con «Calcular»,
  definiciones del glosario) y la siguiente lección. Cada práctica respondida cuenta para el objetivo diario como una
  pregunta de la lección.
- En **Repaso**, «Aprender haciendo» abre por capítulo todas las prácticas generadas (662 en 60 partes desde la 1.0,
  con los retos de la sección siguiente); bajo los
  ejercicios que lo permiten, «Practicar con otros valores».

Se generan con `node web/scripts/practica10.mjs` (unos 60 s; también lo llama `contenido/generar.py` al final) en
`web/public/libro/practica/`. Pruebas: `npx playwright test -c playwright.preguntas10.config.ts
tests/preguntas10.spec.ts` (puerto 4391); capturas en `tests/capturas/preguntas10/`.

## Cursos, XP y logros (0.11)

Para que estudiar se parezca más a Brilliant (aprender haciendo, con ganas de volver):

- **Sonido y vibración.** Un acierto suena con dos notas cortas y vibra un instante; un fallo, con una nota grave y
  suave; terminar una lección, subir de nivel o conseguir un logro tienen su propio sonido, y cada paso de «Monta
  este circuito», un toque ligero. Los sonidos se generan en el momento (Web Audio, sin ficheros) y son bajos. En
  «Aa» → «Sonido y vibración» se apagan por separado (vienen encendidos; solo en este dispositivo). En Android la
  vibración usa el plugin de háptica de Tauri; en el ordenador no hay vibración.
- **Celebraciones.** El sello de una respuesta correcta da un pequeño salto con unas chispas; al ganar XP aparece
  arriba «+10 XP» (varios premios seguidos se suman); al subir de nivel o conseguir un logro, una tarjeta con su
  insignia. Al terminar una lección, «Sección completada» muestra los XP ganados (contando), la racha y el porcentaje
  de aciertos a la primera, la barra del nivel y un momento de confeti. Todo con transformaciones y opacidad (nada
  de WebGL), nada se mueve en reposo y, con «reducir movimiento» del sistema, solo hay fundidos.
- **XP y niveles.** Una pregunta o práctica acertada da 10 XP (5 a la segunda o con pistas), una lección completada
  20, un ejercicio resuelto 15 (8 tras un fallo o con pistas; nada si se abrió antes la solución), un circuito
  guiado de la protoboard 25 y cada día con el objetivo cumplido 10 más 2 por cada día de racha (hasta 20 más). Cada
  cosa cuenta una sola vez aunque se repita o se haga en otro dispositivo. Los niveles tienen nombre («Chispa»,
  «Corriente continua», «Ley de Ohm»… «Laboratorio completo») y cada uno pide 50 XP más que el anterior (100, 250,
  450, 700…). El inicio muestra el nivel, los XP y el curso del capítulo que se estudia.
- **Logros.** 30 insignias dibujadas (primera lección, diez y cincuenta lecciones, un capítulo entero, madrugador y
  búho, primer acierto, sin pistas, capítulo dominado, ejercicios, primer montaje en la protoboard, los cinco
  montajes, primera simulación, rachas de 3, 7 y 30 días, constancia, el problema del día y una semana de problemas
  seguidos, prueba de nivel, cursos, niveles 5 y 10…). La
  página **«Progreso y logros»** (`#/progreso`, desde la tarjeta del nivel y los atajos del inicio) enseña el nivel, los XP, la
  racha, los últimos XP y todos los logros: los conseguidos en color con su fecha y los demás en gris, con lo que
  hay que hacer y cuánto falta.
- **Cursos** (`#/cursos`, también desde el inicio): los capítulos agrupados por temas, cada curso con su avance y
  «Continuar» (la primera lección no completada ni superada, en el paso donde se dejó):

  | Curso | Capítulos (ficheros `capNN`) |
  |---|---|
  | Fundamentos | 0–6 |
  | Análisis de circuitos | 23, 24, 25, 42 |
  | Electrónica analógica | 7, 8, 26, 27, 28, 32, 43 |
  | Digital y programable | 9, 29, `cap-new-automatas`, 34, 37, 38, 44 |
  | Potencia y energía | 10, 33, `cap-new-maquinas`, 39, 50 |
  | Señales, RF y comunicaciones | 30, 31, 36, 45 |
  | Sensores y microcontroladores | 17–20, 35, 49 |
  | Taller e instrumentos | 11–13, 15, 21, 22, 47, 53 |
  | Diseño de placas | 40, 41, 46 |
  | Proyectos completos | 16, 48–52, 54 |

  Los números son los de los ficheros del contenido: desde `cap15` el capítulo impreso es uno menos (`cap15` es el
  «Capítulo 14», y no existe `cap14`); la aplicación muestra siempre el número impreso. Todos los capítulos están en
  algún curso; el 49 y el 50 están en dos. Los apéndices no están en ningún curso. Los dos capítulos nuevos de las
  ampliaciones (1.1: autómatas programables y máquinas eléctricas) van donde los pone el libro y llevan, en el camino
  y en la lista, la insignia «Aún no en el libro» (también una sección nueva dentro de un capítulo del libro); el
  avance se guarda por lección, así que añadirlos no cambia nada de lo guardado.
- **Prueba de nivel** de cada curso: entre 6 y 10 preguntas de repaso del propio libro, de los primeros capítulos del
  curso a los últimos, con «No lo sé». Al final, el resultado por capítulo, por dónde empezar (el primer capítulo con
  un fallo) y la opción de marcar las lecciones de los capítulos anteriores como **«superadas por la prueba»**: se
  ven distintas de las completadas, no dan XP y se pueden deshacer. Se puede saltar y repetir (cada vez con otras
  preguntas); no da XP.
- **Recordatorio diario** (solo Android): en «Aa» → «Recordatorio diario», una notificación cada día a la hora
  elegida (20:00 por defecto): «Unos minutos con la electrónica: le espera el problema del día.» Al activarlo,
  Android 13 o posterior pide permiso para mostrar notificaciones. Tocarla abre el problema del día (`#/problema`; si
  Android tenía la aplicación cerrada del todo, se abre el inicio, que lo muestra arriba). Puede llegar unos minutos
  tarde (Android agrupa las alarmas para ahorrar batería). En el ordenador, «Aa» dice «Solo en Android».

XP, logros, lecciones superadas y pruebas se sincronizan como el resto del progreso; al instalar la 0.11 sobre la
0.10, lo ya hecho (lecciones completadas, ejercicios resueltos, días con el objetivo cumplido) se convierte en XP y
logros una sola vez, sin tocar los datos de antes.

Pruebas: `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.grupoA.config.ts
tests/grupoA11.spec.ts` (puerto 4451, compilación en la carpeta temporal del sistema); capturas en la tableta y el
teléfono, en claro y oscuro, en `tests/capturas/grupoA11/`.

## Aprender a la medida: dominio, práctica inteligente, problema del día y figuras que se exploran (0.11)

- **Figuras vivas dentro de las lecciones.** En «Estudiar por pasos», los esquemas del libro que se pueden simular en
  continua (25 dibujos de 20 figuras) traen debajo una fila para explorar: «Mueva R<sub>1</sub>: ¿qué le pasa a la
  tensión en V<sub>sal</sub>?», un deslizador por los valores E12 (×0,1 a ×10) y la lectura grande con el valor del
  libro y cuánto sube o baja. Qué se mueve y qué se mira sale de las prácticas del libro sobre ese mismo dibujo (el
  componente del «Ajuste»; si solo hay un «Prediga y compruebe», otro componente, para no darle la respuesta); si no
  hay, una resistencia con nombre y un nodo con etiqueta. Con varias resistencias, unas fichas permiten cambiar de
  componente. El dibujo se actualiza en su sitio (colores, cargas que circulan, lecturas) con el mismo ngspice de
  siempre; se simula 0,25 s después de soltar el dedo, solo con la figura en pantalla (un cambio hecho fuera de ella
  espera a que vuelva) y nada se mueve en reposo. Su sitio se reserva desde el principio: no empuja el texto.
  Ningún esquema simulable del libro tiene interruptores, así que no hay «accionar un interruptor».
- **Dominio por concepto.** Cada sección del libro es un concepto (633 tenían algo que responder en la aplicación
  en la 1.0; con las preguntas de las lecciones 1.1, más, y crecen con cada lección nueva; los
  capítulos y los cursos suman sus secciones). Cada respuesta cuenta: a la primera y sin pistas 100 puntos, con ayuda
  60, mal 0; repetir la misma pregunta enseguida («Probar otra vez», recargar) no cuenta otra vez. El dominio sube con
  más preguntas acertadas y, sobre todo, con aciertos en días distintos, y baja poco a poco con el tiempo (nunca por
  debajo de la mitad); cuando se empieza a olvidar algo sabido, queda «para repasar». Niveles: Intentado,
  Familiarizado, Competente y Dominado. Se ve con cuatro segmentos junto al título de cada sección en el libro (un
  toque lleva a practicarla), en el índice, en cada curso (barra por curso y por capítulo, segmentos por lección) y en
  **«Dominio»** (`#/progreso/dominio`, desde «Progreso y logros» y el inicio): cuántos conceptos hay en cada nivel, lo
  que más cuesta y lo que se empieza a olvidar, cada uno con «Practicar esto», y el dominio por cursos y capítulos.
  Al instalar esta versión, las respuestas que la aplicación ya guardaba (aciertos con sus XP, preguntas falladas del
  repaso, ejercicios) se convierten en dominio una sola vez, sin tocar esos datos.
- **Práctica inteligente** (`#/practicar`, desde el inicio): unos diez ejercicios elegidos para cada lector: primero
  lo que más le cuesta (4) y lo que empieza a olvidar (3), algo nuevo de su curso en orden (2; nunca de un capítulo
  más allá del que lleva, y del siguiente solo cuando ha tocado todo lo anterior) y un repaso de lo que domina (1); lo
  que un grupo no llena lo llenan los otros. Usa todo lo que la aplicación sabe preguntar: las prácticas de «Aprender
  haciendo», las preguntas de repaso, los ejercicios que se comprueban solos, las tarjetas de las lecciones 1.1 (desde
  sus arreglos del motor) y las **tarjetas del glosario que ya
  tocaban hoy** (como mucho dos, de los mismos conceptos, nunca nuevas): se responden con los mismos botones y el mismo
  planificador que en «Repaso», así que cuentan como repasadas allí y no compiten con él. No repite lo respondido en
  las últimas 20 horas mientras haya otra cosa, vuelve a preguntar lo que se falló días atrás y no pone dos seguidos
  del mismo concepto. Al final: aciertos a la primera, XP y **lo que ha mejorado** (el dominio de cada concepto antes
  y después). Con «Practicar esto» la sesión es de una sección (completada hasta 5 con lo más flojo del capítulo) o de
  un capítulo entero (`#/practicar/<capítulo>[/<sección>]`).
- **Problema del día** (`#/problema`, tarjeta en el inicio): uno al día, el mismo todo el día y en todos los
  dispositivos, de su curso y hasta el capítulo al que ha llegado (un lector nuevo, del primer capítulo de
  Fundamentos): un «Calcule» del libro con los valores del día, o un ejercicio autocomprobable aún sin resolver. Dos
  intentos y las pistas, como cualquier práctica; resolverlo da 15 XP más, cuenta para la racha de problemas (en la
  tarjeta y en la página) y para los logros «Problema del día» y «Semana de problemas». Después se ve la solución
  paso a paso con los valores del día; «La solución de ayer» enseña la de ayer. Funciona sin conexión.

Dominio y problemas del día se sincronizan como el resto del progreso (las rondas de una misma pregunta respondida en
dos dispositivos se suman, no se pisan).

Pruebas: `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.grupoB.config.ts
tests/grupoB11.spec.ts` (puerto 4461, compilación en `/tmp/epa-dist-grupoB`); capturas en la tableta y el teléfono,
en claro y oscuro, en `tests/capturas/grupoB11/`. `node web/scripts/conceptos11.mjs` (lo llama `generar.py` tras las
prácticas) escribe `libro/conceptos.json` (las secciones con algo que responder) y `libro/explorables.json` (los
esquemas que se exploran en las lecciones).

## Modo docente: cursos y exámenes propios, exportables a PDF (1.0)

**Modo docente** (carril de iconos, la última entrada —en una ventana baja y en el teléfono, en «Más»—; `#/docente`):
cursos y exámenes propios hechos solo con el contenido del libro.

- **Cursos propios**: una lista ordenada de secciones del libro (cada una se estudia como lección «Estudiar por
  pasos»), ejercicios, problemas y preguntas de test, con un título y unas notas. Se siguen como los cursos temáticos:
  el estado de cada elemento (hecho, empezado, fallado, pendiente) sale del progreso que la aplicación ya guarda
  (lecciones, ejercicios, respuestas), con la barra de avance y «Continuar»; los ejercicios y las preguntas se abren
  dentro del curso, uno por pantalla, con «Anterior» y «Siguiente», y cuentan como en cualquier otra parte.
- **Exámenes propios**: ejercicios, problemas y preguntas de test elegidos a mano o con filtros (capítulo, concepto
  —la sección—, tipo y «solo lo que la aplicación corrige sola», sin ninguna parte autoevaluada; «Elegir al azar con estos filtros» saca los que se
  pidan repartidos por los capítulos), con los puntos de cada uno (por defecto 1 la pregunta de test, 2 el ejercicio y
  3 el problema), el tiempo total, **variantes** con otros valores (los 41 ejercicios que una fórmula del libro
  reproduce, con el mismo generador de «Practicar con otros valores») y la opción de **barajar** el orden y las
  opciones (las de «Sí / No» conservan su orden). Cada examen tiene una semilla: la variante A, B, C… sale siempre
  igual, en la aplicación y en el PDF, en todos los dispositivos; «Generar otras variantes» cambia la semilla. El
  libro no da una dificultad por ejercicio, así que no hay filtro de dificultad.
- **Hacer el examen en la aplicación**: todas las preguntas en una página, el tiempo que queda a la vista (se anuncia
  a los lectores de pantalla una vez por minuto), sin pistas ni correcciones. Lo respondido se guarda mientras tanto en
  el dispositivo (una recarga o un «Atrás» no lo pierden); al acabarse el tiempo se entrega solo. Al entregar: la
  nota de cada pregunta y el total, lo respondido frente a lo correcto y el desarrollo del libro de cada una (la cita de
  las preguntas de test). Cada parte vale lo mismo: bien 1, «casi» ½ (el mismo «Casi» de los ejercicios: un prefijo de
  más o de menos, a menos de un 10 %…), mal o en blanco 0; lo que hay que explicar se compara con el desarrollo del
  libro y se autoevalúa («Bien», «A medias», «Mal»), y la nota se recalcula. Los resultados se guardan y se
  sincronizan.
- **Exportar a PDF** (sin conexión, en Windows, macOS, Android y el navegador): el **examen** (encabezado con el
  título, la fecha —o una línea para escribirla—, «Nombre» y «Calificación», las instrucciones, cada pregunta con sus
  puntos, sus datos y su enunciado —o el de la variante—, casillas para las opciones y espacio para responder: sin
  espacio, unas líneas o media página), las **soluciones** (las respuestas, las citas del libro y el desarrollo del
  libro de cada pregunta; en las variantes, la fórmula, los datos y el resultado con sus valores, y después el
  desarrollo original) y el **índice de un curso**. El PDF se hace dentro de la aplicación, en JavaScript: el WebView
  de Android no sabe imprimir (`window.print()` no hace nada) y la impresión del sistema daría un fichero distinto en
  cada equipo. Texto de verdad (se puede buscar y copiar) con las fuentes de la aplicación incrustadas, y las fórmulas y
  figuras del libro como vectores, nítidas a cualquier aumento. La misma variante da siempre el mismo fichero, byte a
  byte. Se guarda con el diálogo del sistema (Tauri) o se descarga (navegador).

Pruebas: `PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.docente10.config.ts` (puerto
4621, compilación en `/tmp/claude-0/epa-docente10/dist`): `tests/docente10-unidad.spec.ts` (sin navegador; con
`EPA_SIN_SERVIDOR=1` no compila: el banco y sus filtros, el montaje sembrado de cada variante, la corrección de todo el
libro con sus propias respuestas, el PDF de todo el libro leído con pdf.js —páginas, texto de cada enunciado, fuentes
incrustadas, ningún carácter sin glifo, todas las fórmulas—, los mismos bytes para la misma variante y la conversión de
las 795 ecuaciones y 880 figuras) y `tests/docente10-navegador.spec.ts` (crear, hacer con recarga, entregar con el
diálogo propio, nota por pregunta y autoevaluación; el PDF descargado igual byte a byte al hecho en Node; filtros,
«Elegir al azar» y variantes; el tiempo que se acaba; un curso propio y su índice; editar, duplicar y borrar; la
entrada en el carril y en «Más»; 44 px y axe en claro, sepia y oscuro). `EPA_PDF_SALIDA=<carpeta>` deja allí los PDF
de la prueba sin navegador para mirarlos.

**Arreglos de la revisión 11a.** Los 181 ejercicios que la 1.0 autoevaluaba y la 1.1 comprueba sola (marcados
`comparar10`) siguen calificándose como en la 1.0 cuando la respuesta guardada es el texto escrito de entonces: el
resultado enseña «Lo que escribió» y «Bien / A medias / Mal», la nota guardada se reproduce y un borrador de la 1.0
entregado ya con la 1.1 conserva su texto como parte abierta. Una nota guardada ya no se recalcula con una solución
corregida después (las erratas de los problemas 1.B y 3.B): se enseña la de entonces y, si la clave actual daría otra,
una nota lo dice; autoevaluar solo mueve esa parte. Un diseño que no se pudo simular al entregar (un fallo pasajero de
ngspice) se simula después desde el resultado («Simular ahora y corregir»). Pruebas: `tests/revision11a-unidad.spec.ts`
y `tests/revision11a-navegador.spec.ts`.

**Arreglos de la revisión 10c.** Un examen empezado sigue con la versión con la que se empezó: cambiar el título o las
notas, pulsar «Guardar» sin cambios (ya no guarda nada) o recibir un cambio por la sincronización no tira las respuestas;
si cambian las preguntas, el intento sigue con las suyas y lo dice («los cambios valdrán para el próximo»), y el editor
avisa de que hay un intento sin entregar. Un borrador de antes de este arreglo cuyo examen cambió no se descarta: espera
a que el lector pulse «Empezar de nuevo». Una entrega que no se pudo guardar ya no queda «en memoria» como si estuviera
guardada: el borrador solo se borra cuando el resultado está escrito en el dispositivo. Con el tiempo agotado y la
entrega automática fallida, el reloj sigue en 0:00, las respuestas ya no se pueden cambiar y la entrega se reintenta cada
15 s. La variante elegida va en la ruta (`#/docente/examen/<id>/hacer/<n>`, la A sin número). Los fallos al guardar en el
editor y en la autoevaluación se dicen en la página; el editor pregunta antes de salir con cambios sin guardar por un
enlace de la aplicación o por «Ver el informe» / «Recargar la página» del aviso de fallo (el botón Atrás del navegador no
se puede retener); un examen o curso borrado mientras se editaba se ofrece guardar como nuevo; los borradores de exámenes
borrados se limpian al abrir la lista. En el PDF, las notas con saltos de línea salen en líneas separadas (antes, «?»), y
si algún carácter no está en las fuentes de la aplicación la página lo dice. La orden de Rust solo acepta los tipos
de fichero JSON y PDF. Pruebas: `tests/docente10-revision10c.spec.ts` (9, fallan con el código de antes) y las del revisor,
`tests/revision10c-navegador.spec.ts` y `tests/revision10c-unidad.spec.ts` (`playwright.revision10c.config.ts`).

**Arreglos de la revisión 10f.** Al volver a un intento se cargan sus propias preguntas (antes, las del examen actual: una
pregunta quitada del examen desaparecía del intento al recargar, con su respuesta), y los números de las preguntas de un
intento ya no se mueven nunca: si alguna no se pudiera cargar, el intento no se abre (las respuestas siguen guardadas). El
editor pregunta antes de salir con cambios sin guardar por cualquier camino: enlaces, «Libro» y demás botones del carril,
un resultado de «Buscar», el botón Atrás del navegador o de Android, «Usar aquí» de una pestaña en pausa y «Reiniciar para
terminar» tras una actualización (solo cerrar la ventana no se puede retener). Un intento de un examen borrado en otro
dispositivo ya no se pierde: la lista lo ofrece en «De exámenes borrados» para terminarlo y entregarlo, junto con los
resultados de exámenes borrados; borrar aquí un examen con un intento sin entregar lo dice en el diálogo. Si el borrador
no se puede escribir (almacenamiento lleno), el examen lo dice. La orden de Rust pone al nombre propuesto la extensión del
filtro (`.pdf`, `.json`). Pruebas: `tests/docente10-revision10f.spec.ts` y las del revisor, `tests/revision10f-navegador.spec.ts`
(`playwright.revision10f.config.ts`).

**Arreglos de la revisión 10h.** El examen solo empieza (y solo corre su tiempo) cuando sus preguntas están en pantalla: si
algo no carga, lo dice con sus palabras y «Reintentar», y un intento que nunca se abrió no se entrega solo. Si no carga la
práctica, un examen con variantes no se abre (ni se imprime) con los valores del libro. Si alguna pregunta de un intento ya
no está en el libro, «Ver y entregar lo que hay» entrega las demás y guarda con el resultado, sin corregir, las respuestas
de las que faltan. Con respuestas que no se han podido guardar, salir del examen pregunta antes. Los intentos de exámenes
que ya no existen (también cuando la sincronización olvida el examen borrado, a los 90 días) siguen en «De exámenes
borrados», con su título. «Ver el informe» con cambios sin guardar pregunta una sola vez; tras «Atrás» y «Descartar», el
siguiente «Atrás» sí retrocede; pulsar «Atrás» varias veces deja una sola pregunta. Borrar con el almacenamiento lleno no
borra nada y lo dice. Dos dispositivos que autoevalúan el mismo resultado se unen pregunta a pregunta (gana la
autoevaluación más reciente de cada una; un resultado borrado sigue borrado). El tiempo del examen se cuenta con un reloj
que no salta con el del sistema. El resultado guarda los valores de su variante y su propio límite de tiempo. Pruebas:
`tests/docente10-revision10h.spec.ts` y las del revisor, `tests/revision10h-navegador.spec.ts` (`playwright.revision10h.config.ts`).

## Más Brilliant, solo con el libro: retos, «por qué no», caminos y repaso espaciado (1.0)

Cuatro piezas nuevas en las lecciones y los cursos, todas hechas con lo que dice el libro (los textos para el lector
son frases fijas alrededor de nombres y valores del libro, o frases del libro copiadas tal cual):

- **Retos con la figura** (33 en 8 capítulos: los impresos 0, 1, 2, 6, 21, 22, 44 y 52): en lugar de escribir un número se
  mueve un valor del esquema vivo —una resistencia en valores E96 o una fuente en pasos de un 1 %— hasta que una
  magnitud llegue al valor del libro: «Ajuste R<sub>1</sub> y R<sub>2</sub> hasta que la tensión en V<sub>sal</sub> sea
  4 V ± 2 %. Vale cualquier combinación que lo consiga». Cada posición se simula con el ngspice de la aplicación y la
  figura cambia en su sitio (colores, cargas que circulan, la etiqueta del valor nuevo); debajo, la lectura grande, una
  barra con la zona del objetivo y lo lejos que está («le sobran 1,14 V sobre 4 V (+29 %). Más cerca que antes»).
  Botones ‹ › de un paso (44 px) y el deslizador con las flechas del teclado. «Comprobar» simula lo elegido: tres
  intentos, y cada fallo abre un peldaño más de la escalera de pistas (lo que dice el libro de la figura, hacia dónde
  mover cada valor —sacado de la simulación—, el valor del libro). Después, el desarrollo: el ajuste elegido y lo que da,
  de dónde sale el objetivo y los valores del libro simulados. El objetivo es el número que escribe el libro en la
  sección (y ese párrafo es la cita) o, si no lo escribe, el valor de la simulación que guarda el libro para esa figura.
  Los capítulos 3 y 49 (impresos 3 y 48) tienen esquemas vivos sin nada que ajustar (piezas iguales sin nombre,
  resistencias de pull-up sin corriente); los cuatro esquemas vivos con fuentes alternas o de pulsos (figuras 21.3, 21.7,
  21.16 y 52.11) enseñarían una constante de tiempo o un rizado, que pide medir el transitorio: quedan fuera. Ningún
  ejercicio del libro remite a una figura viva, así que no hay retos sacados de ejercicios sobre ellas.
- **Retos de montar el circuito** (10): los ejercicios del libro que se resuelven montando y midiendo en una
  protoboard —ej. 1.4 (3,3 V a partir de 5 V con R<sub>1</sub> = 1 kΩ), 2.4 (divisor 12 V → 5 V con valores E12), 2.5
  (puente de Wheatstone equilibrado), 2.8 (divisor cargado: 3,33 V), 2.6, 44.1 y 25.3 (un LED con su resistencia a 15 o
  10 mA), 5.3 y 5.8 (regulador Zener de 5,1 V con 20 mA de carga y, en el 5.8, 10 mA por el Zener) y 6.2 (polarización
  de un 2N3904 por divisor: corriente de colector, base y emisor)— en la lección de la sección que lo enseña. Las
  tolerancias son las del libro (el 2,7 % de su par E12 en el 2.4, «la aproximación es buena al 10 %» en el 6.2, lo
  que deja pasar el 220 Ω que elige en el 5.8). Quedan fuera el 5.1 (LED azul: el simulador no tiene su modelo), el 6.3
  y el 19.2 (relé con dos alimentaciones) y el 52.7 (depende de la hFE del transistor real). La protoboard empieza vacía con la fuente del ejercicio puesta; la bandeja trae solo las piezas que hacen
  falta; arriba, el enunciado del libro y la lista de lo que se medirá. «Comprobar» simula lo montado y **mide**: la
  salida, la corriente por el LED, la del Zener y la carga, que las resistencias sean E12… Vale cualquier circuito que lo
  cumpla (no se compara con un montaje dado) y cada condición dice lo que midió y qué cambiar («Por el LED pasan 30 mA y
  el reto pide 10 mA ± 10 %: para que pase menos corriente, la resistencia en serie tiene que ser mayor», «El Zener
  conduce en directa: está al revés»). Al final, una solución que cumple, simulada, y la solución del libro.
  Desde las revisiones 10d y 10g se mide también **cómo** está montado lo que importa, porque con valores bien
  elegidos un circuito equivocado puede dar la lectura pedida:
  - **nada de más** en ningún reto: ninguna pieza directamente entre el + y el − de la fuente, ninguna con una pata al
    aire ni con las dos en el mismo punto, y una sola fuente;
  - los **divisores** (1.4, 2.4 y 2.8) son exactamente los del ejercicio: una resistencia del + a la salida y el resto
    de la salida al −; en el 1.4 la de 1 kΩ es la de arriba (R<sub>1</sub>), y en el 2.8 las tres son de 10 kΩ con la
    carga en paralelo con la de abajo (tres en serie también dan 3,33 V, que es justo el error que enseña el
    ejercicio);
  - el **puente** (2.5) tiene dos ramas distintas con corriente, cada una con su punto medio, y sus cuatro brazos son
    de 1 kΩ (R<sub>4</sub> = 1 kΩ es la respuesta; solo se admite además un detector entre los puntos medios); el
    equilibrio se pide con 5 mV, muy por debajo de los 12 mV del sensor de 1010 Ω que, como dice el ejercicio, lo rompe;
  - los **LED** (2.6, 26.3 y 45.1): un solo LED con una sola resistencia en serie, y toda la corriente de la fuente
    pasa por él (dos LED en serie con otra resistencia dan la misma corriente);
  - en los **reguladores Zener** (5.3 y 5.8) la carga es **todo** lo que cuelga de la salida en paralelo con el Zener
    (dos cargas de 270 Ω suman 38 mA; una de 20 mA hecha con 510 Ω ∥ 510 Ω o 120 Ω + 150 Ω vale), con un solo Zener;
  - en el 6.2, la polarización por divisor del ejercicio (R<sub>1</sub> del + a la base, R<sub>2</sub> de la base al
    −, R<sub>C</sub> y R<sub>E</sub>; una sola resistencia de base daba la misma corriente) y además V<sub>CE</sub> =
    3,98 V ± 10 %.
  Las pruebas recorren los diez retos con montajes tramposos: piezas de más, combinaciones en serie o paralelo que dan
  la lectura y piezas en otra posición.
- **Por qué no esa opción**: al elegir una opción incorrecta (preguntas de las lecciones y de Repaso, preguntas de los
  ejercicios, «Prediga y compruebe»), antes de la explicación general, «Por qué no «…»» con la frase del libro que habla
  de lo que dice esa opción, entre comillas y con el enlace a su sección. Las saca `web/scripts/porque10.mjs` buscando en
  la sección de la pregunta (o en la solución del ejercicio) la frase que comparte las palabras propias de esa opción y el
  tema del enunciado, y **cada una de sus 386 propuestas se revisó a mano**: solo se muestran las 129 que explican de
  verdad por qué esa opción no es correcta (`contenido/porque_curado.json`, que el generador lee; una propuesta nueva o
  cambiada no se muestra hasta revisarla). En la revisión 10d se rechazaron diez más que, sacadas de su párrafo, no
  tienen sujeto («Eso implementa una AND cableada…») o parecen darle la razón a la opción; cinco cuyo sujeto está en la
  frase anterior del mismo párrafo se muestran con ella (`previa`). Si el libro no da una base clara, no se inventa
  nada: queda la explicación general. Hoy tienen frase propia 122 de las 2697 opciones incorrectas de Repaso, 3 de las 127 de los ejercicios (casi
  todas son «Sí / No», que explica la solución) y 4 de las predicciones; en las predicciones, cada opción incorrecta se
  explica además con los números de la simulación
  («No disminuye: la tensión en V<sub>sal</sub> pasa de 4 V a 6 V, sube un 50 %»).
- **Cada curso como un camino** (`#/cursos/<curso>` y los cursos propios del modo docente; «Camino» o «Lista»): las
  lecciones son nodos redondos en zigzag, con un anillo del avance de cada una, que se abren en orden: la siguiente
  lección se abre al completar (o superar) la anterior; en un curso propio, los ejercicios y preguntas se abren con la
  lección que los precede. Lo ya tocado nunca se bloquea (quien leyó por delante en el libro lo conserva). En la primera
  lección bloqueada y al empezar cada capítulo, **«Saltar hasta aquí»**: una prueba corta (cuatro preguntas del libro de
  las lecciones que se salta, con «No lo sé»); fallando como mucho una, quedan «superadas por la prueba» —la misma marca
  de la prueba de nivel: no dan XP, se pueden deshacer—. Desde la QA final de la 1.0 las preguntas son **solo** de las
  lecciones que se salta (antes, si tenían pocas, se completaba con las del resto del capítulo: saltar solo la 0.1
  preguntaba por ω, los complejos o las bobinas): si tienen menos de cuatro, la prueba es más corta y hay que acertarlas
  todas, y si no tienen ninguna no hay prueba: una nota lo dice y «Saltar sin prueba» las marca igual (con «Deshacer»). **Repaso espaciado**: en cada lección completada, «Para repasar
  hoy» o «Repaso en 3 días», calculado con el dominio (se repasa cuando la retención baja del 70 %); el enlace abre la
  práctica de esa sección. En el inicio, «Repaso de sus lecciones» dice cuántas tocan hoy y abre la primera. Las dos
  cosas cambian solas con el paso del tiempo (un reloj de un minuto): lo que vence mientras la página está abierta pasa
  a «Para repasar hoy» sin volver a abrirla; «hoy» y «mañana» son días del calendario.
  Para lectores de pantalla y teclado el camino es una lista ordenada por capítulos: cada nodo dice su número, título,
  estado y repaso; un nodo bloqueado no es un enlace.

Nada de esto guarda datos nuevos: los retos cuentan como cualquier práctica (XP, dominio, objetivo diario), las
lecciones saltadas van a las «superadas» de los cursos y el repaso se calcula con el dominio que ya se sincroniza (la
única excepción es «¿Qué seguridad tiene?», más abajo, con su propio almacén).

Generar: `node web/scripts/retos10.mjs` (unos 10 s; añade los retos a `libro/practica/`) y `node
web/scripts/porque10.mjs` (unos 3 s; escribe `libro/porque/`), tras `practica10.mjs` y antes de `conceptos11.mjs`;
`contenido/generar.py` los llama en ese orden. **Cadena idempotente** (QA final de la 1.0): cada paso de practica10 →
retos10 → averias10 → porque10 → teoria10 → conceptos11 reescribe solo lo suyo y deja cada `practica/<parte>.json` en
un único orden (lo de practica10, luego retos y montajes, luego averías), así que repetir cualquier paso suelto deja
todo exactamente igual que la cadena entera (antes, repetir retos10 tras averias10 ponía las averías delante en ocho
capítulos; y practica10 conserva ahora los retos y averías que ya hubiera). `EPA_LIBRO=<carpeta>` hace que los
generadores trabajen sobre una copia del libro (lo usan las pruebas; `tests/brilliant10-cadena.spec.ts` corre la cadena,
luego cada paso suelto, y compara byte a byte). **Lo que muestran las figuras** de retos y averías
(`src/componentes/practica/encuadre.ts`): el recorte se ciñe al esquema y a sus rótulos, deja fuera las notas, gráficas
y otros dibujos que tocaban su borde, y tapa con el color de la placa los textos que aún cortaría y las anotaciones del
libro —lecturas, corrientes, resultados—: en un reto darían la respuesta (en la 0.2 se veía «I₁ = 2 A») y en una avería
mostrarían los valores del circuito sano (1,52 V, 3,34 V… en la 1.3); en una avería las medidas salen solo del
polímetro. `tests/brilliant10-encuadre.spec.ts` comprueba en todas que ningún texto queda cortado sin tapar ni ninguna
anotación de color a la vista. Pruebas: `PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test
-c playwright.brilliant10.config.ts` (puerto 4631, compilación en `/tmp/claude-0/epa-brilliant10/dist`):
`tests/brilliant10-contenido.spec.ts` (sin navegador; con `EPA_SIN_SERVIDOR=1` no compila: cada reto con su cita en el
libro, su objetivo alcanzado con los valores del libro y no desde el principio, y la pista «hacia dónde» comprobada,
simulando en Node; cada reto de montar con sus números en el enunciado del libro y su referencia que cumple; soluciones
distintas aceptadas y circuitos mal explicados; cada opción incorrecta de Repaso, de los ejercicios y de las predicciones
con su explicación, cada frase en el libro tal cual y solo las revisadas y aprobadas; las reglas del camino y del repaso) y
`tests/brilliant10-navegador.spec.ts` (un reto solo con el teclado, un montaje mal y luego bien, la opción incorrecta en
una lección y en una predicción, el camino con «Saltar hasta aquí» y su prueba, el repaso en el camino y en el inicio, un
curso propio, 44 px en el teléfono y axe en claro, sepia y oscuro).

### «Encuentre la avería» y «¿Qué seguridad tiene?» (1.0)

- **Encuentre la avería** (32 casos en 13 figuras de los capítulos impresos 0, 1, 2, 6, 22, 23, 45 y 53): un circuito
  del libro con una pieza estropeada —resistencia abierta, en cortocircuito o con un valor diez veces mayor o menor;
  el generador admite también el diodo al revés o abierto y la unión base-emisor del transistor abierta, pero en los
  dibujos de hoy ninguno de esos casos sale sin ambigüedad (en continua, un diodo al revés se lee igual que uno
  abierto) y se descartan—. Con un **polímetro virtual** se mide la tensión entre dos puntos marcados en la figura
  (punta roja y negra; tocar un punto mueve la roja) o la corriente por una rama; las lecturas salen de simular en
  ngspice el circuito **con la avería** (nunca son números escritos a mano) y se muestran como en un polímetro. Luego se
  elige la pieza y el tipo de avería: pieza y tipo, 100 puntos; solo la pieza, 60; con más de tres medidas se restan 5
  por cada una, y 25 por cada diagnóstico fallido antes del último (mínimo 20). Al final, la explicación: la avería,
  cada medida comparada con el circuito sano —las que la delatan y aquellas en las que no se nota, sin dar por buena
  ninguna pieza: entre los bornes de la fuente se mide lo mismo con cualquier avería— y la que más la delata. Todo con el teclado (grupos de opciones con flechas, «Medir»), etiquetas para lectores de pantalla y 44 px.
  Salen en la práctica de su sección (como mucho una por lección), en los nodos del camino y en el repaso, y cuentan
  como cualquier práctica. Los genera `web/scripts/averias10.mjs` (`contenido/generar.py` lo llama tras
  `retos10.mjs`): para cada esquema vivo de continua con masa (o el borne negativo de la fuente), al menos dos piezas
  con nombre y tres puntos que medir, prueba cada avería posible en ngspice y se queda con las **diagnosticables** (algo
  cambia al menos 0,3 V o 10 µA y un 15 %) y **sin ambigüedad** (ninguna otra avería da las mismas lecturas); como mucho
  tres por figura, de piezas y tipos distintos. **Cada caso se revisó a mano** en `contenido/averias_curado.json`: de
  35 propuestas se aprobaron 32; los tres de la figura 23.6 se rechazaron porque el dibujo junta varios circuitos
  equivalentes separados y medir entre ellos no tiene sentido. Un caso nuevo o cambiado no se publica hasta revisarlo
  (`--revision FICHERO` escribe la lista para revisar).
- **¿Qué seguridad tiene?**: tras acertar una pregunta (lecciones, Repaso, práctica) o resolver un ejercicio,
  tres botones opcionales: «Lo sabía», «Dudaba», «He adivinado». No bloquean nada y, si no se tocan, no se guarda
  nada. Cambian el repaso espaciado: «Lo sabía» (o nada) lo deja igual; «Dudaba» cuenta ese acierto como 59 puntos en
  lugar de 100 —justo por debajo de lo que hace que un día cuente para la estabilidad—, así que el repaso llega antes
  (más o menos a la mitad de plazo); «He adivinado» lo cuenta como 30 puntos, como un casi fallo: baja la precisión y
  el repaso llega mucho antes. Se aplica el último toque hecho durante esa ronda o hasta 30 minutos después, pero
  nunca uno hecho después de empezar la ronda siguiente de esa pregunta (cada toque vale para una sola ronda). Si el
  toque no se puede guardar, lo dice («No se ha podido guardar todavía: se volverá a intentar») y se reintenta. Se guarda
  en un almacén nuevo, `seguridad` (esquema v1), que se sincroniza: los toques de varios dispositivos y pestañas se
  unen por su hora, nunca se pierde uno, y si dos tienen la misma hora gana el más prudente (he adivinado > dudaba >
  lo sabía); se guardan los 12 últimos por pregunta.

Pruebas: `tests/brilliant10-contenido.spec.ts` (cada caso aprobado y citado, diagnosticable y sin ambigüedad
simulando en Node, las ediciones de la netlist y la puntuación; las reglas de unión de `seguridad`, la ventana de la
ronda y su efecto en el repaso; el caso `b10·1` del motor real de sincronización con dos dispositivos y dos pestañas,
`tests/motor-real/escenariosBrilliant10.ts`) y `tests/brilliant10-navegador.spec.ts` (una avería solo con el teclado,
los botones de seguridad, 44 px y axe en los tres temas).

## Guía de uso (1.0)

**Guía de uso** (`#/guia`; la última entrada del carril, que en una ventana baja y en el teléfono está en «Más»; también
en «Aa» → «Ayuda» y en el diagnóstico) explica, en español y de usted, cada parte de la aplicación: primeros pasos y
navegación (lector, búsqueda, temas, tamaño del texto), lecciones y cursos («Saltar hasta aquí», cursos propios),
preguntas («Por qué no», «¿Qué seguridad tenía?»), ejercicios (unidades, prefijos y coma decimal, pistas, solución,
«Resolver paso a paso», «Practicar con otros valores», los autoevaluados no dan XP), retos de práctica (predicción, reto
con la figura, «Monte el circuito», «Encuentre la avería»), «Teoría que se mueve» y calculadoras, simulador, editor y
protoboard, animaciones, 3D, placas e instrumentos, repaso espaciado, problema del día, racha, XP y objetivos, modo
docente (exámenes y cursos propios, hacer un examen, tiempo, variantes, nota y autoevaluación, PDF), datos y
sincronización (dónde se guardan, configurar GitHub, copias de seguridad, una sola pestaña y «Usar aquí», qué pasa al
actualizar y el consejo de la transición: sincronizar cada dispositivo justo antes de actualizarlo), actualizaciones
(escritorio y APK de Android), diagnóstico e informe de fallos (solo en el dispositivo; cómo copiarlo), teclado y
accesibilidad, y problemas frecuentes. Cada sección tiene sus apartados (`#/guia/<sección>/<apartado>` lleva directamente
a uno, con el foco en su título), los enlaces «Abrir en la aplicación» y la anterior y la siguiente. «Buscar en la guía»
filtra los apartados sin importar tildes ni mayúsculas y por el comienzo de las palabras. Enlaces «¿Cómo funciona?»: en
la página de sincronización, en el modo docente, en cada «Encuentre la avería» y en «Repaso de sus lecciones» del inicio.

El contenido está en `web/src/lib/guia/contenido.ts` (va dentro de la aplicación: no se descarga nada). **Mantenerla al
día**: quien cambie una función o el texto de un botón actualiza la guía; `tests/guia10-contenido.spec.ts` (sin
navegador) falla si un enlace de la guía no es una ruta de la aplicación, si un «¿Cómo funciona?» lleva a un apartado que
no existe, si un texto entre «» de la guía ya no está en la aplicación, si una sección del carril no se nombra ni se
enlaza en la guía o si aparece el tuteo. Pruebas: `EPA_SIN_SERVIDOR=1 PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx
playwright test -c playwright.guia10.config.ts tests/guia10-contenido.spec.ts` y, con compilación propia (puerto 4721,
`/tmp/claude-0/epa-guia10/dist`), `tests/guia10-navegador.spec.ts` (accesos, cada sección con el foco en su título, los
enlaces directos, el buscador con teclado, 44 px en el teléfono, axe en claro, sepia y oscuro y sin conexión).

## Miniaturas en las listas (0.10)

Las listas largas enseñan una miniatura de lo que abre cada fila, de tamaño fijo (nada se mueve cuando llega) y
pedida solo cuando la fila está a punto de verse:

- **Simulador** (índice de netlists y menú «Simular» cuando una figura tiene varias): el esquema automático de cada
  netlist, sin textos, dibujado con los colores del tema.
- **Búsqueda**: la primera figura de la sección encontrada; si no tiene, el esquema de su netlist; en los términos del
  glosario, su símbolo; si no hay nada, un hueco neutro.
- **Ejercicios y problemas**: la figura que contiene o enlaza el enunciado (4), si no el esquema de su netlist (133), si
  no un hueco neutro.
- **Componentes en 3D** y **Componentes animados**: la imagen del modelo 3D (en las animaciones, con el símbolo como
  insignia). Si faltara la imagen de un modelo, el catálogo la dibuja en el dispositivo con un único contexto WebGL.
- **Mis circuitos** (editor): el circuito tal como lo dibuja el editor, sin textos. **Mis montajes** (protoboard): la
  placa con sus piezas y cables, sin rótulos. Se dibujan en el dispositivo a partir de lo guardado, una vez por circuito
  y guardado: al editar un circuito guardado, su miniatura se rehace.

Todo está **precalculado** en `web/public/miniaturas/` (versionado, ≈ 2,9 MB: esquemas 430 kB en 48 ficheros por
capítulo, 649 figuras en WebP de 192 × 144 como máximo 2,1 MB, 39 modelos en WebP de 384 × 288 con fondo
transparente 270 kB), así que la tableta solo decodifica imágenes pequeñas fuera del hilo principal y no carga
three.js para ver un catálogo. Se regenera con:

```sh
cd web
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node scripts/miniaturas.mjs              # todo
node scripts/miniaturas.mjs --esquemas                                             # solo esquemas (sin navegador)
node scripts/miniaturas.mjs --figuras | --modelos [--forzar] [--solo tipo1,tipo2]
```

`contenido/generar.py` lo llama al final con `--esquemas --figuras` (solo se rehacen las figuras nuevas o cambiadas);
después de tocar los modelos 3D hay que ejecutar `--modelos --forzar`, y después de
`scripts/esquema-auto-precalcular.mjs`, `--esquemas`; después, `node scripts/circuitos-proporciones.mjs` (0.12: el tamaño del dibujo de cada netlist del libro, para que la página del simulador y el banco de instrumentos le guarden exactamente su sitio mientras se dibuja). Pruebas: `npx playwright test -c
playwright.miniaturas10.config.ts tests/miniaturas10.spec.ts` (puerto 4401): lo que muestra cada lista, carga
perezosa, sin saltos, contextos WebGL, tareas largas al desplazar con la CPU ×4 (`rendimiento.json`) y capturas en
`tests/capturas/miniaturas10/`.

## Diagnóstico de rendimiento

«Ajustes» (el botón «Aa» de la barra superior) → **Diagnóstico de rendimiento** (`#/diagnostico`) mide en el propio
dispositivo lo más pesado de la aplicación, para poder comparar el MacBook, la tableta y el móvil con números reales:

- la GPU tal como la ve WebGL 2 (nombre, versión, textura máxima, bits de profundidad, compilación paralela);
- el visor 3D de componentes (el QFP de 64 patillas): cuánto tarda el primer cuadro y cuánto de eso son los
  sombreadores (y si se compilan en paralelo), una segunda vista del mismo modelo (lo que la GPU ya tenía
  compilado), cuadros por segundo al girarlo y **la resolución al girar** (si ha tenido que bajarla para llegar a
  60 cuadros por segundo, hasta cuánto, y si vuelve a la completa al soltar);
- la placa del receptor SDR en 3D: cuánto tarda en verse, en tener todos los componentes, en tener **las caras a
  resolución completa** (con sus fases: pintar, leer los píxeles, subirlos a la GPU en franjas, y la tarea más
  larga que eso le ha costado a la página), a cuántos cuadros por segundo gira y su resolución al girar; desde la
  0.12 también de dónde salió el **entorno del estudio** («guardado», el de este dispositivo, o «calculado» ahora, la
  primera vez, con el estado de su guardado);
- **las caras de la placa SDR pintadas de las tres maneras** que tiene la aplicación (directo, como en la 0.7;
  trabajador, en un hilo aparte; franjas, por trozos en el hilo de la página), con lo que tarda cada una y el
  hueco más largo que deja en la página: así se ve en el propio Mac cuál le conviene (la aplicación elige
  «trabajador» en macOS y «directo» en Android y Windows; fuera de WebKit solo se mide el del dispositivo);
- **la placa de la Neo Geo en 3D** (0.9, la que colgaba la tableta): cuánto tarda en verse, en tener sus 320
  componentes (modelos, unión, sombreadores uno a uno) y las caras completas, el hueco más largo que deja en la
  página y la revisión de la geometría de las piezas;
- el trazado en vivo de cuatro esquemas automáticos grandes (el rectificador del capítulo 50, entre otros);
- una simulación corta con ngspice (la primera incluye la descarga y compilación del motor, la segunda no).

No se ejecuta nada hasta pulsar **Empezar**; se pueden desmarcar pruebas y elegir cuántos segundos gira cada vista 3D.
Al terminar se ve una tabla con los resultados y **Copiar resultados** deja el informe como texto para pegarlo en una
conversación. Conviene tener la aplicación en primer plano y no tocar la pantalla mientras mide.

Desde la 0.9 cada prueba deja **migas** en el almacenamiento local al empezar cada fase («datos», «geometría»,
«caras», «pieza 237: R1», «uniendo», «compilando», «primer cuadro»…, con su hora). Si una prueba cuelga o cierra la
aplicación, al volver a abrir el diagnóstico aparece arriba «La última prueba se quedó en: … tras N s», también en
«Copiar resultados» (el sistema guarda el almacenamiento a los pocos segundos de cada cambio, así que conviene esperar
un poco antes de cerrar a la fuerza una aplicación colgada). Las pruebas de la 0.9 (geometría de las piezas de la
Neo Geo, la Mega Drive y el SDR, el interruptor «Componentes» y las migas) se lanzan con `npx playwright test -c
playwright.neogeo09.config.ts tests/consolas-placas.spec.ts tests/proyectos-kicad.spec.ts tests/diagnostico.spec.ts`
(compilación propia en el puerto 4331).

**Registro de la aplicación** (0.9.2, al final de la página del diagnóstico): la aplicación apunta, con su hora, sus
errores (los no capturados, las promesas rechazadas y los `console.error`/`console.warn`), el inicio de cada ejecución
(versión, pantalla, memoria) y los pasos de las vistas pesadas: cada placa en 3D que se abre (tamaño, pads, modo y
tamaño de las caras), el principio y el final de sus caras a resolución completa, un contexto WebGL perdido y las
fases del diagnóstico. Cada línea se guarda al momento en el almacenamiento local (`epa-registro`, las 400 últimas),
así que sobrevive a un cierre de golpe. «Copiar errores» copia solo los errores y avisos, cada uno con las tres
líneas anteriores (lo que se estaba haciendo); «Copiar registro» lo copia entero, «Descargar» lo guarda como `.txt` y
«Borrar» lo vacía. Desde la 0.10 apunta también cada simulación (título del circuito, tiempo, errores de ngspice) y
cada pantalla visitada; cerrar una placa en 3D ya no se anota como «contexto WebGL perdido» (es la propia aplicación
la que devuelve la memoria de la GPU) y el tamaño de la placa sale en milímetros reales.

**Informe de fallos** (1.0, en el diagnóstico, tras el registro; `#/diagnostico/informe` lleva directamente a él):
cada fallo de la aplicación en este dispositivo, con su hora, la versión, la plataforma, la pantalla, el mensaje, las
primeras líneas de la pila y lo último que se hizo antes (las pantallas visitadas y acciones como «simulación» o
«placa 3D: abrir»). Recoge los errores no capturados, las promesas rechazadas, los componentes que fallan (y se
recuperan), los fallos del motor de simulación, los contextos WebGL perdidos, los problemas al leer o guardar, la
actualización de los datos que no se pudo hacer, los errores de sincronización (no los pasajeros, como no tener red),
las partes de la aplicación que no llegan y, en Tauri, los pánicos de la parte nativa. Si la aplicación se cierra de
golpe mientras se usa (la tableta Android lo hace cuando falla la GPU), la siguiente vez que se abre lo anota como
«Cierre inesperado» con lo que se estaba haciendo (en Android y en el navegador; no en la aplicación de escritorio,
que puede cerrarse sin avisar a la página, y una pestaña que solo está ocupada unos segundos no cuenta). Se guarda solo en el dispositivo (`epa-informe-fallos`, las 40
últimas entradas): nunca se sincroniza, no va en las copias de seguridad ni se envía a ningún sitio, y no incluye el
token de GitHub, ni su repositorio de datos, ni su nombre de usuario en las rutas de ficheros, ni sus textos (se
quitan antes de guardar). Desde la QA final de la 1.0, lo que usted escribe en la aplicación (respuestas, notas, textos
de un examen, búsquedas) se recuerda **solo en memoria** mientras la página está abierta —nunca se guarda— para tapar
como «[texto]» cualquier mensaje de error que lo repita, aunque no vaya entre comillas, sea corto o solo cite su
principio (antes solo se tapaban los fragmentos entre comillas de más de 32 caracteres). Tras un fallo aparece abajo un aviso discreto con «Ver el
informe»; «Copiar el informe» lo deja como texto para pegarlo en una conversación y «Borrar» lo vacía.

Si una figura viva, la vista 3D de una placa, los resultados de una simulación o una página entera fallan al
dibujarse, en su lugar aparece «No se ha podido mostrar …» con **Reintentar**, y el resto sigue funcionando; si la GPU
retira el contexto WebGL de una placa en 3D, «Reintentar» la vuelve a montar. Si falta una parte de la aplicación
(una copia vieja de la página después de actualizarla), se ofrece «Recargar la página». Pruebas: `EPA_SIN_SERVIDOR=1
npx playwright test -c playwright.rendimiento10.config.ts tests/rendimiento10-unidad.spec.ts` (sin navegador) y
`npx playwright test -c playwright.rendimiento10.config.ts tests/rendimiento10-navegador.spec.ts` (compilación propia en
el puerto 4651).

Para probar a mano otra manera de pintar las caras de las placas o la resolución fija, en la consola de
desarrollo: `localStorage.setItem('epa-caras', 'directo' | 'trabajador' | 'franjas')` y
`localStorage.setItem('epa-resolucion', 'fija')` (se quitan con `localStorage.removeItem(…)`). Las pruebas de
rendimiento de la 0.8 están en `tests/rendimiento.spec.ts` (`npx playwright test -c
playwright.rendimiento.config.ts`, compilación propia en el puerto 4261).

## Sincronización entre dispositivos y aviso de versión nueva

Marcadores, notas, progreso y repaso pasan de un dispositivo a otro (Mac, tableta, teléfono) a través de un
fichero JSON en un repositorio privado de GitHub del propietario. Se configura en «Aa» → «Sincronización» →
«Configurar» (página `#/sincronizacion`): token de GitHub, repositorio (por defecto `Metalaria/electronica-datos`)
y ruta del fichero (por defecto `sincronizacion/datos.json`). Con «Sincronizar automáticamente» (activado) se
sincroniza al abrir la aplicación, cada 5 minutos mientras está abierta, al pasar a segundo plano y al volver
tras más de un minuto; «Sincronizar ahora» lo hace al momento. «Desconectar» borra el token de este dispositivo.

**Qué viaja**: marcadores, notas, posición de lectura de cada capítulo, secciones leídas, progreso de ejercicios y
problemas, pasos vistos de las deducciones, tarjetas del repaso (SM-2) y su registro diario, ajustes del repaso,
resultados de los tests, preguntas falladas, exámenes, calculadoras favoritas y los circuitos del editor de
esquemas; desde la 0.11, también los XP, los logros, las lecciones superadas por la prueba de nivel y el resultado de
cada prueba. **Qué no**: tema, tamaño de letra, índice abierto o cerrado, elección 2D/3D y el circuito libre del
simulador (cosas de cada pantalla), sonido, vibración y recordatorio (de cada dispositivo), y los propios ajustes de
sincronización.

**Cómo se fusiona**: nunca se sobrescribe el fichero entero. Cada elemento (un marcador, una nota, una tarjeta…)
lleva la hora de su último cambio y gana el más reciente; un borrado viaja como «lápida» con su hora. La regla es
determinista (a igual hora decide el contenido), así que tres dispositivos acaban con los mismos datos sea cual
sea el orden. Cada sincronización lee el fichero con su `sha`, fusiona y lo escribe con ese `sha`; si otro
dispositivo escribió en medio (GitHub responde 409), vuelve a leer y a fusionar. Solo se escribe cuando algo ha
cambiado (un commit por sincronización con cambios, «Sincronización desde Mac (fecha)»). Las lápidas se borran a
los 90 días: un dispositivo que pase más tiempo sin sincronizar descarta sus copias sin cambios de lo que ya no está
en el fichero, pero podría recuperar algo borrado en otro si él lo había cambiado sin sincronizar. Si dos dispositivos
(o dos pestañas) repasan tarjetas el mismo día, el recuento diario del repaso (respuestas y tarjetas nuevas) se queda
con el mayor de cada uno: nunca cuenta dos veces, pero puede quedarse corto (antes se quedaba entero el del último que
sincronizaba); «Deshacer» una respuesta ya sincronizada sigue deshecha en todos (un dispositivo con la 0.10 o la 0.11
la sigue contando en su resumen del día); el objetivo diario y la racha, en cambio, suman lo de todos los dispositivos (0.12: cada dispositivo
guarda su propio registro de cada día).

**Paso a la 1.0 (desde la 0.12)**: la 1.0 guarda el fichero de sincronización en un formato nuevo (versión 2 del
formato, en la misma ruta). La 0.12 no puede escribirlo: al sincronizar dice «El fichero … no se puede usar: el fichero
tiene la versión 2 del formato; actualice la aplicación» y no toca nada; lo que se cambie en ella mientras tanto se
queda guardado en ese dispositivo y se envía en cuanto se actualice. **Antes de actualizar cada dispositivo,
sincronícelo**, y no responda ejercicios en un dispositivo que siga con la 0.12 cuando otro ya tenga la 1.0: la 0.12
no guarda la hora de cada respuesta, así que al actualizarlo todas las respuestas de un ejercicio que cambió ahí
cuentan como recientes, y una respuesta antigua puede sustituir a otra más nueva escrita en la 1.0 (o volver una
anterior a «Reiniciar»). **No borre el fichero de GitHub ni cambie la
ruta** aunque ese mensaje lo sugiera: las dos cosas parten la historia (un fichero nuevo es otra historia: podría
volver algo borrado en otro dispositivo, y los dispositivos ya no se verían entre sí). La página de
sincronización de un dispositivo con la 1.0 dice qué dispositivos faltan por actualizar. Los dispositivos con la 0.10
o la 0.11 ya no se pueden sincronizar con la 1.0 (hay que actualizarlos; sus datos se convierten al hacerlo). Al
abrir por primera vez la 1.0, los datos guardados se convierten a su formato (hoy solo cambia el progreso diario de
días anteriores a la 0.12) y antes se guarda una copia de cómo estaban: en `#/sincronizacion` → «Datos anteriores a
la actualización» se puede guardar en un fichero o restaurar. Volver a la 0.12 solo es posible en el escritorio
(restaurar los datos anteriores y reinstalar la 0.12 encima): en Android instalar una versión anterior obliga a
desinstalar, y eso borra los datos; y la 0.12 no puede sincronizar con el fichero de la 1.0 ni importar sus copias,
así que lo hecho en la 1.0 no le llega. Si una conversión fallase, la
aplicación lo dice, deja esos datos sin tocar (y no guarda cambios en ellos) y ofrece guardar los originales.

**Una sola pestaña (1.0, navegador)**: la aplicación solo se usa en una pestaña a la vez. Si se abre en otra, esa dice
«La aplicación está abierta en otra pestaña» con «Usar aquí»; al pulsarlo, la primera guarda lo pendiente, queda «en
pausa» y deja de guardar, y la nueva continúa. Si la otra pestaña está colgada, a los pocos segundos se ofrece «Usar
aquí de todos modos». En la aplicación instalada no hace falta (una sola ventana).

**Aviso de versión nueva**: al abrir la aplicación (como mucho cada 12 horas, sin esperar y sin decir nada si
falla o no hay red) se consulta la última publicación de `Metalaria/electronica-app`. El repositorio es público, así
que desde la 0.12 no hace falta token: sin él la consulta va sin credenciales (sin cabecera `Authorization`); con
él se envía (GitHub admite muchas más peticiones) y, si GitHub lo rechaza (caducado), se repite sin él. Nunca se
toca el repositorio de datos sin token. Las peticiones sin token comparten el límite de GitHub de 60 por hora y
dirección IP: si GitHub responde que se ha superado (403/429 con `x-ratelimit-remaining: 0` o `retry-after`), la
aplicación guarda hasta cuándo y no vuelve a preguntar antes; «Buscar actualizaciones» dice entonces a qué hora se
podrá. Si la versión publicada es más nueva que la instalada aparece abajo a la derecha «Versión X.Y.Z disponible»
con el principio de las notas, el instalador que toca a ese equipo y «Ver la publicación», que abre la página en el
navegador del sistema. «Ahora no» lo oculta hasta la siguiente versión; mientras «Aa» está abierto no se muestra
(«Aa» dice lo mismo). En «Aa» → «Buscar actualizaciones» se comprueba al momento. En el navegador (versión de
desarrollo) la comprobación al abrir solo se hace con token, para que las pruebas y el desarrollo no salgan a la red
sin pedirlo; el botón funciona igual.

**Actualización automática firmada (0.12, Windows y macOS)**: si la publicación trae `latest.json` (ver
«Actualizaciones automáticas firmadas» en «Compilar con GitHub Actions»), el aviso, «Aa» y la página
`#/sincronizacion` ofrecen «Descargar e instalar»: la aplicación descarga el instalador de ese sistema mostrando el
progreso y comprueba su firma con la clave pública de `tauri.conf.json` (y que la firma sea de la versión anunciada)
antes de instalar nada. En macOS la aplicación nueva sustituye a la actual al terminar la descarga y «Reiniciar para
terminar» la vuelve a abrir; en Windows «Reiniciar para terminar» cierra la aplicación, ejecuta el instalador NSIS
en modo pasivo (solo una barra de progreso) y la abre de nuevo. Antes de cerrar se guarda todo lo pendiente. Nada se
descarga ni se instala sin pulsar: al abrir solo se comprueba. Mientras descarga hay «Cancelar»; si no llega nada en
60 segundos (una conexión atascada) la descarga se da por perdida y sale «Volver a intentarlo», y en total no puede
pasar de 15 minutos. Si en Windows el instalador no llega a arrancar (por ejemplo, un antivirus lo bloquea), la
aplicación se vuelve a abrir sola y explica qué pasó. Los errores se explican en español (sin conexión, publicación
sin actualización automática, firma no válida, permisos de macOS…) y el enlace a la publicación sigue ahí. En Android (el plugin no lo admite), en Linux, en el navegador y mientras `tauri.conf.json` tenga la clave de
marcador, solo hay el aviso con el enlace, como antes.

**Copia de seguridad (0.12)**: en `#/sincronizacion` → «Copia de seguridad» (y en «Aa» → «Copia de seguridad»),
«Exportar copia» guarda todo el progreso en un fichero JSON (`electronica-copia-AAAA-MM-DD-HHMM.json`): cada
almacén sincronizable con sus elementos fechados y los borrados, más la versión del formato, la de la aplicación, la
fecha y el nombre del dispositivo. No lleva el token ni los ajustes propios del dispositivo. En el navegador se
descarga; en la aplicación instalada se elige dónde guardarlo con el diálogo del sistema (también en Android, donde
el WebView no admite descargas). «Importar una copia…» la abre, la comprueba (un fichero dañado o cortado, de otra
aplicación o de una versión más nueva se rechaza con un aviso y no cambia nada; los elementos dañados se descartan y
se cuentan) y enseña qué cambiará en cada apartado (nuevos, cambian, se borran). **«Unir»** (recomendado) aplica las
mismas reglas que la sincronización: de cada elemento queda la versión más reciente, lo que se borró después de hacer
la copia sigue borrado, nada de lo que hay en el dispositivo se pierde, e importar dos veces la misma copia no cambia
nada; lo importado se envía a los demás dispositivos en la siguiente sincronización. **«Sustituir todo»** deja los
datos como en la copia (también en los demás dispositivos al sincronizar); pide confirmación y antes guarda una copia
automática de los datos actuales (en el navegador, en IndexedDB; en la aplicación, en su propio fichero
`copia-automatica.json`), que se puede guardar como fichero, y **«Deshacer la sustitución»** la recupera (con su propia
confirmación; antes guarda a su vez una copia automática de los datos de ese momento). Importar esa copia con «Unir» no
recuperaría nada —las versiones de la sustitución son más recientes—, así que al importar un fichero que es una copia
automática se propone «Sustituir» y se explica por qué. También se puede importar el propio `datos.json` de GitHub. Al unir
una copia antigua, lo que tenga más de 90 días y este dispositivo ya no conozca se deja fuera (puede haberse borrado
después, y sus lápidas ya no están en el fichero): la vista previa dice cuántos elementos son y permite incluirlos. Si
el dispositivo tiene token pero aún no se ha sincronizado, la vista previa aconseja sincronizar antes.

**Una sola instancia (0.12, escritorio)**: abrir la aplicación cuando ya está abierta trae al frente la ventana
existente en lugar de arrancar un segundo proceso que escribiría también en `lector.json`
(`tauri-plugin-single-instance`).

Pruebas (0.12), desde `web/`: `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c
playwright.plataforma12.config.ts` (puerto 4511) prueba la comprobación sin token y el límite de GitHub, la interfaz
del actualizador con el lado de Tauri simulado (Windows, macOS, Android, clave de marcador, errores, accesibilidad en
los tres temas), el icono del recordatorio y la parte de la CI (`latest.json` con el paso real de `compilar.yml`, un
`gh` simulado y claves de prueba hechas con `tauri signer`); con `EPA_SIN_SERVIDOR=1 … actualizador-ci`, solo la parte
de la CI, sin compilar la aplicación. Solo se pueden comprobar en los equipos: la descarga y verificación reales del
plugin, la sustitución del `.app` y el instalador NSIS, el reinicio y la instancia única.

**Seguridad**: el token solo se guarda en el dispositivo, en un fichero propio de la aplicación
(`credenciales.json`, junto a `lector.json` pero separado de él); en el navegador de desarrollo, en
`localStorage` (`epa-credencial:github`), que cualquiera con acceso a ese perfil del navegador podría leer. Nunca
se escribe en el repositorio, en el fichero sincronizado ni en los registros, y en pantalla solo se ven sus
cuatro últimos caracteres.

### Crear el repositorio de datos y el token (una vez)

1. En github.com, con la cuenta Metalaria: «+» → «New repository». Owner: `Metalaria`. Repository name:
   `electronica-datos`. Description: «Datos sincronizados del lector» (opcional). Visibilidad: **Private**.
   Marcar «Add a README file» (el repositorio no puede estar vacío para la API). .gitignore: None. License: None.
   «Create repository». El fichero `sincronizacion/datos.json` lo crea la aplicación en la primera sincronización.
2. Foto de perfil → «Settings» → «Developer settings» (abajo a la izquierda) → «Personal access tokens» →
   «Fine-grained tokens» → «Generate new token».
3. Token name: `Electrónica — sincronización`. Description: «Sincronización y aviso de versiones del lector»
   (opcional). Resource owner: `Metalaria`. Expiration: «Custom…» y una fecha de dentro de un año (cuando caduque,
   la aplicación dirá «GitHub rechaza el token (401)» y bastará con generar otro y pegarlo).
4. Repository access: «Only select repositories» → elegir solo `Metalaria/electronica-datos` (las publicaciones de
   `Metalaria/electronica-app`, que es público, se leen sin token).
5. Permissions → «Repository permissions»: **Contents: Read and write**. «Metadata: Read-only» aparece sola y es
   obligatoria. Todo lo demás en «No access»; en «Account permissions», nada.
6. «Generate token» y copiarlo (empieza por `github_pat_`; solo se muestra una vez).
7. En cada dispositivo: «Aa» → «Sincronización» → «Configurar» → pegar el token → «Guardar y sincronizar».

Si `Metalaria` fuese una organización y no la cuenta personal, su propietario debe permitir los tokens
fine-grained («Settings» de la organización → «Personal access tokens» → «Allow access via fine-grained personal
access tokens») y, si lo pide, aprobar el token.

(Hasta la 0.11 el token incluía también `electronica-app` para el aviso de versión; ya no hace falta, y un token que
lo incluya sigue funcionando.) Si se elige también `electronica-app`, con Contents: Read and write el token podría
escribir en él (un token fine-grained da los
mismos permisos en todos los repositorios elegidos); la aplicación solo lee sus publicaciones y solo escribe el
fichero de datos. Quien prefiera dos tokens de permisos mínimos no puede: la aplicación usa uno solo.

## Dónde se guardan los datos personales

| Plataforma | Ubicación |
|---|---|
| Windows | `%APPDATA%\es.gonzalomejias.electronica\lector.json` |
| macOS | `~/Library/Application Support/es.gonzalomejias.electronica/lector.json` |
| Android | almacenamiento interno de la aplicación (se borra al desinstalarla) |
| Linux | `~/.local/share/es.gonzalomejias.electronica/lector.json` |
| Navegador (desarrollo) | `localStorage`, claves `epa:dispositivo-local` (0.12: identificador de este dispositivo para su registro de actividad diaria; no se sincroniza), `epa:prefs`, `epa:posiciones`, `epa:marcadores`, `epa:notas`, `epa:ejercicios`, `epa:leidas`, `epa:deducciones`, `epa:calc-favoritos`, `epa:repaso-tarjetas`, `epa:repaso-diario`, `epa:repaso-ajustes`, `epa:repaso-tests`, `epa:repaso-fallos`, `epa:repaso-examenes`, `epa:progreso-diario`, `epa:progreso-objetivo`, `epa:progreso-xp`, `epa:cursos`, `epa:dominio`, `epa:problema-dia`, `epa:editor-circuitos`, `epa:protoboard-circuitos`, `epa:protoboard-recorrido`, `epa:protoboard-leccion`, `epa:medir-pista`, `epa:sinc-ajustes`, `epa:sinc-estado`, `epa:sinc-marcas`, `epa:sinc-version`, `epa:docente`, `epa:docente-resultados`, `epa:laboratorio` (1.1: los laboratorios guiados), `epa:proyectos` (1.1: los proyectos por etapas; sus circuitos van en `epa:editor-circuitos`), `epa:esquemas` (1.0: versión del formato de cada clave; no se sincroniza) y, aparte, `epa-credencial:github` (el token) |

El token de GitHub va en otro fichero de la misma carpeta, `credenciales.json`, para que copiar `lector.json` no
lo lleve consigo. `lector.json` guarda además el estado de la sincronización (`sinc-*`: ajustes, última versión
sincronizada de cada elemento, horas de los cambios y borrados pendientes, última comprobación de versión).

El fichero `lector.json` es JSON legible: para llevar marcadores, notas y el progreso (ejercicios, secciones
leídas, deducciones, tarjetas y tests del repaso) de un equipo a otro basta copiarlo con la aplicación cerrada. Desde
la 0.12 es mejor la «Copia de seguridad» (página de sincronización): no arrastra el identificador del dispositivo ni
sus ajustes y se une con lo que ya haya. Desde la 1.0, la clave `esquemas` dice en qué versión del formato está cada clave, y antes de convertir los datos a una versión nueva se guarda una copia de los originales (en IndexedDB `epa-copias` en el navegador; en la aplicación, en `copia-automatica.json`). La copia automática que se guarda antes de «Sustituir todo» va en
`lector.json` (clave `copia-automatica`) en la aplicación y en IndexedDB (`epa-copias`) en el navegador.

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

Lee las fuentes del libro (sin modificarlas) y escribe `web/public/libro/`: `indice.json`,
`refs.json`, `glosario.json`, `busqueda.json`, `partes/*.json` y las imágenes (`fig/`, `img/`, `ec/`). El
formato está descrito en `ESQUEMA.md`. Esa carpeta **se versiona** (unos 119 MB): las máquinas de GitHub
Actions no pueden regenerarla, porque hacen falta las fuentes del libro, las tipografías y las fotos, que
están en otra máquina.

**Dónde está el libro (1.2).** Toda la cadena (`generar.py`, `spice.py`, `repaso.py`, `fm7303.py`,
`proyectos_kicad*.py`, `formulas_enriquecer.py`, `datos_figuras_recolocar.py`, `paratexto/`) lo busca en un solo sitio,
`contenido/fuentes.py`: la variable de entorno **`EPA_FUENTES`**, la carpeta `Fuentes/` del repositorio del libro (la
misma variable que lee su `herramientas/construir.py`); `Complementos/` va a su lado. Sin ella, el libro 4.1 en
`/home/claude/libro-integra/Fuentes`. También vale la carpeta de trabajo antigua `/home/claude/v3` (con `complementos`
dentro). En otro equipo, por ejemplo:

```sh
EPA_FUENTES=~/electronica-libro/Fuentes python3 contenido/generar.py
```

Las ecuaciones necesitan `typst` (0.15) en el PATH; las figuras, `pdftocairo`; los proyectos KiCad, `kicad-cli`; las
miniaturas, el Chromium de Playwright.

1.1: los ejercicios nuevos que aún no están en el libro (`contenido/ejercicios_nuevos11/*.yaml`) los añade
`contenido/ejercicios_nuevos.py` a `ejercicios.json` y `busqueda.json`; lo llama `contenido/ejercicios.py` al terminar
(también desde `generar.py`), y se puede ejecutar solo (`--comprobar` no escribe nada; `--typst FICHERO`, el texto para el
libro). Ver «Aprender con el libro».

1.1: las ampliaciones del libro que aún no están en él (`contenido/ampliaciones11/<ID>/`) las convierte y fusiona
`contenido/ampliaciones.py`; `generar.py` lo llama en dos fases (tras escribir las partes y tras `ejercicios.py`), y
también se puede ejecutar solo. Ver «Ampliaciones del libro (1.1)».

1.1: las lecciones hechas a mano (`contenido/lecciones11/`) solo necesitan las partes ya generadas: `node
web/scripts/lecciones11.mjs` las comprueba y escribe `web/public/libro/lecciones11/` (`--comprobar` no escribe nada;
`--solo cap01/sec-1.4`, una sola). Ver «Lecciones hechas a mano (1.1)».

`contenido/glosario_imagenes.py` (también llamado al final de `generar.py`, o solo) escribe
`web/public/libro/glosario-imagenes.json`: el símbolo de circuito y el modelo 3D de cada término del glosario,
según una tabla revisada a mano por término (más unas pocas reglas por nombre) e indica la cobertura (hoy 137
términos con símbolo, 75 con modelo 3D, 54 con ambos y 896 sin imagen, de 1 054).

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

`dev`, `build` y `check` preparan antes los motores de simulación (`web/scripts/ngspice.mjs`): copian el de
XSPICE de `web/vendor/ngspice-xspice/` (que sí se versiona) a `web/src/simulador/motor/ngspice-xspice.js` y
`web/public/ngspice/ngspice-xspice.wasm`, y extraen el de reserva de `node_modules/eecircuit-engine` a
`web/src/simulador/motor/ngspice.js` y `web/public/ngspice/ngspice.wasm`; ninguno de esos cuatro se versiona.

El motor con XSPICE (ngspice 45.2 con todas las bibliotecas de modelos de código enlazadas dentro) se compila
con `web/scripts/ngspice-wasm/compilar.sh`, que fija las versiones y sumas de todo lo que descarga (Emscripten
6.0.3, LLVM 23.1.4 y binaryen 129, todo de GitHub) y explica en su `README.md` cómo y por qué. Solo hace falta
para cambiar de versión de ngspice: GitHub Actions usa el binario versionado. Para comparar los dos motores con
las 313 netlists: `node scripts/validar-spice.mjs --motor xspice|eecircuit --salida informe.json`. Sus pruebas
en el navegador (las cuatro netlists XSPICE del libro, las piezas digitales del editor y el motor de reserva):
`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.xspice.config.ts`.

Pruebas de extremo a extremo con Playwright (compilan la web, la sirven en el puerto 4173 y abren Chromium;
en esta máquina el navegador ya está instalado en `/opt/pw-browsers`):

```sh
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npm test
```

Simulan once netlists de todos los tipos de análisis y comparan sus medidas con los valores que da el libro,
prueban los controles deslizantes, la gráfica (lectura, cursores, zoom), los errores, las netlists XSPICE (y el
aviso del motor de reserva) y el enlace desde el lector, y dejan capturas de teléfono y de ordenador, en tema claro y oscuro, en
`web/tests/capturas/` (no se versionan). En otro equipo, `npx playwright install chromium` descarga el
navegador.

Medida de un salto entre capítulos en un «teléfono lento» (CPU ×6, pantalla de 412 × 915), con la web ya
servida (`npx vite preview --port 4173`):

```sh
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tests/rendimiento.mjs
```

Protoboard (0.10): su prueba de Playwright, con su propio puerto (4351) y su carpeta de compilación en la carpeta
temporal del sistema, abre «Ver en protoboard» en diez netlists del libro, en un dibujo del editor y en una figura,
comprueba que no aparece en una figura que es solo un dibujo ni en las consolas, mueve una pata y mira que
cambian la netlist y el esquema, simula el circuito cambiado, da la vuelta a un LED, cierra y comprueba que el
esquema sigue igual, guarda un montaje propio, prueba el tacto a 412 y 800 px, monta un circuito de puertas en
chips 74HC (alimentados, con las entradas libres atadas y el aviso de entrada CMOS al aire al quitar una),
simula desde la placa el contador asíncrono montado con 74HC74 y 74HC86 (cuenta hacia arriba) y avisa al quitar
el cable de una XOR a su D, añade
una puerta a mano, abre la protoboard desde el menú de herramientas y deja capturas (tableta y
teléfono, claro y oscuro) en `web/tests/capturas/protoboard10/`. La de los instrumentos (`instrumentos10.spec.ts`,
misma configuración) sigue el tutor en un divisor (tensión de una pieza, corriente abriendo el circuito, resistencia
con «Hazlo por mí»: cada paso detectado y la lectura igual que la simulación), provoca y comprueba los errores
explicados (punta roja en el borne A, amperímetro en paralelo, óhmetro alimentado), ve un 555 con AUTO a su
frecuencia, mide un RC alimentado por el generador, escucha el 555 (nivel del analizador de Web Audio), prueba el
tacto a 412 y 800 px (con una punta arrastrada) y el «Medir» del editor, y deja capturas en
`web/tests/capturas/instrumentos10/`:

```sh
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.protoboard10.config.ts tests/protoboard10.spec.ts
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.protoboard10.config.ts tests/instrumentos10.spec.ts
```

Protoboard (0.11): `proto11.spec.ts` (`playwright.proto11.config.ts`, puerto 4441, compilación en la carpeta
temporal del sistema) usa gestos táctiles de verdad a 800 × 1280 y 412 px: arrastra una tarjeta de la bandeja a
la placa (el fantasma enseña sus dos agujeros y sus tiras; una suelta encima de otra pieza se rechaza con el
motivo; una pieza cortocircuitada por su tira también), tocar tarjeta y luego placa, la barra flotante (girar,
voltear, 330 Ω de las fichas con sus bandas naranja-naranja-marrón, ‹ › de la E12, un valor escrito, quitar),
cables toque a toque y arrastrando (rojo al +, negro a masa), mover un extremo y quitar con pulsación larga y
«Deshacer», completa los cinco montajes de «Monta este circuito» hasta la celebración, un paso mal (cable al
carril equivocado, LED al revés) con su explicación y su arreglo, la lección «La protoboard por dentro» (tira
encendida, canal, carril, preguntas bien, mal y con segundo intento, saltarla y que no vuelva), el recorrido de
la primera vez, que nada desborda a 412 px y un usuario nuevo cronometrado (LED, resistencia y fuente montados
y simulados con el LED encendido en menos de un minuto); capturas en `web/tests/capturas/proto11/`:

```sh
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.proto11.config.ts tests/proto11.spec.ts
```

Revisión independiente de la 0.11: `revision11.spec.ts` (`playwright.revision.config.ts`, puerto 4471, compilación en
`/tmp/epa-dist-revision`) reproduce cada defecto encontrado y comprueba su arreglo: terminar una guía de la protoboard
no pisa el montaje guardado ni el borrador; el problema del día resuelto en un dispositivo no se pierde frente al mismo
día sin resolver en otro (con GitHub simulado y, en Node, una simulación de dos dispositivos con las reglas del motor:
convergen sin ir y venir); la unión de rondas del dominio se guarda en el acto y sobrevive a una sincronización
interrumpida; las celebraciones posteriores a la primera se ven; un fallo al calcular los logros no deja sin XP ni rompe
la sincronización; el problema del día prefiere un «Calcule» del curso y el capítulo al que ha llegado el lector; el
corte de día del dominio en los cambios de hora; el cambio de día a las 04:00 con la página abierta; los eventos de
aprendizaje sobreviven a un fallo al cargar sus consumidores; y dos pestañas ya no se pisan los datos:

```sh
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.revision.config.ts tests/revision11.spec.ts
```

La segunda y la tercera revisión del motor de sincronización tienen su especificación sin navegador,
`revision11-motor.spec.ts`, que ejecuta el motor **real** en Node (`tests/motor-real/`: un grafo de módulos por
dispositivo y por pestaña, almacenamiento y GitHub simulados con conflictos 409, y el motor de la 0.10 para un
dispositivo que no se ha actualizado): un escenario por cada hallazgo de los revisores (un almacén que no se puede
escribir, un borrado durante una pasada, un valor que el almacén rechaza, la unión de rondas en el fichero,
normalizaciones opuestas, la memoria vieja de un módulo, un `aplicar` que falla a medias, lápidas podadas con el reloj
atrasado, valores por defecto, volver a la 0.10, la unión asociativa, otra edición mientras se aplica, una petición
colgada) y una simulación al azar con tres dispositivos con pestañas, uno de la 0.10 y una instalación nueva
(ediciones y borrados sin conexión, el almacenamiento que rechaza escrituras, módulos no atómicos, relojes desfasados,
pasadas interrumpidas, ediciones durante una pasada, otro dispositivo que escribe entre la lectura y la escritura) que
comprueba que no se pierde nada, que nada borrado vuelve, que todos acaban igual y que los commits se detienen (desde la 0.12, si el `aplicar` de un almacén falla, la pasada lo vuelve a leer y registra como aplicado lo
que ya tiene como el fichero: un módulo no atómico que fallaba a medias con un elemento nuevo dejaba perder la
edición hecha encima con el reloj atrasado; escenario `b12·20`, prueba 61139; y una pasada cortada después de su
escritura deja constancia de lo que envió, para que la siguiente no resucite lo que otro dispositivo borró después:
`b12·21`, prueba 71337):

```sh
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.revision.config.ts tests/revision11-motor.spec.ts
```

La misma especificación prueba también un solo `Guardado` al azar (`tests/motor-real/guardado-azar.ts`, con un
almacenamiento como el de Tauri y como el del navegador): ediciones y borrados en cualquier momento, lecturas y
escrituras que fallan y una carga que falla y se reintenta, sin perder nada de lo que hizo el lector. Que el editor y la
protoboard avisan (con «Reintentar») cuando no pueden leer o guardar «Mis circuitos» o «Mis montajes» se comprueba en
el navegador:

```sh
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.revision.config.ts tests/revision11-avisos.spec.ts
```

La colocación automática de **todos** los circuitos que tienen el botón (las 313 netlists del libro y los 31
esquemas simulables de las figuras) se comprueba en Node: cada uno montado sin error, cada red del esquema una
sola red de la placa, ninguna unida a otra, todas las patas en agujeros, un solo cable por agujero y ningún
cuerpo encima de otro. Con `--escribir` deja las netlists de los montajes junto a las originales para pasarlas
por el motor y comparar sus medidas:

```sh
node tests/protoboard10.mjs                      # resumen; --detalle, --solo cap22, --svg carpeta --png
node tests/protoboard10.mjs --escribir /tmp/pb   # y luego:
node scripts/validar-spice.mjs --dir /tmp/pb/original --salida /tmp/pb/original.json --hilos 1
node scripts/validar-spice.mjs --dir /tmp/pb/montaje --salida /tmp/pb/montaje.json --hilos 1
node tests/protoboard10-medidas.mjs /tmp/pb
```

Coste por fotograma de los esquemas vivos (perfiles `mac`, `tableta`, `movil`; CPU ×4), con la web servida:

```sh
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tests/figuras-vivas.mjs --perfil mac
```

Datos de la 1.0 (formato estable, migraciones, transición desde la 0.12, una sola pestaña activa):
`tests/datos10.spec.ts` (puerto 4601) comprueba en Node el registro de migraciones (copia previa una sola vez,
idempotente, una migración que falla deja el almacén intacto y bloqueado, sin sitio para la copia no se migra nada,
datos de una versión más nueva, «Restaurar»), el fichero y las copias del formato 1 y del 3, la unión de los
ejercicios (5000 tríos), los escenarios `t10·1–11` del motor real con la 0.12.0 sacada de git (no escribe el fichero
nuevo, sus cambios llegan al actualizarse, la carrera con un 409, la vuelta atrás, el exceso de una 0.11 en el
fichero, las copias entre versiones, dos pestañas al actualizar, los ejercicios en dos dispositivos, «Reiniciar»
contra intentos viejos, la migración al arrancar, 2000 mapas de días contra la 0.12.0 y el modo docente) y 2 × 40
pruebas al azar con un dispositivo en la 0.12.0 que se actualiza a mitad; y en el navegador el aviso de una
migración que falla, «Datos anteriores a la actualización» y los dispositivos que faltan por actualizar.
`tests/datos10-pestanas.spec.ts` abre dos y tres pestañas reales: la pantalla de la segunda, el relevo que guarda lo
pendiente, que nunca escriben dos a la vez, una pestaña colgada, una cerrada de golpe, recargar, atrás y adelante, sin
Web Locks y axe en los tres temas:

```sh
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.datos10.config.ts tests/datos10.spec.ts tests/datos10-pestanas.spec.ts
node --experimental-transform-types --no-warnings --import ./tests/motor-real/registrar.mjs tests/motor-real/correr.ts casos t10
node --experimental-transform-types --no-warnings tests/actualizacion/escenario.ts [tauri] [0.11.0|0.10.1]   # de la 0.12.0 (por defecto) a la 1.0 y vuelta
```

Datos de la 0.12 (copia de seguridad y suma diaria entre dispositivos): `tests/datos12.spec.ts` (puerto 4521)
comprueba en Node que la unión de los registros por dispositivo es conmutativa, asociativa e idempotente y que el día
suma cada dispositivo una vez (3000 casos al azar), la regla de los días de la 0.11, el plan de importación (2000
casos: nada local se pierde, nada borrado después vuelve, importar dos veces no cambia nada), los escenarios del motor
real `d12·…` y `c12·…` (dos dispositivos el mismo día, el objetivo cumplido solo sumando, datos de la 0.11, un
dispositivo con la 0.11 que suma encima, dos pestañas; importar y sincronizar con otros dos, una copia vieja tras
borrar, ficheros dañados, importar durante una pasada, el almacenamiento lleno, «Sustituir todo», qué lleva la copia;
y `r12·1`, dos pestañas que guardan a la vez), los de la revisión independiente de la 0.12 (`a12·1–6`: el registro
antiguo de un día sumado dos veces entre pestañas, una copia de hace más de 90 días que resucitaba lo borrado, un paso
deshecho que una 0.11 volvía a contar, la compactación de días pasados, una pestaña duplicada y las marcas de una
importación fallida), lo que se guarda antes de instalar una actualización con un almacenamiento lento
(`tests/actualizacion/salir.ts`), y 60 pruebas de la simulación al azar, que ahora incluye el progreso diario con el módulo real y copias que se
exportan e importan; y en el navegador la exportación, la importación con su vista previa, los ficheros dañados,
«Sustituir todo», «Aa», el objetivo del inicio con dos dispositivos, un teléfono de 360 px, los 44 px de los controles
táctiles y axe en los tres temas. `tests/datos12-pestanas.spec.ts` abre dos pestañas reales de Chromium que guardan a
la vez: cada pestaña lee su propia copia de `localStorage` y la de la otra le llega después, así que una escritura puede
pisar la de la otra aunque se compruebe antes de escribir; desde la 0.12 la pestaña cuyo cambio se pisó lo conserva y lo
vuelve a escribir, salvo que haya pruebas de que el otro cambio es posterior (sin esto se perdían 20 de 40 pasos).
`tests/revision12b-pestanas.spec.ts`, `tests/revision12c-pestanas.spec.ts` y `tests/revision12d-pestanas.spec.ts` (segunda, tercera y cuarta revisión independiente)
y los escenarios `b12·1–17` comprueban, con dos y
tres pestañas reales, que ese mecanismo no entra en bucle (una favorita quitada y vuelta a poner en otra pestaña se
reescribía miles de veces; ahora una marca solo es «de esta pestaña» si coinciden valor y hora, y un freno deja de
reescribir enseguida durante 10 s —solo cada 3 s—, sin perder nada, un elemento que se ha reescrito más de 8 veces en
5 s, y si se cierra la pestaña en ese rato lo pendiente se guarda igual), que cada pestaña vuelve a poner las marcas de
sus cambios que otra pestaña desfasada borró, que una copia desfasada del propio registro del día no hace contar pasos
de más y que el resumen del día que leen la 0.10 y la 0.11 es la suma de los registros, que una pestaña duplicada
tiene su propio registro aunque la original esté ocupada, que con el reloj atrasado el cambio nuevo sigue ganando, que
la sincronización aplica lo recibido aunque no quepa la anotación de lo aplicado (con la cuota casi llena), que lo
importado o sincronizado no lo deshace una pestaña desfasada que escribe encima, que un cambio que se une al de otra pestaña al guardarse
(una unión de rondas, por ejemplo) se sincroniza con lo que quedó guardado, y que un dispositivo que vuelve tras más de
90 días no trae registros ya compactados. La actualización desde datos de la **0.11.0** se prueba como la de la 0.10.1:

```sh
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.datos12.config.ts tests/datos12.spec.ts tests/datos12-pestanas.spec.ts
node --experimental-transform-types --no-warnings --import ./tests/motor-real/registrar.mjs tests/motor-real/correr.ts azar 130 0   # (de 130 en 130: con muchas más por proceso se queda sin memoria; la 1.0 extrae la 0.12.0 de git)
```

### Pruebas de QA exhaustivas (0.11)

Además de las pruebas de cada función, `web/tests/qa/` recorre **toda** la aplicación como lo haría una persona y
anota lo que encuentra en vez de pararse en el primer fallo. Tiene su propio puerto (4421) y su carpeta de
compilación en la carpeta temporal del sistema, así que puede correr a la vez que las demás:

```sh
cd app/web
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers nice npx playwright test -c playwright.qa.config.ts                   # completa
QA_MODO=rapido PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers nice npx playwright test -c playwright.qa.config.ts    # rápida
```

- **Tres perfiles**: la tableta del dueño (Xiaomi Pad 6: 800 × 1280 px, densidad 2,5, WebView de Android, táctil,
  tema claro; visita todas las rutas), un teléfono (412 × 915, táctil, tema oscuro) y un escritorio (1366 × 900,
  tema claro); estos dos, una muestra fija de una de cada cuatro rutas. `--project=tableta` corre solo uno.
- **Rastreo** (`rastreo.spec.ts`): unas 3 250 rutas sacadas de los datos (partes, secciones, figuras con el visor
  abierto, glosario, las 313 netlists en el simulador y en el editor, protoboard, instrumentos, kit FM7303,
  consolas × pestañas, placas KiCad × vistas, animaciones, modelos 3D, conceptos, calculadoras, ejercicios, repaso,
  diagnóstico, sincronización, «Aa», la búsqueda y el menú de herramientas). En cada página: errores y avisos de la
  consola, peticiones fallidas (404), texto que se sale de su caja o de la pantalla, desplazamiento horizontal,
  botones tapados o solapados, objetivos táctiles de menos de 40 px, saltos del diseño (CLS), cosas que aparecen y
  desaparecen en menos de un segundo empujando la página (como la línea «Simulando con ngspice…» de la 0.10.0),
  tareas de más de 200 ms, imágenes sin tamaño, «NaN», «undefined», «null», «[object Object]» o «Infinity» a la
  vista, textos en inglés, botones sin nombre, campos sin etiqueta, contraste (calculado) y contextos WebGL vivos o
  sin liberar al salir del 3D. Mide también si la memoria crece tras navegar por 60 páginas.
- **Barridos funcionales** (`barridos.spec.ts`, en la tableta): cada netlist simula (o muestra el aviso de que no se
  puede) y un segundo «Simular» no hace parpadear nada; cada lección «Estudiar por pasos» se recorre pantalla a
  pantalla contestando cada práctica primero mal y luego bien, y las preguntas de repaso; cada «Ver en protoboard»
  se abre, se comprueba, se simula y se cierra; cada placa de consola y de proyecto se abre en 3D y en 2D; cada
  calculadora da el resultado del ejemplo del libro; cada ejercicio autocomprobable acepta la respuesta del libro; y
  existe cada figura, imagen y ecuación que cita el libro.
- **Mono** (`monos.spec.ts`): en 33 páginas interactivas (también la práctica inteligente, el problema del día y
  una lección con fila explorable), toques, arrastres, pellizcos, escritura, deslizadores, Atrás/Adelante y giros
  de la pantalla al azar pero con semilla: cada fallo se anota con la semilla y los últimos pasos. Para repetir
  uno: `QA_SEMILLA=<semilla> QA_FILTRO=<página> … tests/qa/monos.spec.ts --project=tableta`.
- **Accesibilidad** (`accesibilidad.spec.ts`, en el escritorio): foco visible con el tabulador y contraste en tema
  oscuro.
- **Segunda fase** (`fase2-*.spec.ts`, todas a la vez con `tests/qa/fase2-*.spec.ts`):
  - `fase2-fugas`: tres vueltas seguidas por todas las vistas 3D y páginas pesadas, y otras tres por las figuras
    explorables de las lecciones (moviendo su deslizador, que simula), la práctica inteligente, el problema del día y
    el dominio; tras cada vuelta cuenta contextos WebGL, lienzos, `AudioContext`, workers, intervalos, bucles de
    animación y la memoria (tras recoger basura). Lo que crece de vuelta en vuelta es una fuga.
  - `fase2-lento`: una ruta de cada tipo en un equipo lento (CPU × 4 y red «Fast 3G»): tiempo hasta ver el
    contenido (umbral 3 s) y hasta quedarse quieta; y la misma ruta con los JSON del contenido cortados: tiene que
    avisar con «Reintentar» y recuperarse al volver la red, nunca quedarse «cargando» o a medias sin decir nada.
  - `fase2-analizadores` y `fase2-editor`: el comprobador de respuestas con todas las unidades × prefijos ×
    formatos, los números SPICE y parámetros de las 313 netlists, las calculadoras contra los ejemplos del libro, y
    la ida y vuelta de las 313 netlists por el editor de esquemas (en Node y en la página): mismos elementos, mismas
    conexiones y los nodos que miden sus `.control`.
  - `fase2-estado`: recargar a mitad de cada lección, de una simulación, del editor, de la protoboard y de los
    instrumentos; atrás y adelante por 30 rutas al azar (tres semillas); toques dobles y triples en los botones
    principales (también «Empezar» y «Saltar» de la práctica inteligente); el almacenamiento lleno y bloqueado
    (guardar avisa y «Reintentar» guarda; sin almacenamiento nada dice «Guardado»); dos pestañas a la vez poniendo y
    quitando marcadores y notas (ninguna deshace lo de la otra, tampoco tras recargar); recargar a mitad de una práctica
    inteligente, del problema del día y de una figura explorable; salir a mitad de una simulación o de una carga
    3D; textos raros y muy largos en cada campo. Las páginas del aprendizaje (práctica, problema, dominio, filas
    explorables) entran todas en `fase2-estado`, `fase2-lento` y `fase2-axe`, no solo una de cada tipo.
  - `fase2-maquetacion`: todas las rutas en siete variantes más (tableta apaisada, móvil de 360 px, pantalla
    partida a 600 y 700 px, la letra más grande, el tema sepia y el escritorio al 200 %), que son proyectos propios
    (`--project=apaisada`, `movil360`, `partida600`, `partida700`, `letra-grande`, `sepia`, `zoom200`).
  - `fase2-contenido`: cada referencia cruzada, enlace y recurso del contenido existe, la numeración no salta, y la
    búsqueda encuentra cada término del glosario y cada sección por su título.
  - `fase2-axe`: auditoría axe-core (dependencia de desarrollo) de una ruta de cada tipo en la tableta y el teléfono,
    en claro y en oscuro; y los recorridos principales solo con teclado en el escritorio.
  - `fase2-textos`: los textos de la interfaz (sacados del código con los analizadores de Svelte y TypeScript):
    ortografía con `nspell` y el diccionario `dictionary-es` (dependencias de desarrollo; las palabras del libro
    cuentan como conocidas), trato de usted, restos en inglés y nombres escritos de dos maneras.
  - `fase2-visual`: unas 80 rutas comparadas píxel a píxel con la 0.10.1 (compilada aparte desde su commit y
    servida en otro puerto, `QA_VIEJO=http://localhost:4423/`); lo que cambia más del 0,5 % queda con una imagen
    «antes | ahora | diferencia» para revisarla.

Variables: `QA_MODO=rapido` (muestra fija de ≈ 1 de cada 12 rutas, lecciones y circuitos: unos 40 min),
`QA_FILTRO=<expresión>` (solo las rutas cuyo identificador encaja, p. ej. `'^simulador:cap05/'`), `QA_SEMILLA` y
`QA_PASOS` (mono), `QA_WORKERS` (1 por defecto), `QA_INFORME=<carpeta>` (el informe en otra carpeta, para no
mezclarlo con otra pasada), `QA_TRAZA=1` (una línea por ruta o pantalla, para ver por dónde va) y `QA_PILAS=1`
(la pila de llamadas de cada aviso o error de la consola, para saber qué código lo da). La pasada completa es larga (varias horas en esta máquina):
se puede partir con `--shard=1/3`, `--shard=2/3`, `--shard=3/3` (lanzados uno tras otro, el informe junta los
tramos).

**El informe** queda en `web/tests/qa/informe/` (no se versiona): `informe.md` es el resumen en castellano
(cobertura por perfil, número de grupos por gravedad y, para cada grupo, qué pasa, dónde —la firma del elemento—,
en qué rutas y una captura en `capturas/`), e `informe.json` lo mismo para máquinas. Las gravedades son cuelgues y
errores, funcionales, visuales y de maquetación, rendimiento, accesibilidad y textos. Un mismo problema visto en 300
rutas es un solo grupo. `tests/qa/triaje.json` apunta lo ya revisado (corregido, solo informado, falso positivo o
pendiente de decisión del dueño) y el informe lo muestra junto a cada grupo; si en una pasada aparece algo que el
triaje da por corregido, el informe lo avisa arriba (en una compilación con los arreglos es un arreglo incompleto o
una regresión). Para rehacer el informe sin volver a
pasar las pruebas: `node tests/qa/informe.ts`. Las pruebas de regresión de lo corregido gracias al arnés están en
`tests/regresiones11.spec.ts` (`-c playwright.regresiones11.config.ts`, puerto 4422).

**Desde la 0.12** el arnés pasa también por todo lo nuevo, en los tres perfiles y en las siete variantes de la
maquetación: la tarjeta «Copia de seguridad» (vista previa, «Sustituir todo», resultado, ficheros dañado, ajeno o de
una versión más nueva, y «Deshacer la sustitución»), «Exportar copia» de «Aa», la confirmación propia («Borrar» un
montaje, «Nuevo» en el editor), los estados del actualizador en «Aa», en el aviso y en la página de sincronización (con
el puente de prueba de Tauri y una publicación de GitHub simulada) y la actividad del día sumada entre dispositivos.
`tests/qa/novedades12.spec.ts` los recorre de principio a fin (exportar e importar en «otro dispositivo», dos veces,
sustituir y deshacer; Escape, «Cancelar» y «Atrás» en la confirmación; cancelar y reintentar una descarga; la fila
«Entorno del estudio» del diagnóstico; cada placa 3D abierta dos veces para ver que el entorno se calcula una vez y se
lee la siguiente). Con `QA_SIN_COMPILAR=1` se sirve la compilación ya hecha (una sola para una pasada partida en
varios comandos) y `QA_VIEJO_NOMBRE=0.11.0` pone el nombre de la versión con la que compara `fase2-visual`. Las
pruebas de regresión de lo corregido en la 0.12 están en `tests/regresiones12.spec.ts` (`-c
playwright.regresiones12.config.ts`, puerto 4431).

Lo que cambió en la aplicación gracias al arnés (0.11): nada que llegue tarde empuja ya lo que se está leyendo
(el circuito del simulador, los paneles de problemas y los botones del lector, las figuras, el glosario, el banco
de instrumentos), los avisos de carga solo salen si la carga tarda, la barra del simulador ya no parpadea con la
simulación de fondo del circuito dibujado, el gris «tenue» del texto se ha oscurecido hasta 4,5:1 en los tres temas
y en pantallas táctiles los controles pequeños tienen una zona de toque de 44 px sin cambiar de aspecto. En la
segunda fase: el editor de esquemas conserva los nombres de los nodos y todas las conexiones al abrir una netlist
del libro; sin red, cada página dice qué no ha podido cargar y ofrece «Reintentar» (y lo que falló ya no se queda
guardado como fallo); los textos de la interfaz que tuteaban tratan ya de usted; el resumen de la práctica
inteligente espera a que se anoten las respuestas de la sesión (con la máquina cargada salía sin ellas); y en
pantallas táctiles la fórmula de una calculadora abre un elector con un botón grande por magnitud, el índice del
glosario va en dos filas de letras de 44 px y las muestras del código de colores miden 44 px; abrir y cerrar una
placa en 3D ya no deja la placa entera en memoria cada vez; y el tema sepia oscurece un poco sus colores de acento
y de estado para que se lean con el contraste debido.

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

Las instrucciones parten de cero: equipo recién instalado, repositorio `electronica-app` (público) ya creado
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
rustup target add aarch64-linux-android
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

10. Compilar el APK (solo ARM de 64 bits, la arquitectura de la Xiaomi Pad 6, el Pixel 8 Pro y cualquier
    Android de 2017 en adelante; un Android de 32 bits no podría instalarlo):

```sh
node scripts/tauri.mjs android build --apk --target aarch64
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

El flujo `.github/workflows/compilar.yml` compila los tres instaladores en máquinas de GitHub con cada
etiqueta `v…` y a mano desde la pestaña «Actions». Subir algo a `main` no compila: en octubre de 2026 se
agotaron los 2000 minutos gratuitos del mes (en un repositorio privado cada minuto de macOS cuenta por 10
y cada uno de Windows por 2) y cada versión se compilaba dos veces, con `main` y con su etiqueta. Tiene
seis trabajos:

| Trabajo | Máquina | Resultado |
|---|---|---|
| Preparar la release | `ubuntu-latest` | solo con etiquetas `v…`: crea la «Release» como borrador |
| Windows (.exe y .msi) | `windows-latest` | `Electronica-<versión>-windows-x64-setup.exe` y `…-windows-x64.msi` |
| macOS (.dmg universal) | `macos-latest` | `Electronica-<versión>-macos-universal.dmg` (Apple Silicon e Intel) |
| Android (.apk firmado) | `ubuntu-latest` | `Electronica-<versión>-android.apk` (arm64-v8a) |
| Firmar la actualización automática | `ubuntu-latest` | solo con etiquetas `v…`: el único que ve la clave del actualizador; firma el `.exe`, el `.msi` y el `.app.tar.gz` y sube los `.sig` |
| Publicar en Releases | `ubuntu-latest` | solo con etiquetas `v…`: junta las sumas en `SHA256SUMS.txt`, genera `latest.json` (actualización automática) y publica la «Release» |

Con una etiqueta, cada trabajo de compilación sube sus instaladores directamente a la «Release» en
borrador, y el último la publica cuando están los tres. No se usan artefactos de Actions: ocupan la cuota
de almacenamiento del repositorio privado, y con la cuota llena la compilación de la v0.9.0 falló al
subirlos (los ficheros de una «Release» no cuentan). Una ejecución a mano desde «Actions» guarda los
instaladores como artefactos durante un día.

Cada plataforma genera su fichero `SHA256SUMS-…txt` con las sumas de comprobación. El trabajo de Android
genera el proyecto con `tauri android init`, copia los iconos y configura la firma con
`npm run android:preparar`, a partir de cuatro secretos del repositorio.

**Coste**: en un repositorio privado, los minutos de Windows y, sobre todo, de macOS consumen la cuota
gratuita de GitHub Actions mucho más deprisa que los de Linux, y los artefactos ocupan cuota de
almacenamiento (por eso solo se guardan en las ejecuciones a mano, y un día; los ficheros de una «Release»
no cuentan ni caducan). Consulta el consumo en «Settings» → «Billing and plans» de tu cuenta.

### 1. Crear el repositorio (público)

El repositorio de la aplicación es **público** desde la 0.11 (los datos personales van en otro, privado:
`electronica-datos`). Tiene que serlo: con el plan gratuito de GitHub, los entornos con secretos y reglas de
despliegue (el entorno `firma` del apartado 6) solo existen en repositorios públicos, y las aplicaciones instaladas
leen `…/releases/latest/download/latest.json` y la última publicación sin credenciales. En github.com, botón «+»
(arriba a la derecha) → «New repository». Rellenar el formulario así:

- «Owner»: tu cuenta personal.
- «Repository name»: `electronica-app`.
- «Description»: `Lector de «Electrónica Práctica Avanzada» (Svelte 5 + Tauri 2)`.
- Visibilidad: «Public».
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

El envío a `main` no compila nada (solo las etiquetas `v…`, en el paso 5). Para lanzarla a mano: pestaña
«Actions» → «Compilar» (a la izquierda) → «Run workflow» → «Branch: main» → «Run workflow».

### 4. Descargar los instaladores

Con una etiqueta `v…`, en la «Release» de esa versión (a la derecha de la página del repositorio). Sin
etiqueta, solo en una ejecución lanzada a mano: pestaña «Actions» → la ejecución (marca verde) → abajo, en
«Artifacts», pulsar `Electronica-Windows`, `Electronica-macOS` o `Electronica-Android`. Cada uno se
descarga como `.zip` con el instalador y su suma SHA-256. Se borran al día siguiente.

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

Las aplicaciones instaladas ven la publicación nueva al abrirse (como mucho cada 12 horas, con o sin token) y
muestran «Versión X.Y.Z disponible»; el principio del texto de la publicación sale en el aviso. En Windows y macOS,
si la publicación trae `latest.json`, el aviso ofrece además «Descargar e instalar» (siguiente apartado).

### 6. Actualizaciones automáticas firmadas (Windows y macOS, una vez)

Desde la 0.12 la aplicación de escritorio se actualiza sola, con permiso del lector: lee
`https://github.com/Metalaria/electronica-app/releases/latest/download/latest.json`, descarga el instalador de su
sistema y comprueba su firma con la clave pública que lleva dentro (`plugins.updater.pubkey` de
`src-tauri/tauri.conf.json`). Hacen falta un par de claves de firma (minisign, del Tauri CLI), distinto del de
Android: la privada y su contraseña se guardan como secretos del **entorno** `firma` del repositorio (GitHub
Environments), que solo admite etiquetas `v*`, y la pública va en `tauri.conf.json`.

**Una etiqueta `v*` no se publica sin esto**: como la clave pública queda compilada dentro de la aplicación, una
versión publicada con el marcador `CLAVE-PUBLICA-PENDIENTE…` dejaría a quien la instale sin actualización automática
para siempre. Por eso, en una etiqueta, el trabajo «Preparar la release» falla (antes de crear el borrador) si la
clave pública es el marcador o falta el secreto; «Firmar la actualización automática» falla si la pareja de claves no
casa, si falta alguno de los tres instaladores que firma o si lo descargado no es lo que subió su trabajo de
compilación, y «Publicar en Releases» falla si a `latest.json` le falta una plataforma (en todos los casos la
«Release» se queda en borrador). Para publicar **a propósito** una versión sin actualización automática, la variable del repositorio
`EPA_PERMITIR_SIN_ACTUALIZADOR` con el valor `1` (se quita después). Una ejecución a mano desde «Actions» sobre una
**rama** («Use workflow from: Branch: main») nunca recibe la clave: compila sin firmar, con un aviso. Lanzada a mano
sobre una **etiqueta** («Use workflow from» → «Tags» → `v…`) se comporta exactamente como la compilación de esa
etiqueta: recibe la clave, es estricta y publica (o completa) su «Release».

Los trabajos que compilan **nunca** ven la clave privada (ahí se ejecuta código de terceros: los plugins de Vite,
los `build.rs` de las dependencias, los scripts de npm). Dejan sin firmar en el borrador de la «Release» el `.exe` y el
`.msi` de Windows y un `.app.tar.gz` de la aplicación de macOS; después, el trabajo «Firmar la actualización
automática», el único con el entorno `firma`, descarga esos tres, los firma con el Tauri CLI instalado aparte (solo
ese paquete, sin scripts de instalación y comprobado contra `web/package-lock.json`), comprueba cada firma con la
clave pública y sube los `.sig`.

Se hace una vez, antes de etiquetar la 0.12.0, en WSL (o el Terminal de macOS o Linux), desde la carpeta del
repositorio, con Node.js y GitHub CLI con la sesión iniciada (`gh auth login`):

```bash
cd ~/electronica-app
```

```bash
mkdir -p ~/electronica-firma
```

```bash
(cd web && npx --yes @tauri-apps/cli@2.12.3 signer generate -w ~/electronica-firma/electronica-actualizador.key)
```

Pide una contraseña dos veces: elija una y guárdela junto a las de Android. Deja
`~/electronica-firma/electronica-actualizador.key` (privada, cifrada con esa contraseña) y
`~/electronica-firma/electronica-actualizador.key.pub` (pública). Guarde copia de las dos con las claves de
Android: **si se pierde la privada o su contraseña, las aplicaciones instaladas ya no aceptarán actualizaciones** y
habrá que instalar a mano la versión con la clave nueva.

El entorno `firma`, que solo admite etiquetas `v*` (se puede repetir: el primero lo deja igual; el segundo, si la
regla ya existe, responde que ya está):

```bash
gh api --method PUT repos/Metalaria/electronica-app/environments/firma -F 'deployment_branch_policy[protected_branches]=false' -F 'deployment_branch_policy[custom_branch_policies]=true'
```

```bash
gh api --method POST repos/Metalaria/electronica-app/environments/firma/deployment-branch-policies -f name='v*' -f type=tag
```

Los dos secretos, en ese entorno (el primero, sin saltos de línea; el segundo pregunta la contraseña y la pega
usted):

```bash
tr -d '\r\n' < ~/electronica-firma/electronica-actualizador.key | gh secret set TAURI_SIGNING_PRIVATE_KEY --env firma --repo Metalaria/electronica-app
```

```bash
gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD --env firma --repo Metalaria/electronica-app
```

La clave pública en `tauri.conf.json` (sustituye el marcador) y su comprobación, que debe decir «clave pública
válida» con el mismo id que muestra `base64 -d ~/electronica-firma/electronica-actualizador.key.pub` en su primera
línea («untrusted comment: minisign public key: …»; el fichero está en base64, así que sin decodificar no se ve):

```bash
node -e "const fs=require('fs'),os=require('os'),path=require('path');const f='src-tauri/tauri.conf.json';const c=JSON.parse(fs.readFileSync(f,'utf8'));c.plugins.updater.pubkey=fs.readFileSync(path.join(os.homedir(),'electronica-firma','electronica-actualizador.key.pub'),'utf8').trim();fs.writeFileSync(f,JSON.stringify(c,null,2)+'\n')"
```

```bash
node web/scripts/actualizador.mjs clave
```

Para comprobar el entorno: la primera orden debe dar `protected_branches: false` y `custom_branch_policies: true`; la
segunda, una sola regla `v*` de tipo `tag`; la tercera, los dos secretos; y la cuarta (secretos del repositorio) no
debe listar ninguno `TAURI_SIGNING_*` (si aparecen de una prueba anterior, bórrelos con `gh secret delete
TAURI_SIGNING_PRIVATE_KEY --repo Metalaria/electronica-app` y lo mismo con `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`):

```bash
gh api repos/Metalaria/electronica-app/environments/firma --jq '.deployment_branch_policy'
```

```bash
gh api repos/Metalaria/electronica-app/environments/firma/deployment-branch-policies --jq '.branch_policies[] | {name, type}'
```

```bash
gh secret list --env firma --repo Metalaria/electronica-app
```

```bash
gh secret list --repo Metalaria/electronica-app
```

Después, confirmar `src-tauri/tauri.conf.json` en `main` y etiquetar como siempre (apartado 5).

**Acciones fijadas por SHA.** `compilar.yml` fija cada acción (`actions/checkout`, `actions/setup-node`,
`actions/setup-java`, `actions/upload-artifact`, `dtolnay/rust-toolchain`, `Swatinem/rust-cache`) a un SHA de 40
caracteres con la etiqueta como comentario (`uses: dueño/acción@<sha> # etiqueta`): una etiqueta se puede mover, y
estas acciones ven el entorno del trabajo. Para pasar a una etiqueta nueva, cambie el comentario `# etiqueta` y la
línea a `dueño/acción@etiqueta` y vuelva a fijarla con este comando, en WSL desde `~/electronica-app`; deja
intactas las líneas ya fijadas y muestra cada cambio (los pasos de `dtolnay/rust-toolchain` llevan
`toolchain: stable`, que esa acción deduce de la etiqueta y perdería al fijarla):

```bash
python3 - <<'PY'
import re, subprocess
p = '.github/workflows/compilar.yml'
s = open(p, encoding='utf-8').read()
cache = {}
def fijar(m):
    accion, ref = m.group(2), m.group(3)
    if re.fullmatch(r'[0-9a-f]{40}', ref):
        return m.group(0)
    if (accion, ref) not in cache:
        cache[(accion, ref)] = subprocess.run(['gh', 'api', f'repos/{accion}/commits/{ref}', '--jq', '.sha'], check=True, capture_output=True, text=True).stdout.strip()
        print(f'{accion}@{ref} -> {cache[(accion, ref)]}')
    sha = cache[(accion, ref)]
    assert re.fullmatch(r'[0-9a-f]{40}', sha), sha
    return f'{m.group(1)}{accion}@{sha} # {ref}'
s2 = re.sub(r'^(\s*uses: )([\w.-]+/[\w.-]+)@([\w.-]+)[^\n]*$', fijar, s, flags=re.M)
open(p, 'w', encoding='utf-8').write(s2)
PY
```

```bash
git diff --stat .github/workflows/compilar.yml
```

Qué hace la CI con ellos (`web/scripts/actualizador.mjs`):

- «Preparar la release» (solo etiquetas): `actualizador.mjs exigir` comprueba la clave pública y que el secreto
  exista (sin verlo: solo si está vacío).
- Windows y macOS compilan sin la clave (`npm ci --ignore-scripts`; `tauri build --no-bundle` y luego `tauri bundle`,
  reintentado si falla una descarga de NSIS o WiX o `hdiutil`: cada intento parte de una copia intacta del binario,
  porque el empaquetador marca en él, sobre la marcha, el tipo de instalador, y un intento fallido lo dejaría marcado
  con el tipo equivocado). macOS empaqueta además la `.app` en `…-macos-universal.app.tar.gz`, con la misma forma que
  la de `createUpdaterArtifacts` (un tar.gz cuya primera carpeta es la `.app`, con sus enlaces simbólicos).
- «Firmar la actualización automática» (solo etiquetas, entorno `firma`) empieza cuando han terminado todos los
  trabajos de compilación, Android incluido, y comprueba que cada fichero descargado tiene la suma SHA-256 que dio su
  trabajo (salidas del trabajo, no ficheros de la «Release», que otro trabajo podría haber cambiado); si no, no firma
  nada. Después, `actualizador.mjs firmar` firma los tres con
  `tauri signer sign --app-version X.Y.Z` (la versión queda dentro de la firma, como con `createUpdaterArtifacts`, y la
  aplicación exige que coincida: `requireSignedVersion`), verifica cada `.sig` con la clave pública de
  `tauri.conf.json` y los sube a la «Release» con `SHA256SUMS-firmas.txt`. En una etiqueta, cualquier firma que falte o
  no se verifique hace fallar el trabajo y la «Release» se queda en borrador.
- «Publicar en Releases» genera `latest.json` a partir de los `.sig` de la «Release» (solo los de esa versión y de
  esa clave), lo sube mientras aún es borrador (así `…/releases/latest/download/latest.json` nunca apunta a una
  publicación a medias) y lo añade a `SHA256SUMS.txt`.
- `latest.json` lleva `windows-x86_64-nsis` (el `-setup.exe`), `windows-x86_64-msi` (el `.msi`, para quien instaló
  con él), `windows-x86_64` (el `-setup.exe`, para una instalación de tipo desconocido; solo si están las dos firmas
  de Windows, para que una instalación MSI nunca reciba el NSIS) y `darwin-aarch64` y `darwin-x86_64` (el mismo
  `.app.tar.gz` universal).
- Los `checkout` no guardan el token (`persist-credentials: false`).

Las versiones hasta la 0.11 no tienen actualizador: la 0.12 se instala a mano una vez (con el aviso, como
siempre); a partir de ahí, cada versión nueva se ofrece para instalar desde la propia aplicación.

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
    ampliaciones.py          (1.1) las ampliaciones del libro: conversión, fusión, numeración, deshacer
    ampliaciones11/          (1.1) una carpeta por ampliación (Typst, figuras, netlists, repaso, datos, ampliacion.json),
                             numeracion.json (números citados en las fuentes curadas) y fuentes/ (Fira Math e Inter, OFL)
  web/                       aplicación (Svelte 5 + TypeScript + Vite)
    index.html
    package.json             scripts: dev, build, check, tauri, android:preparar
    scripts/tauri.mjs        lanza la CLI de Tauri con src-tauri/ como proyecto nativo
    scripts/android-preparar.mjs  iconos, firma y (1.1) enlaces epa:// del proyecto Android generado (npm run android:preparar)
    scripts/android-enlaces.mjs   el filtro de intención del esquema epa en el manifiesto generado (1.1)
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
        Carril.svelte        carril de iconos (ordenador y tableta apaisada), del registro HERRAMIENTAS
        Pestanas.svelte      barra inferior del teléfono y la tableta en vertical
        MenuHerramientas.svelte  «Más» (junto al carril o como hoja en el teléfono)
        Lateral.svelte       panel del índice junto al carril, o cajón en el teléfono
        IndiceLibro.svelte   índice: tomos, capítulos, secciones, filtro, sección actual, teclado
        Barra.svelte         barra superior: mostrar/ocultar índice, miga, sección anterior/siguiente, «Aa», progreso
        MenuCapitulo.svelte  menú de la miga: secciones del capítulo y capítulos contiguos
        Ajustes.svelte       tema y tamaño del texto; diagnóstico; sincronización y versión (sincronizacion/GrupoAjustes)
        Inicio.svelte        portada (trozo aparte, 0.9): saludo, «Seguir leyendo», racha, objetivo, repaso, camino del libro
        inicio/              SeguirLeyendo, Racha, Objetivo, RepasoHoy (+ repasoHoy.ts, perezoso), CaminoLibro, destino
        ui09/                primitivas del lavado de cara 0.9 (con el estilo 1.1 desde la 1.1): Tarjeta, BotonPrincipal,
                             BarraSegmentos, Chip, Rotulo (+ ui09.css)
        cursos/              (0.11) página de cursos, un curso, la prueba de nivel y el avance de cada curso
        progreso/            (0.11) «Progreso y logros», insignias, celebración de fin de lección, destello del
                             acierto, contador de XP, avisos flotantes, «Sonido y vibración» y recordatorio en «Aa»
        vista-previa/        tarjeta de vista previa de las referencias (trozo perezoso; el controlador es
                             lib/vistaPrevia.ts)
        glosario/            imágenes del glosario: simbolo.ts (símbolos de esquema-auto en SVG), imagenes.ts
                             (glosario-imagenes.json y miniaturas 3D perezosas)
        Lector.svelte        vista de un capítulo: posición, referencias, «Volver»
        Bloques.svelte       dibuja cada tipo de bloque (recursivo)
        Seccion.svelte       título de sección con marcador y nota
        Ecuacion.svelte, Figura.svelte, Tabla.svelte, Ejercicios.svelte
        VisorFigura.svelte   figura a pantalla completa con zoom y desplazamiento
        Glosario.svelte      glosario con letras, filtro, símbolo y miniatura 3D
        Busqueda.svelte      búsqueda (MiniSearch)
        Marcadores.svelte    marcadores y notas
        BotonSimular.svelte  «Simular» junto a figuras, secciones, problemas y ejercicios
        animaciones/         componentes animados: catálogo (enlaces al libro), galería, página, escenas/
                             (una por animación, se cargan al abrirla), nucleo/ (física, dibujo), ui/
        grafica/             gráfica interactiva reutilizable (canvas): API en ESQUEMA.md
        fm7303/              el kit FM7303 vivo: esquema con pan y zoom, modelo de continua, física de la
                             alineación, señal, osciloscopio, multímetro, averías (ver «Kit FM7303»)
        instrumentos/        Brymen BM869s y FNIRSI 2C53T virtuales, banco de pruebas y prácticas guiadas
                             (motor/ en TypeScript puro; ver «Instrumentos» y ESQUEMA.md)
        figuras-vivas/       figuras vivas: lectura de gráficas, esquemas con corriente y tensión, circuito
                             del simulador (ver «Figuras vivas» y ESQUEMA.md)
        simulador/           vistas del simulador: Simulador (rutas), Indice, Pagina, Parametros,
                             Resultados, Editor, PestanasSimulador (se cargan solo al abrir el simulador)
        editor/              editor de esquemas (#/editor): lienzo, paleta, propiedades, netlist generada,
                             importación de netlists, resultados sobre el dibujo, «Mis circuitos» (su propio
                             trozo, solo al abrir la pestaña; ver «Editor de esquemas» y ESQUEMA.md)
        protoboard/          protoboard virtual (0.10): colocación automática, dibujo de las piezas, mesa táctil,
                             conexiones y netlist, avisos, «Ver en protoboard» y «Mis montajes» (ver «Protoboard»)
        sincronizacion/      página #/sincronizacion, grupos de «Aa», arranque diferido y aviso de versión nueva;
                             (0.12) «Copia de seguridad» (CopiaSeguridad.svelte, exportar.ts)
        diagnostico/         página #/diagnostico: medidas de rendimiento en el propio dispositivo (pruebas.ts)
        consolas/placa/      «Placa en 3D / 2D» de las consolas con el visor de proyectos/ (datos de consolas_pcb.py)
        proyectos/           Proyectos KiCad: placa en 3D (three.js, modelos de tres/modelos; los cuerpos propios
                             de las piezas de las consolas en cuerpos3d.ts) y en 2D, esquema,
                             simulación y comprobaciones de las siete placas (ver «Proyectos KiCad» y ESQUEMA.md)
        tres/                componentes en 3D: biblioteca de modelos paramétricos (modelos/, crearModelo),
                             visor (motor/: también la resolución adaptable al girar, resolucion.ts),
                             interruptor Animación | Pieza 3D, catálogo, página de modelo, «Ver en 3D»
        Insignia.svelte, Icono.svelte
      lib/
        tipos.ts             tipos del contenido (ESQUEMA.md)
        datos.ts             carga del contenido, rutas de recursos, HTML de las referencias
        ruta.svelte.ts       rutas con almohadilla, historial y posición de cada entrada
        enlaces.ts           enlaces de los QR del libro, epa://leccion/<parte>/<sección> (1.1); enlaces-app.ts los recibe de Tauri
        foco-ruta.ts         1.0: el foco al título de la página tras cambiar de ruta y «Saltar al contenido»
        habla-matematicas.ts 1.0: las ecuaciones (fuente Typst) y las unidades en palabras para lectores de pantalla
        navegacion.svelte.ts registro HERRAMIENTAS (una entrada por sección), índice oculto por vista,
                             secciones anterior/siguiente y filtro del índice
        usuario.svelte.ts    preferencias, posiciones, marcadores y notas
        almacen.ts           Tauri plugin-store o localStorage
        aprendizaje/         (0.11) eventos de aprendizaje (eventos.ts, consumidores.ts), sonido y vibración
                             (retroalimentacion.ts), XP y niveles (niveles.ts, progreso.svelte.ts), logros
                             (logros.ts), cursos (cursos.ts, cursos-estado.svelte.ts), recordatorio diario
                             (recordatorio.ts) y la cola de avisos (avisos.svelte.ts)
        sincronizacion/      sincronización por GitHub (fusion.ts, github.ts, credenciales.ts, marcas.ts,
                             guardado.ts: cómo guarda cada módulo lo que tiene en memoria sin pisar lo
                             sincronizado, registro.svelte.ts: los almacenes sincronizables, sincronizar.svelte.ts),
                             comprobación de versiones (actualizaciones.svelte.ts) y, desde la 0.12, actualización
                             automática firmada de escritorio (instalador.svelte.ts, actualizador.ts), la copia de
                             seguridad (copia-formato.ts: formato, comprobación y plan; copia.ts: exportar e
                             importar; fichero.ts: guardar y abrir ficheros) y el identificador del dispositivo
                             (dispositivo.ts)
        progreso-dias.ts     (0.12) la actividad del día sumada entre dispositivos (registros por dispositivo)
        buscador.ts          índice de búsqueda y fragmentos
        trozos.ts            división de un capítulo en tramos para dibujar solo lo visible
        precarga.ts          preparación en segundo plano de los capítulos a los que se puede saltar
        color.ts             acentos de cada bloque temático en cada tema
        acciones.ts          capas (cajón, búsqueda, visor) ligadas al botón Atrás
        vistaPrevia.ts       vista previa de las referencias: escuchas delegadas (ratón, toque, teclado); la
                             tarjeta se carga aparte (componentes/vista-previa/)
        muestra/             contenido de muestra que sigue ESQUEMA.md
      simulador/             motor (ngspice en WebAssembly), worker, cliente, netlists: ver ESQUEMA.md
  src-tauri/                 envoltorio nativo (Tauri 2, Rust)
    tauri.conf.json          nombre, identificador, ventana, CSP, instaladores
    capabilities/default.json  permisos: el almacén de datos y abrir enlaces http(s) en el navegador (opener); ninguno
                               de diálogos ni de ficheros (la copia de seguridad usa dos órdenes propias, src/lib.rs)
    capabilities/movil.json    (0.11, solo Android/iOS) vibración (haptics) y el recordatorio (notification)
    capabilities/escritorio.json  (0.12, solo escritorio) actualización automática (updater) y reinicio (process)
    recursos-android/        (0.12) recursos propios del APK: el icono pequeño del recordatorio
                             (drawable/ic_stat_epa.xml) y la regla que lo conserva (raw/epa_conservar.xml), copiados
                             al proyecto generado por web/scripts/android-preparar.mjs; la CI comprueba que está en el APK
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
- **Seguridad**: la CSP de Tauri solo permite recursos propios y conexiones a `https://api.github.com`
  (sincronización y aviso de versión); los permisos nativos son el almacén de datos y abrir una página http(s)
  en el navegador del sistema (`tauri-plugin-opener`, para la página de la publicación nueva). Desde la 0.12, en
  todas las plataformas, la copia de seguridad: dos órdenes propias de la aplicación (`guardar_fichero_elegido` y
  `abrir_fichero_elegido`, en `src-tauri/src/lib.rs`) muestran el diálogo del sistema y escriben o leen, desde Rust,
  solo el fichero elegido (`tauri-plugin-dialog` y `tauri-plugin-fs` se usan solo desde Rust; la vista web no tiene
  ningún permiso `dialog:*` ni `fs:*`, porque `tauri-plugin-fs` 2.7.1 abre las URL `file://` —y en Android
  `content://`— sin mirar su ámbito, así que un permiso de escritura dejaría escribir en cualquier sitio; la lectura
  se limita a 50 MB de texto UTF-8; 1.0: la misma orden guarda también el PDF del modo docente, que llega en base64
  con su tipo de fichero, y sigue sin dejar a la vista web elegir dónde se escribe); solo en escritorio, la actualización
  automática (`tauri-plugin-updater`: descarga desde github.com en el lado nativo, no desde la vista web, y verifica
  la firma minisign con la clave pública de `tauri.conf.json` antes de instalar), el reinicio
  (`tauri-plugin-process`) y una sola instancia (`tauri-plugin-single-instance`). Desde la 0.11, solo
  en Android: la vibración (`tauri-plugin-haptics`, que declara el permiso `VIBRATE`) y el recordatorio diario
  (`tauri-plugin-notification`, que declara `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED` para restaurarlo tras
  reiniciar y `WAKE_LOCK`). Los permisos llegan al APK al fusionar los manifiestos de esas bibliotecas, así que el
  proyecto `src-tauri/gen/android` que genera la CI no necesita ningún cambio; en el ordenador no se enlazan
  (dependencias de Rust solo para Android/iOS y la capacidad `capabilities/movil.json`, limitada a esas
  plataformas).
- **Confirmaciones (0.12)**: «Borrar» un montaje de la protoboard y «Nuevo» en el editor con un circuito sin guardar
  preguntan con un diálogo propio de la aplicación («Cancelar» / «Borrar» o «Descartar»; Escape cancela), igual en el
  navegador, el escritorio y Android, en lugar de `window.confirm`: en el escritorio `tauri-plugin-dialog` lo
  sustituye por una función asíncrona (siempre «sí»: la 0.12 sin este arreglo borraba sin preguntar), en macOS la vista
  web de wry no tiene diálogo de confirmación (en la 0.11 «Borrar» no hacía nada) y en Android sale un cuadro nativo
  con «OK»/«Cancel» en inglés. Una prueba impide volver a usar `alert(`, `confirm(` o `prompt(` en `web/src`.
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
