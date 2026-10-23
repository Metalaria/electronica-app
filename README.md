# Electrónica Práctica Avanzada — lector

Aplicación privada y sin conexión para leer «Electrónica Práctica Avanzada» en Windows, macOS y Android.
Es una sola aplicación web (Svelte 5 + TypeScript + Vite) empaquetada con Tauri 2. Todo el contenido se
genera a partir de las fuentes Typst del libro, de modo que una corrección en un capítulo llega a la
aplicación con solo regenerar y volver a compilar.

Incluye la fase 1 (el lector) y la fase 2 (el simulador de circuitos, con las 309 netlists del libro). Las
fases siguientes (ejercicios, modelos 3D, editor de esquemas) están descritas en `ESQUEMA.md`.

## Qué hace

- **Navegación**: a la izquierda, un **carril de iconos** con todas las secciones de la aplicación por orden de
  uso (Libro, Buscar, Simulador, Calculadoras, Ejercicios, Repaso, Componentes, Conceptos, Instrumentos, Kit
  FM7303, Consolas, Glosario, Marcadores; el logotipo lleva a Inicio), cada una con su nombre debajo y la marca de
  la actual; si la ventana es baja, las últimas pasan a «Más». Junto al carril, el **índice del libro**: tomos
  plegables con su barra de lectura → capítulos con su anillo → secciones, con la sección que se lee resaltada y
  siempre a la vista (botón «Ir a la sección actual» si se ha desplazado el índice), las leídas marcadas y un
  **filtro** por palabras sin tildes o por número («5.8», «cap 33», «ap B»). El índice se oculta con el botón de
  la barra superior (o pulsando «Libro» mientras se lee) y se recuerda por herramienta: en el simulador, las
  consolas y demás herramientas empieza oculto para dejarles todo el ancho. En la barra superior, la miga
  «Capítulo 5 · Diodos › 5.8 …» abre las secciones del capítulo y los capítulos anterior y siguiente, y los botones
  ↑ ↓ (o `Alt ↑` / `Alt ↓`) van a la sección anterior o siguiente. En el teléfono y la tableta en vertical, una
  **barra inferior** (Libro, Buscar, Simulador, Ejercicios, Más): «Libro» abre el índice en un cajón y «Más»,
  el resto; el botón Atrás de Android los cierra primero.
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
- **Diseño adaptable**: en el teléfono y la tableta en vertical, una columna, barra inferior e índice en un cajón;
  en tableta apaisada y ordenador, carril, índice fijo y texto. Rutas con almohadilla (`#/cap05/sec-5.3`), que funcionan sin servidor
  dentro de Tauri.
- **Saltos rápidos entre capítulos**: al seguir una referencia se dibuja primero el tramo de destino y el
  resto del capítulo después, en los ratos libres; mientras se lee, la aplicación prepara en segundo plano
  los capítulos a los que remite la sección en pantalla y el siguiente.
- **Simulador de circuitos** (sección siguiente): botón «Simular» junto a cada figura, sección, problema o
  ejercicio que tiene netlist.
- **Consolas**: las placas base de la NES y de la Neo Geo AES con foto interactiva, arquitectura animada y
  esquema real con redes interactivas (ver más abajo).
- **Componentes animados**: 39 animaciones interactivas de cómo funciona cada componente por dentro, enlazadas
  con sus secciones y figuras (botón «Ver animación» en el libro; ver más abajo).
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
- **Calculadoras**: 351 fórmulas del libro listas para calcular cualquiera de sus variables, con unidades y
  prefijos, gráfica de sensibilidad y enlace a su sección; botón «Calcular» junto a cada ecuación catalogada y
  tarjetas de fórmulas vivas (ver más abajo).
- **Repaso**: tarjetas de los 910 términos del glosario con repetición espaciada y 1028 preguntas de test de
  todos los capítulos y apéndices, cada una con la cita del libro de la que sale (ver más abajo).

### Atajos de teclado

| Tecla | Acción |
|---|---|
| `Ctrl K` / `⌘ K`, `/` | Buscar |
| `Alt ↑` / `Alt ↓` | Sección anterior / siguiente |
| `↑` `↓` `→` `←` `Intro` (en el índice) | Recorrer, desplegar, plegar y abrir; `↓` desde el filtro entra en la lista |
| `↑` `↓` `Intro` | Elegir y abrir un resultado de búsqueda |
| `Esc` | Cerrar la búsqueda, el visor de figuras o el panel «Aa» |
| `+` `-` `0` | Acercar, alejar y ajustar en el visor de figuras |
| `Ctrl Intro` | Guardar la nota que se está escribiendo |

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

Sobre el dibujo se ven las tensiones y corrientes de la última simulación (colores de los nodos y puntos
que se mueven por los cables). Al cambiar un valor con su control deslizante el dibujo no se mueve; al
añadir o quitar componentes en la netlist se vuelve a dibujar a los pocos instantes. Las netlists que no se
pueden simular aquí (XSPICE) también se dibujan, con zoom: botones + y −, `Ctrl` + rueda o pellizco,
arrastrar para desplazar cuando está ampliado, `0` para ajustar. **Pulsar un componente** del dibujo lleva a
su control deslizante (lo muestra resaltado).

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
  `node tests/animaciones-hz.mjs` comprueba que nada avanza por fotograma (144 Hz simulados).

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

Los datos se generan con `python3 contenido/consolas.py` (también desde `generar.py`) a partir de la carpeta
de investigación `/home/claude/consolas`; si falta, se conservan los de `web/public/consolas/`.

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
generador) vuelve a simular en unos milisegundos.

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

Rendimiento: el instrumento lee cinco veces por segundo y el osciloscopio adquiere ocho, solo con la ventana
visible; la pantalla del 2C53T es un canvas que se redibuja solo cuando cambia lo que muestra. Una simulación del
banco tarda de unos milisegundos (continua) a unos 2 s (la AM de 100 kHz, la más pesada).

## Kit FM7303

«Kit FM7303» en el carril de iconos (`#/fm7303`), o el botón del mismo nombre junto a los esquemas del capítulo 15
(figuras 15.25, 15.26, 15.9…) y a las secciones de bloques, puntos de prueba, alineación, averías y mapa de
tensiones, abre el receptor entero en cuatro pestañas que comparten el mismo esquema:

- **Esquema y tensiones**: el esquema completo del kit (las 219 piezas del original de la figura 15.26, redibujadas
  y agrupadas en los ocho bloques de colores de la figura 15.9) con desplazamiento y zoom (arrastrar, rueda o
  trackpad, pellizco, doble toque, `+` `−` `0` y flechas). Encima, la capa viva de las figuras: puntos que recorren
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
- **Página «Calculadoras»** (carril de iconos, `#/calculadoras`): todas por capítulos, búsqueda sin tildes por
  nombre, símbolo, palabra clave, sección o «cap 33», filtro por capítulo y **favoritas** (la estrella; se guardan
  como los marcadores). `#/calculadoras/<id>` abre una a página completa, con la gráfica y las demás fórmulas de su
  sección.

El catálogo lo escribe `contenido/formulas.py` (lo llama `generar.py`, o se ejecuta solo) a partir de las fórmulas
curadas a mano en `contenido/formulas_cat1.py` … `formulas_cat4.py`: nombre, ecuación en un lenguaje de expresiones
propio (sin `eval`), variables con su nombre en el libro, unidad, intervalo habitual y el ejemplo resuelto. Para
publicarse, cada fórmula tiene que encontrar su ecuación en el libro, reproducir el ejemplo (tolerancia del
redondeo del libro), y cada despeje tiene que volver al valor de partida; si el libro cambia, el generador lo dice.
La aplicación solo descarga el mapa pequeño de botones (`formulas-ec.json`, unos 20 kB) al leer, y el catálogo
completo (`formulas.json`) al abrir una calculadora. Pruebas: `tests/calculadoras.spec.ts` (capturas en
`tests/capturas/calculadoras-*.png`).

## Repaso: tarjetas y tests

**Página «Repaso»** (carril de iconos, `#/repaso`). Reúne lo que hay para hoy, las aprendidas y los días seguidos de
repaso, con un mapa de actividad de las últimas cuatro semanas.

**Tarjetas del glosario.** Cada uno de los 910 términos es una tarjeta: delante el término, detrás la definición
del glosario y los enlaces «En el libro» a sus secciones. Con «Tarjetas inversas» se estudia también al revés (de
la definición al término: 1820 tarjetas). Mazos: todo el glosario, por tomo, por capítulo o apéndice y por tema.
Tras ver la respuesta se elige **Otra vez · Difícil · Bien · Fácil**; cada botón dice cuándo volverá la tarjeta
(1 min, 10 min, 4 d…). El planificador es el de Anki (SM-2): las nuevas pasan por dos pasos cortos (1 y 10 min) y
después vuelven a intervalos de días que crecen con cada acierto; un fallo las devuelve a un paso corto y baja su
facilidad. Se presentan como mucho las nuevas al día que se elijan (15 por defecto). Teclado: `espacio` o `Intro`
muestra la respuesta, `1`–`4` califican (`espacio` = Bien), `Ctrl`/`⌘` `Z` deshace la última. En pantalla táctil:
tocar la tarjeta la gira; deslizar a la derecha es «Bien» y a la izquierda «Otra vez».

**Tests por capítulo.** 1028 preguntas (de 10 a 20 por capítulo y de 5 a 12 por apéndice), de opción múltiple y
numéricas (con coma decimal y tolerancia). Los distractores recogen los errores contra los que el libro previene.
Cada respuesta se corrige al momento con la explicación, la **cita literal del libro** y el enlace «Leer en el
libro» a la sección o el problema de donde sale. Al final, la puntuación y la lista «Para repasar»; los fallos
quedan en **«Repasar fallos»** hasta acertarlos. El **examen mixto** saca 10, 20, 40 o 60 preguntas al azar de los
capítulos elegidos. Al final de cada capítulo del lector hay un botón **«Test del capítulo»**. Teclado: `1`–`5` o
`A`–`E` eligen, `Intro` pasa a la siguiente.

**Fidelidad.** Las preguntas están en `contenido/repaso/<capítulo>.json`; `contenido/repaso.py` (lo llama
`generar.py`) no publica nada si una cita no aparece literalmente en la sección del libro a la que remite, si una
referencia no existe o es de otro capítulo, o si el número de una pregunta numérica no está en su cita. Pruebas:
`tests/repaso.spec.ts` (capturas en `tests/capturas/repaso-*.png`).

## Dónde se guardan los datos personales

| Plataforma | Ubicación |
|---|---|
| Windows | `%APPDATA%\es.gonzalomejias.electronica\lector.json` |
| macOS | `~/Library/Application Support/es.gonzalomejias.electronica/lector.json` |
| Android | almacenamiento interno de la aplicación (se borra al desinstalarla) |
| Linux | `~/.local/share/es.gonzalomejias.electronica/lector.json` |
| Navegador (desarrollo) | `localStorage`, claves `epa:prefs`, `epa:posiciones`, `epa:marcadores`, `epa:notas`, `epa:ejercicios`, `epa:leidas`, `epa:deducciones`, `epa:calc-favoritos`, `epa:repaso-tarjetas`, `epa:repaso-diario`, `epa:repaso-ajustes`, `epa:repaso-tests`, `epa:repaso-fallos`, `epa:repaso-examenes` |

El fichero `lector.json` es JSON legible: para llevar marcadores, notas y el progreso (ejercicios, secciones
leídas, deducciones, tarjetas y tests del repaso) de un equipo a otro basta copiarlo con la aplicación cerrada.

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

Coste por fotograma de los esquemas vivos (perfiles `mac`, `tableta`, `movil`; CPU ×4), con la web servida:

```sh
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tests/figuras-vivas.mjs --perfil mac
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
        Carril.svelte        carril de iconos (ordenador y tableta apaisada), del registro HERRAMIENTAS
        Pestanas.svelte      barra inferior del teléfono y la tableta en vertical
        MenuHerramientas.svelte  «Más» (junto al carril o como hoja en el teléfono)
        Lateral.svelte       panel del índice junto al carril, o cajón en el teléfono
        IndiceLibro.svelte   índice: tomos, capítulos, secciones, filtro, sección actual, teclado
        Barra.svelte         barra superior: mostrar/ocultar índice, miga, sección anterior/siguiente, «Aa», progreso
        MenuCapitulo.svelte  menú de la miga: secciones del capítulo y capítulos contiguos
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
        fm7303/              el kit FM7303 vivo: esquema con pan y zoom, modelo de continua, física de la
                             alineación, señal, osciloscopio, multímetro, averías (ver «Kit FM7303»)
        instrumentos/        Brymen BM869s y FNIRSI 2C53T virtuales, banco de pruebas y prácticas guiadas
                             (motor/ en TypeScript puro; ver «Instrumentos» y ESQUEMA.md)
        figuras-vivas/       figuras vivas: lectura de gráficas, esquemas con corriente y tensión, circuito
                             del simulador (ver «Figuras vivas» y ESQUEMA.md)
        simulador/           vistas del simulador: Simulador (rutas), Indice, Pagina, Parametros,
                             Resultados, Editor (se cargan solo al abrir el simulador)
        Insignia.svelte, Icono.svelte
      lib/
        tipos.ts             tipos del contenido (ESQUEMA.md)
        datos.ts             carga del contenido, rutas de recursos, HTML de las referencias
        ruta.svelte.ts       rutas con almohadilla, historial y posición de cada entrada
        navegacion.svelte.ts registro HERRAMIENTAS (una entrada por sección), índice oculto por vista,
                             secciones anterior/siguiente y filtro del índice
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
