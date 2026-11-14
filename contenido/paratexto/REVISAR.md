# Paratexto universitario — para revisar

Aparato de libro de texto de grado para «Electrónica Práctica Avanzada»: objetivos, términos clave, correspondencia con el grado, resumen, fórmulas, autoevaluación, normas y lecturas, marcas de dificultad e índice alfabético por tomo. Todo se genera con scripts deterministas a partir de los datos convertidos del libro (`web/public/libro/`, solo lectura) y de los textos redactados en `redaccion/`.

## Qué es generado y qué es redactado

| Pieza | Origen | Dónde |
|---|---|---|
| Índice alfabético por tomo | Generado: términos del glosario + títulos de sección | `datos/indice-tomo<N>.json`, `tomo<N>.typ` (`indice`) |
| Términos clave | Generado: glosario | `datos/<parte>.json` → `terminos_clave`; `<parte>.typ` (`terminos`) |
| Autoevaluación y soluciones | Generado: `repaso/<parte>.json` de la app | `autoevaluacion`; `<parte>.typ` (`autoev`), `tomo<N>.typ` (`soluciones`) |
| Marcas de dificultad | Generado: clasificación de `ejercicios.json` | `dificultad`; `<parte>.typ` (`niveles`) |
| Fórmulas del capítulo | Generado: `formulas.json` (fórmulas de las tarjetas y del texto) | `formulas`; `<parte>.typ` (`formulas`) |
| Normas y documentos citados | Generado: extraído del texto del capítulo | `normas`; `<parte>.typ` (`normas`) |
| Objetivos de aprendizaje | **Redactado** | `redaccion/tomo<N>.yaml`; `datos/<parte>.json` → `redactado` |
| Resumen del capítulo | **Redactado** (caps. 0-6 a partir de las tarjetas de resumen de las lecciones 1.1) | ídem |
| Correspondencia con el grado | **Redactado** (asignación de materias y competencias) | ídem; `grado.typ` |
| Lecturas recomendadas | **Redactado**: obras del apéndice G y sugerencias marcadas | `redaccion/lecturas.yaml` |
| Análisis de huecos | **Redactado** sobre evidencia del texto | `HUECOS.md`, `huecos.json`, `redaccion/huecos.yaml` |

## Supuestos

- **Grado de referencia**: Grado en Ingeniería Electrónica Industrial y Automática (el que habilita para la especialidad de electrónica industrial de la profesión de ingeniero técnico industrial). Es una elección nuestra: el libro no sigue el plan de ninguna universidad.
- **Competencias**: Orden CIN/351/2009, de 9 de febrero, por la que se establecen los requisitos para la verificación de los títulos universitarios oficiales que habiliten para el ejercicio de la profesión de Ingeniero Técnico Industrial. BOE núm. 44, de 20 de febrero de 2009, sec. I, págs. 18145-18149 (BOE-A-2009-2893), Anexo, apartado 5 (Planificación de las enseñanzas), tabla de módulos: <https://www.boe.es/diario_boe/txt.php?id=BOE-A-2009-2893>. El texto de cada competencia está copiado literalmente (`datos/competencias.json`); se ha leído en la reproducción íntegra del BOE de <https://masteringenieriaindustrial.uca.es/boe-a-2009-2893> y el agrupamiento en filas se ha contrastado con la tabla de competencias del grado de la Universidad de La Laguna (<https://www.ull.es/grados/ingenieria-electronica-industrial-automatica/plan-de-estudios/competencias/>). Conviene cotejarlo una vez con el PDF del BOE.
- **Códigos**: El BOE no numera las filas de la tabla; los códigos FB1–FB6, CR1–CR12 y TE1–TE11 son nuestros y siguen el orden de la tabla (la Universidad de La Laguna, por ejemplo, las numera [1]–[29]).
- **Créditos**: solo los de la orden por módulo (formación básica 60, común a la rama industrial 60, tecnología específica 48, trabajo fin de grado 12). No se dan créditos por asignatura: varían entre universidades y no hemos encontrado una fuente única que dé un intervalo típico.
- **Materias**: las familias de asignaturas habituales del grado (Teoría de Circuitos, Electrónica Analógica, Electrónica Digital, Electrónica de Potencia, Instrumentación Electrónica, Sistemas Electrónicos Digitales y Microprocesadores, Regulación Automática, Informática Industrial, Comunicaciones…); son nombres genéricos, no los de un plan concreto.
- **Cobertura**: de 17 competencias en el alcance, 5 completas, 11 parciales y 1 sin cobertura (detalle y propuestas en `HUECOS.md`).

## Reglas de lo generado

- **Términos clave**: las entradas del glosario cuyo «ver» apunta a una sección del capítulo (las que el propio glosario sitúa allí). Si son menos de 24, se completan con los términos del glosario que más aparecen en el texto del capítulo (al menos 3 veces); si son más, se quedan las 24 más usadas. Cada término lleva la sección donde se define.
- **Búsqueda de términos**: el término sin su paréntesis, sin distinguir mayúsculas y con plural en -s/-es; las siglas entre paréntesis («Descarga electrostática (ESD)» → ESD) y los nombres en inglés de varias palabras también, las siglas respetando mayúsculas. Gana la coincidencia más larga.
- **Índice alfabético**: por tomo, con los términos del glosario que aparecen en el tomo y los títulos de sección y de apartado numerado (sin «Resumen», «Problemas de diseño», «Ejercicios»). Localizadores: en seminegrita las secciones del «ver» del glosario; además, hasta completar cuatro, las secciones donde el término aparece más veces. La página se calcula al compilar con la etiqueta de la sección (`sec-1.2`) o del apartado numerado (`sec-1.2.3`), así que el índice remite al comienzo de la sección, no a la línea exacta. Para afinar, la plantilla podría poner una etiqueta en la primera aparición marcada de cada término (ya la detecta para el glosario al margen).
- **Autoevaluación**: las preguntas de repaso de la app (`repaso/<parte>.json`), en su orden y con sus cuatro opciones en el orden de la app (la correcta ya está repartida entre a, b, c y d; 1028 preguntas en total). Las soluciones van al final del tomo con la explicación de la app y la sección donde se trata la idea; en pantalla, número de pregunta y solución se enlazan en los dos sentidos.
- **Dificultad (1-3 puntos)**, de la clasificación de `ejercicios.json`: «apartados» = respuestas numéricas + preguntas extra + partes autoevaluadas («otras»). **3**: problema de diseño (`tipo: prob`, de las secciones «Problemas de diseño»), o con un apartado de diseño (`clase` u `otras` = diseno), o con 4 o más apartados. **2**: de razonamiento (`clase` u `otras` = razonamiento) o con 2-3 apartados. **1**: el resto (un resultado, una elección o una respuesta breve). Reparto: 155 de nivel 1, 222 de nivel 2 y 139 de nivel 3 (516 ejercicios; 30 son los nuevos de los caps. 21, 24 y 34 que aún no están en el libro). Cada ejercicio lleva en su JSON los motivos de su nivel.
- **Fórmulas del capítulo**: las 334 entradas de `formulas.json` (sin duplicados por fuente), por sección; un punto marca las que recoge la tarjeta de fórmulas del capítulo. Sin fórmulas (no se imprime la página): 11, 12, 14, 38, 41, 47, 48, 53, A, B, C, D, E, F, G, H, I, J.
- **Normas y referencias**: identificadores literales del texto (50 citas): normas IEC/EN/UNE/ISO/IEEE/IPC/ANSI/ASME/EIA/JEDEC/NEMA/MIL, RS-232/485, legislación (RoHS, REACH, RAEE, marcado CE, Directiva (UE)…) y documentos nombrados («manual del…», «hoja de datos del…»), cada uno con su frase de contexto y su sección. Nada se añade que no esté en el texto; los capítulos sin citas lo dicen. Las **lecturas** son las obras del apéndice G (marca sólida) y sugerencias para esta edición (marca hueca): todas existen; las ediciones y años son un añadido nuestro para las del apéndice G, que no los da. Conviene comprobarlos.

## Cómo se usa en el libro

- Cada capítulo tiene `paratexto/<parte>.typ` (nombre del fichero de la app: `cap15.typ` es el capítulo 14). Uso: `#import "paratexto/cap01.typ" as p01`; `#p01.inicio` justo después de `#capitulo(...)` y **antes** del texto del capítulo; `#p01.cierre` antes de `#ejercicios` (o sus piezas: `p01.resumen`, `p01.normas`, `p01.formulas`, `p01.autoev`). Las marcas de dificultad: `#nivel-de(p01.niveles, "ej-1.1")` al principio de cada ejercicio (mejor: que la plantilla las dibuje junto a la insignia del número leyendo `niveles`), y `#leyenda-niveles()` al comienzo de los ejercicios.
- Al final del tomo: `#import "paratexto/tomoI.typ" as t` y `#t.soluciones`, `#t.indice`. En los preliminares: `#import "paratexto/grado.typ": correspondencia` y `#correspondencia`.
- `paratexto.typ` importa `../plantilla/plantilla.typ` y usa su paleta, etiquetas, insignias y la página ancha. No usa detalles internos de la plantilla: `#sin-glosario[…]` (para que los objetivos y los términos clave no le quiten a la primera aparición real de un término su marca de glosario al margen), `parte-sin-apertura` (cabeceras «Tomo I» en las páginas finales) y los argumentos `rotulo:`, `columnas:` y `separacion:` de `pagina-ancha` son funciones públicas de la plantilla.
- **Resúmenes duplicados**: estos capítulos ya tienen una sección de resumen propia: 0 (0.21 «Resumen del Capítulo»); 1 (1.13 «Resumen del Capítulo»); 4 (4.12 «Resumen del Capítulo»); 6 (6.12 «Resumen del Capítulo»); 10 (10.10 «Resumen del Capítulo»); 15 (15.22 «Herramientas Adicionales y Resumen»); 23 (23.10 «Resumen del Capítulo»); 33 (33.11 «Herramientas Adicionales y Resumen»); 39 (39.11 «Herramientas Adicionales y Resumen»); 40 (40.10 «Herramientas Adicionales y Resumen»); 41 (41.10 «Herramientas Adicionales y Resumen»); 42 (42.10 «Herramientas Adicionales y Resumen»); 43 (43.11 «Herramientas Adicionales y Resumen»); 44 (44.11 «Resumen del Capítulo»); 45 (45.17 «Herramientas Adicionales y Resumen»); 46 (46.12 «Herramientas Adicionales y Resumen»); 47 (47.5 «Herramientas Adicionales y Resumen»); 50 (50.13 «Herramientas Adicionales y Resumen»); C (C.5 «Fórmulas Esenciales — Resumen»). El resumen redactado no la sustituye: hay que decidir si se mantienen los dos (por ejemplo, el nuevo con otro título, «En síntesis») o si se fusionan.
- Regenerar (desde `paratexto/scripts/`): `python3 generar.py`, `python3 lecciones.py`, `python3 validar_redaccion.py`, `python3 generar_typ.py`, `python3 generar_muestra.py`, `python3 generar_revisar.py`; compilar la muestra con `python3 compilar.py` (variantes: `python3 compilar.py muestra-paratexto.typ imprenta-intenso pantalla-medio`) y comprobar que compila cada fragmento con `python3 compilar.py todo`. Usa el paquete `typst` de pip y las fuentes de `plantilla/fuentes`.

## Textos redactados, capítulo a capítulo

Objetivos (O), resumen (R), materias y competencias del grado (G) y lecturas (L; [G] = apéndice G, [S] = sugerencia). Se corrigen en `redaccion/tomo<N>.yaml` y se regenera.

### Tomo I

**Cap. 0 — Fundamentos Matemáticos para la Electrónica** (`cap00`)  
O1. Expresar magnitudes en notación científica con el prefijo del SI adecuado y con las cifras significativas que permiten los datos.  
O2. Despejar relaciones y resolver sistemas lineales, por sustitución y por Cramer, comprobando siempre el resultado.  
O3. Describir una senoide por su amplitud, frecuencia angular y fase, y pasar de valor de pico a eficaz.  
O4. Operar con números complejos y fasores en forma binómica y polar, y aplicarlos a la impedancia.  
O5. Interpretar derivadas, integrales y ecuaciones diferenciales de primer y segundo orden en circuitos con condensadores y bobinas.  
O6. Usar las transformadas de Laplace y Z, la serie de Fourier y la convolución para describir sistemas lineales.  
O7. Estimar errores e incertidumbres (peor caso, cuadratura, Monte Carlo) y trazar diagramas de Bode asintóticos en decibelios.  
R (241 palabras). Este capítulo reúne las herramientas matemáticas que el resto del libro da por sabidas, siempre con un circuito delante. Empieza por la escritura de las magnitudes: notación científica, prefijos que son potencias de mil y cifras significativas que no pueden superar a las de los datos. Sigue el álgebra que convierte V = I·R en tres relaciones equivalentes y resuelve las mallas como sistemas de ecuaciones. La senoide se describe por su pico, su frecuencia angular y su fase; su valor eficaz es Vp/√2, y la red de 230 V llega a 325 V de pico. Los números complejos y los fasores reducen la alterna a una ley de Ohm con impedancias, y las derivadas e integrales explican por qué la tensión de un condensador y la corriente de una bobina no pueden saltar. Las ecuaciones diferenciales de primer orden dan la exponencial con constante τ = R·C; las de segundo orden, la oscilación según el amortiguamiento. Laplace convierte derivar en multiplicar por s y sitúa los polos que deciden la estabilidad; Fourier descompone una señal en armónicos; la transformada Z hace lo mismo con señales muestreadas. El capítulo termina con el tratamiento de la medida: propagación de errores, suma en cuadratura, la campana de Gauss y Monte Carlo para tolerancias, el ajuste por mínimos cuadrados, las aproximaciones de Taylor de la pequeña señal, el análisis dimensional y el trazado asintótico de Bode, donde los decibelios se suman etapa a etapa.  
G. Matemáticas · Señales y Sistemas · Teoría de Circuitos — FB1, TE7  
L. [S] Erwin Kreyszig, «Advanced Engineering Mathematics», Wiley, 10.ª ed., 2011. [G] Alan Oppenheim y Alan Willsky, «Signals and Systems», Pearson, 2.ª ed., 1997. [G] Charles Alexander y Matthew Sadiku, «Fundamentals of Electric Circuits», McGraw-Hill.  

**Cap. 1 — Fundamentos de Electricidad y Teoría de Circuitos** (`cap01`)  
O1. Definir carga, corriente, tensión, potencia y energía, con sus unidades y su significado físico.  
O2. Aplicar la ley de Ohm y las leyes de Kirchhoff por mallas y por nudos, distinguiendo los elementos óhmicos de los que no lo son.  
O3. Simplificar redes con asociaciones serie y paralelo, divisores, la transformación estrella-triángulo y el puente de Wheatstone.  
O4. Sustituir una red lineal por sus equivalentes de Thévenin y de Norton y aplicar superposición y máxima transferencia de potencia.  
O5. Calcular valores medio, eficaz y de pico de señales alternas y la frecuencia de resonancia y el factor de calidad de un circuito RLC.  
O6. Evaluar el efecto de la resistencia interna de las fuentes y de la carga que introducen los instrumentos de medida.  
R (238 palabras). El capítulo asienta las magnitudes y las leyes sobre las que descansa toda la electrónica. La corriente es carga por unidad de tiempo y la tensión, energía por unidad de carga medida siempre entre dos puntos; P = V·I vale en cualquier elemento, mientras que P = I²·R y P = V²/R solo en los óhmicos. La ley de Ohm es una propiedad de ciertos materiales, con una resistencia que depende de la geometría y de la temperatura; las leyes de Kirchhoff, en cambio, expresan la conservación de la carga y de la energía y valen siempre. Con ellas se analizan las mallas y los nudos, las asociaciones serie y paralelo y los divisores, que solo dividen bien en vacío. Los teoremas de superposición, Thévenin y Norton reducen cualquier red lineal a una fuente con su resistencia, y la máxima transferencia de potencia aparece con un rendimiento del 50 %, útil para señales y no para energía. La alterna se caracteriza por su pico, su frecuencia y su fase, y su valor eficaz es el que produce el mismo calor; los factores de la senoide no valen para otras formas de onda. La resonancia RLC, la transformación estrella-triángulo y el puente de Wheatstone completan el análisis. El capítulo cierra con las fuentes reales y su resistencia interna, el rendimiento y la autonomía de una batería, y la idea de que todo instrumento forma parte del circuito que mide.  
G. Teoría de Circuitos · Física · Instrumentación Electrónica — CR4, FB2, TE1  
L. [G] Charles Alexander y Matthew Sadiku, «Fundamentals of Electric Circuits», McGraw-Hill. [S] William H. Hayt, Jack E. Kemmerly y Steven M. Durbin, «Análisis de circuitos en ingeniería», McGraw-Hill, 8.ª ed., 2012. [S] Paul A. Tipler y Gene Mosca, «Física para la ciencia y la tecnología», Reverté, 6.ª ed., 2010.  

**Cap. 2 — Resistencias — Teoría Completa y Aplicaciones** (`cap02`)  
O1. Relacionar la resistencia con la geometría, el material y la temperatura, y calcular la potencia que disipa.  
O2. Comparar las tecnologías de resistencias (carbón, película metálica, bobinadas, SMD) por tolerancia, coeficiente de temperatura y ruido.  
O3. Leer los códigos de colores y de marcado y elegir valores de las series normalizadas E.  
O4. Describir el funcionamiento y el uso de NTC, PTC, varistores y potenciómetros.  
O5. Dimensionar divisores, resistencias de pull-up y pull-down y puentes, teniendo en cuenta el efecto de carga.  
O6. Aplicar la reducción de potencia con la temperatura y el modelo de alta frecuencia al elegir una resistencia.  
O7. Medir y diagnosticar resistencias con el multímetro, incluidos los valores bajos a cuatro hilos.  
R (244 palabras). La resistencia es el componente más común y el capítulo la estudia de la física al banco. Su valor sale de la resistividad, la longitud y la sección, crece con la temperatura en los metales y se convierte en calor según P = I²·R. Las tecnologías difieren en lo que importa al diseñar: la de carbón es barata y ruidosa, la de película metálica es la de precisión, la bobinada aguanta potencia pero es inductiva y la SMD codifica su tamaño en el nombre del encapsulado. La tolerancia no dice nada de la deriva, que se mide en ppm/°C, y el ruido térmico depende solo de la resistencia, la temperatura y el ancho de banda, mientras que el de exceso depende de la tecnología. El código de colores, el marcado numérico y el EIA-96 se leen con método, y las series E reparten los valores en progresión geométrica según la tolerancia. Termistores NTC y PTC, varistores y potenciómetros amplían el repertorio. En las aplicaciones, el divisor cargado, el puente, las redes R-2R y las resistencias de pull-up muestran el mismo principio: la carga debe ser mucho mayor que la impedancia que la alimenta. La reducción de potencia con la temperatura, el reparto entre varias resistencias y el modelo con inductancia y capacidad parásitas fijan los límites reales. El capítulo termina con la medida con el multímetro, la técnica de cuatro hilos, los criterios de elección y el análisis estadístico de tolerancias y de ruido.  
G. Teoría de Circuitos · Tecnología Electrónica · Instrumentación Electrónica — CR4, CR5, TE2  
L. [G] Paul Horowitz y Winfield Hill, «The Art of Electronics», Cambridge University Press, 3.ª ed., 2015. [S] Robert L. Boylestad y Louis Nashelsky, «Electrónica: teoría de circuitos y dispositivos electrónicos», Pearson, 10.ª ed., 2009.  
Normas extraídas: IEC 60062 (2.4); EIA-96 (2.5); RoHS (2.6)  

**Cap. 3 — Condensadores — Teoría, Tipos y Aplicaciones** (`cap03`)  
O1. Relacionar la capacidad con la geometría y el dieléctrico, y calcular la energía almacenada y la corriente i = C·dv/dt.  
O2. Calcular la carga y descarga de un circuito RC mediante su constante de tiempo.  
O3. Determinar la reactancia capacitiva y la frecuencia de corte de los filtros RC paso bajo y paso alto.  
O4. Comparar los tipos de condensadores (cerámicos, electrolíticos, de película, supercondensadores, de seguridad X e Y) y su modelo real con ESR y ESL.  
O5. Elegir condensadores de desacoplo y de filtrado teniendo en cuenta la tensión continua aplicada, la temperatura, el envejecimiento y el rizado.  
O6. Estimar la vida de un electrolítico y diagnosticar condensadores averiados.  
R (226 palabras). El condensador almacena energía en el campo eléctrico de su dieléctrico, con una capacidad que fijan el área, la separación y la permitividad del material. Su ley, i = C·dv/dt, explica a la vez que no conduzca en continua y que su tensión no pueda cambiar de golpe. En un circuito RC la carga y la descarga son exponenciales de constante τ = R·C: el 63,2 % en una constante y prácticamente completas en cinco. En alterna presenta una reactancia inversa a la frecuencia, adelanta la corriente 90° y no disipa: almacena y devuelve la energía en cada ciclo. Con una resistencia forma los filtros RC, cuyo punto de −3 dB no es una frontera sino el comienzo de una caída de 20 dB por década. Los tipos se eligen por compromiso: los cerámicos C0G son estables; los X7R e Y5V dan más capacidad pero la pierden con la tensión, la temperatura y el tiempo; los electrolíticos ofrecen mucha capacidad a costa de polaridad, ESR y una vida que se reduce a la mitad por cada 10 °C. El modelo real con ESR y ESL explica la autorresonancia y por qué un desacoplo es una bobina por encima de ella. El capítulo cubre también la asociación en serie y su equilibrado, los supercondensadores, los condensadores de seguridad X e Y y el diagnóstico en el banco.  
G. Teoría de Circuitos · Tecnología Electrónica · Fundamentos de Electrónica — CR4, CR5, FB2  
L. [G] Paul Horowitz y Winfield Hill, «The Art of Electronics», Cambridge University Press, 3.ª ed., 2015. [G] Charles Alexander y Matthew Sadiku, «Fundamentals of Electric Circuits», McGraw-Hill.  

**Cap. 4 — Inductores y Transformadores** (`cap04`)  
O1. Explicar la inductancia a partir de la inducción electromagnética y calcular la tensión v = L·di/dt y la energía almacenada.  
O2. Calcular el transitorio de un circuito RL y la reactancia inductiva, y dimensionar la protección contra la sobretensión al cortar la corriente.  
O3. Comparar los materiales de núcleo y evaluar las pérdidas por histéresis y por corrientes de Foucault, la saturación y el efecto del entrehierro.  
O4. Analizar el transformador ideal y el real: relación de espiras, impedancia reflejada, pérdidas y rendimiento.  
O5. Calcular la frecuencia de resonancia, el factor de calidad y el ancho de banda de circuitos LC.  
O6. Identificar, medir y elegir bobinas, ferritas y choques de modo común según su corriente de saturación y su autorresonancia.  
R (223 palabras). La bobina se opone al cambio de la corriente, no a la corriente: v = L·di/dt lo resume y explica tanto el depósito de energía ½·L·I² como los miles de voltios que aparecen al cortarla de golpe. La inductancia crece con el cuadrado de las espiras y con la permeabilidad del núcleo, y toda espira la tiene, incluso un centímetro de pista. En continua el circuito RL responde con una exponencial de constante L/R; en alterna la reactancia crece con la frecuencia hasta la autorresonancia, donde la capacidad entre espiras la convierte en condensador. El diodo en antiparalelo protege al transistor que conmuta una carga inductiva, a cambio de que el relé suelte más despacio. Los núcleos multiplican la inductancia pero imponen límites de frecuencia, saturación y pérdidas por histéresis y por corrientes de Foucault; el entrehierro reduce la inductancia a cambio de admitir más corriente y guardar la energía en el hueco. El transformador relaciona tensiones y corrientes por las espiras, refleja la carga multiplicada por el cuadrado de la relación y, en la práctica, añade corriente magnetizante, pérdidas y dispersión. La resonancia LC, el factor de calidad y la selectividad, el efecto pelicular, las ferritas y los choques de modo común completan un capítulo que termina en el criterio de diseño: la saturación, y no la marca, es el límite real.  
G. Teoría de Circuitos · Electrotecnia y Máquinas Eléctricas · Física — CR4, FB2, TE1  
L. [G] Colonel Wm. T. McLyman, «Transformer and Inductor Design Handbook», CRC Press, 4.ª ed., 2011. [G] Charles Alexander y Matthew Sadiku, «Fundamentals of Electric Circuits», McGraw-Hill. [S] Jesús Fraile Mora, «Máquinas eléctricas», McGraw-Hill / Garceta.  

**Cap. 5 — Diodos — Teoría Semiconductora y Aplicaciones Completas** (`cap05`)  
O1. Explicar la conducción en los semiconductores intrínsecos y dopados y la formación de la unión PN.  
O2. Aplicar la ecuación de Shockley, la resistencia dinámica y la deriva térmica al análisis de circuitos con diodos.  
O3. Identificar y comprobar diodos con el multímetro y distinguir sus tipos (rectificador, Schottky, Zener, TVS, varicap, PIN, LED).  
O4. Diseñar rectificadores de media onda y de onda completa con filtro por condensador, incluidos el rizado y las corrientes de pico.  
O5. Dimensionar un regulador con diodo Zener en el peor caso de entrada y de carga.  
O6. Analizar recortadores, fijadores, detectores de pico y multiplicadores de tensión, y la pérdida por recuperación inversa.  
R (220 palabras). El diodo es la primera aplicación del semiconductor, y el capítulo lo construye desde el material. La banda prohibida del silicio deja pocos portadores libres y permite gobernar la conductividad con el dopaje: el fósforo aporta electrones y el boro, huecos, y el producto n·p se mantiene igual a nᵢ². La unión entre dos dopajes crea una barrera que en directa se reduce y deja crecer la corriente exponencialmente, y en inversa deja solo una corriente de saturación que se dobla cada 10 °C. La ecuación de Shockley explica por qué no hay umbral y por qué, aun así, 0,7 V basta en la mayoría de los diseños; su pendiente es la resistencia dinámica y su deriva, unos −2 mV/°C. Los tipos de diodo se distinguen por la tecnología: el de unión para la red, el Schottky para la conmutación, el Zener y el TVS en ruptura, el varicap por su capacidad y el LED por la luz. En las aplicaciones, el rectificador con condensador se carga al pico y obliga a los diodos a conducir en pulsos intensos; el regulador Zener se dimensiona en las esquinas de entrada y de carga; recortadores, fijadores, detectores de pico y multiplicadores reparten los mismos componentes de otra forma. La recuperación inversa, proporcional a la frecuencia, decide el diodo en las fuentes conmutadas.  
G. Fundamentos de Electrónica · Electrónica Analógica · Electrónica de Potencia — CR5, TE2, TE4  
L. [G] Ben Streetman y Sanjay Banerjee, «Solid State Electronic Devices», Pearson, 7.ª ed., 2015. [G] Adel Sedra y Kenneth Smith, «Microelectronic Circuits», Oxford University Press. [S] Albert Malvino y David J. Bates, «Principios de electrónica», McGraw-Hill, 7.ª ed., 2007.  

**Cap. 6 — Transistores BJT — Teoría Avanzada y Diseño de Circuitos** (`cap06`)  
O1. Explicar el funcionamiento del transistor bipolar a partir de su estructura y de sus regiones de trabajo.  
O2. Polarizar un BJT con divisor y resistencia de emisor de forma estable frente a la dispersión de β y a la temperatura.  
O3. Calcular la ganancia y las impedancias de las configuraciones de emisor común, colector común y base común con el modelo de pequeña señal.  
O4. Dimensionar el transistor en conmutación con sobreexcitación de base y estimar sus pérdidas.  
O5. Identificar el patillaje y el estado de un transistor con el multímetro.  
O6. Analizar el efecto Early, el embalamiento térmico, los espejos de corriente, la distorsión no lineal y el acoplamiento entre etapas.  
R (223 palabras). El transistor bipolar no son dos diodos: lo que lo hace funcionar es una base delgada y poco dopada entre dos uniones separadas por fracciones de micra. En la región activa la tensión base-emisor fija la corriente de colector, y β·I_B es su consecuencia; cuando esa corriente no cabe en el circuito, el transistor se satura. La ganancia β varía mucho entre ejemplares, con la temperatura y con la corriente, y por eso el diseño no debe depender de ella: la polarización por divisor con resistencia de emisor reduce una variación del 500 % de β a unos pocos por ciento de la corriente. El modelo de pequeña señal, con g_m = I_C/V_T, r_π y r_o, da la ganancia del emisor común, la del seguidor y la de la base común, que se eligen por lo que falta en cada caso: ganancia, corriente o ancho de banda. En conmutación el transistor debe pasar por la zona activa lo más deprisa posible y saturarse con una corriente de base forzada; por encima de decenas de kilohercios conviene un MOSFET. El capítulo trata también la identificación con el multímetro, el efecto Early y su techo de ganancia, el embalamiento térmico y el reparto de corriente, los espejos de corriente con carga activa, la distorsión armónica y el punto de intercepción, y el acoplamiento entre etapas.  
G. Fundamentos de Electrónica · Electrónica Analógica — CR5, TE2, TE6  
L. [G] Adel Sedra y Kenneth Smith, «Microelectronic Circuits», Oxford University Press. [S] Albert Malvino y David J. Bates, «Principios de electrónica», McGraw-Hill, 7.ª ed., 2007. [G] Paul Horowitz y Winfield Hill, «The Art of Electronics», Cambridge University Press, 3.ª ed., 2015.  
Normas extraídas: Hojas de datos de CMOS (6.1)  

### Tomo II

**Cap. 7 — Transistores MOSFET — Teoría Exhaustiva y Aplicaciones** (`cap07`)  
O1. Explicar la estructura del MOSFET, la formación del canal y sus regiones de operación.  
O2. Identificar las variantes de MOSFET y la familia FET por su símbolo, su encapsulado y la medida en el banco.  
O3. Interpretar los parámetros clave de un MOSFET de potencia en la hoja de datos.  
O4. Diseñar el MOSFET como interruptor de potencia, incluida la carga de puerta y el driver.  
O5. Comparar MOSFET y BJT para elegir el adecuado en cada aplicación.  
O6. Aplicar el diodo de cuerpo, la conmutación síncrona y el área de operación segura al diseño con margen.  
R (227 palabras). El MOSFET se controla por tensión y no por corriente: la puerta, aislada por una capa de óxido, forma o suprime un canal entre fuente y drenador sin consumir corriente en continua. El capítulo recorre su estructura capa a capa, por qué la puerta es tan frágil, el papel del sustrato y la estructura vertical de los dispositivos de potencia, y distingue las cuatro variantes y el resto de la familia FET. Sus regiones de operación se describen como las del bipolar, con su propia terminología, y el símbolo se aprende a leer en lugar de memorizarlo. En la práctica, elegir un MOSFET de potencia es leer bien unos pocos parámetros de la hoja de datos, y su aplicación estrella es la conmutación. Que la puerta no consuma en continua no significa que moverla sea gratis: la carga de puerta fija la corriente del driver y las pérdidas de conmutación. La comparación con el BJT da criterios de elección, y el modelo de pequeña señal, basado en la transconductancia, permite usarlo como amplificador. El diodo de cuerpo impide que sea un interruptor bidireccional pero hace posible la conmutación síncrona, con el problema de su recuperación inversa. El área de operación segura, la focalización térmica y los modos de fallo cierran el capítulo con el diseño con margen y tres problemas de elección y de excitación de puerta.  
G. Fundamentos de Electrónica · Electrónica Analógica · Electrónica de Potencia — CR5, TE2, TE4  
L. [G] Adel Sedra y Kenneth Smith, «Microelectronic Circuits», Oxford University Press. [G] Robert Erickson y Dragan Maksimović, «Fundamentals of Power Electronics», Springer, 3.ª ed., 2020. [G] Paul Horowitz y Winfield Hill, «The Art of Electronics», Cambridge University Press, 3.ª ed., 2015.  

**Cap. 8 — Circuitos Integrados Analógicos** (`cap08`)  
O1. Describir el amplificador operacional ideal y real, con sus reglas de análisis y sus parámetros de rechazo.  
O2. Diseñar las configuraciones inversora, no inversora y seguidora, y comparadores con histéresis.  
O3. Comparar reguladores lineales y conmutados y sus topologías básicas, y elegir el adecuado.  
O4. Diseñar osciladores y temporizadores con el NE555 en modo astable y monoestable.  
O5. Seleccionar un operacional real y una referencia de tensión de precisión por los parámetros que importan en cada aplicación.  
O6. Aplicar interruptores y multiplexores analógicos, comparadores dedicados y circuitos de muestreo y retención.  
R (206 palabras). El capítulo pasa de los componentes discretos a los circuitos integrados analógicos, y se apoya en tres bloques: el amplificador operacional, los reguladores de tensión y el temporizador 555. El operacional es un amplificador diferencial de ganancia enorme, entrada de alta impedancia y salida de baja impedancia; con dos reglas del modelo ideal y unas pocas resistencias se obtienen el inversor, el no inversor y el seguidor, y sin realimentación negativa se convierte en comparador, que la histéresis hace inmune al ruido. Los reguladores resuelven que la alimentación nunca sea la que hace falta: el lineal es un divisor activo y el conmutado transfiere la energía en paquetes, con tres topologías básicas y criterios para elegir entre ambos. El NE555 genera oscilaciones y temporizaciones con dos modos de trabajo. La segunda mitad del capítulo es de criterio: no hay un operacional «mejor», sino el que cumple el parámetro que importa, y la letra pequeña del rail-to-rail lo demuestra. Las referencias de tensión, bandgap o Zener enterrado, fijan la exactitud de todo instrumento, y la medida ratiométrica reduce su influencia. Interruptores y multiplexores analógicos, comparadores dedicados y circuitos de muestreo y retención, con sus cuatro errores, completan el repertorio que usan los capítulos de instrumentación y conversión.  
G. Electrónica Analógica · Instrumentación Electrónica · Electrónica de Potencia — TE2, TE5, TE6  
L. [G] Sergio Franco, «Design with Operational Amplifiers and Analog Integrated Circuits», McGraw-Hill, 4.ª ed., 2015. [G] Ron Mancini (ed.), «Op Amps for Everyone», Texas Instruments / Newnes. [G] Paul Horowitz y Winfield Hill, «The Art of Electronics», Cambridge University Press, 3.ª ed., 2015.  

**Cap. 9 — Circuitos Integrados Digitales** (`cap09`)  
O1. Aplicar el álgebra de Boole y las leyes de De Morgan para pasar de una tabla de verdad a un circuito.  
O2. Comparar las familias lógicas por sus niveles de tensión, márgenes de ruido, fan-out y retardo de propagación.  
O3. Describir puertas, flip-flops, contadores, registros y memorias como bloques combinacionales y secuenciales.  
O4. Elegir entre salidas tótem-pole, tri-estado y de colector abierto para compartir buses.  
O5. Adaptar niveles lógicos entre dominios de tensión distintos.  
O6. Explicar la metaestabilidad y diseñar sincronizadores, entradas limpias y circuitos de reset fiables.  
R (197 palabras). La electrónica digital trabaja con dos estados y, sobre esa aparente simplicidad, construye ordenadores, memorias y comunicaciones. El capítulo parte del álgebra de Boole, sus tres operaciones con su realidad física y las leyes de De Morgan, y enseña a pasar de la tabla de verdad al circuito. Los unos y ceros son niveles de tensión, y cada familia lógica los define a su manera; las puertas implementan las operaciones y los flip-flops añaden memoria, con la que se construyen contadores, registros y memorias. Cuando varios dispositivos comparten un cable aparecen las salidas tri-estado y las de colector o drenador abierto, cuyo precio es un flanco de subida lento. La fiabilidad depende de que lo que una puerta entrega como alto sea holgadamente lo que otra reconoce como alto: márgenes de ruido, fan-out y retardo de propagación. En una misma placa conviven 5 V, 3,3 V y 1,8 V, y la adaptación de niveles se resuelve con una comprobación previa y cinco soluciones de menos a más. El capítulo termina con un problema sin solución completa, la metaestabilidad: su tiempo medio entre fallos, el sincronizador de dos flip-flops, las entradas limpias y el reset, que suele descuidarse.  
G. Electrónica Digital · Sistemas Electrónicos Digitales y Microprocesadores — TE3, CR5  
L. [G] M. Morris Mano y Michael Ciletti, «Digital Design», Pearson. [S] Thomas L. Floyd, «Fundamentos de sistemas digitales», Pearson, 9.ª ed., 2006. [G] Paul Horowitz y Winfield Hill, «The Art of Electronics», Cambridge University Press, 3.ª ed., 2015.  

**Cap. 10 — Componentes de Potencia y Protección** (`cap10`)  
O1. Describir el funcionamiento de SCR, TRIAC y DIAC, el control por ángulo de fase y su disparo desde un microcontrolador.  
O2. Explicar cuándo elegir un IGBT y cómo excitarlo y protegerlo.  
O3. Seleccionar fusibles y protecciones escalonadas contra sobretensiones y transitorios según su energía y su velocidad.  
O4. Calcular disipadores a partir de la cadena de resistencias térmicas.  
O5. Diseñar snubbers, protecciones de polaridad inversa y limitadores de corriente de arranque.  
O6. Comparar el crowbar y el fusible electrónico y coordinar cada protección con el resto del circuito.  
R (209 palabras). El capítulo trata de lo que ocurre cuando la energía basta para destruir algo. Los tiristores conducen hasta que la corriente cae, no hasta que se retira el disparo: ese enclavamiento los hace útiles en alterna, con el control por ángulo de fase y sus problemas, y los descarta en continua sin un apagado forzado. El IGBT combina la puerta aislada del MOSFET con la conducción del bipolar, a cambio de una cola de corriente que limita la frecuencia. Las protecciones se estudian por la amenaza que detienen: el fusible, primera línea de defensa, por su velocidad; las sobretensiones, que vienen de dentro y de fuera y se especifican en julios, con una protección escalonada de varistor, TVS y filtro. Todo componente de potencia disipa, y la gestión térmica con disipadores decide su vida. Un snubber no elimina el transitorio de conmutación: lo reparte en el tiempo a costa de disipar. La protección de polaridad inversa, la limitación de la corriente de irrupción y el crowbar o el fusible electrónico completan el repertorio. La idea que recorre el capítulo es que cada protección tiene un modo de fallo que hay que conocer y debe ser más rápida que el daño que evita y más lenta que el funcionamiento normal.  
G. Electrónica de Potencia · Tecnología Electrónica — TE4, TE6, CR5  
L. [S] Muhammad H. Rashid, «Power Electronics: Devices, Circuits, and Applications», Pearson, 4.ª ed., 2014. [S] Ned Mohan, Tore M. Undeland y William P. Robbins, «Power Electronics: Converters, Applications, and Design», Wiley, 3.ª ed., 2003. [G] Robert Erickson y Dragan Maksimović, «Fundamentals of Power Electronics», Springer, 3.ª ed., 2020.  

**Cap. 11 — Introducción a los Esquemas Electrónicos** (`cap11`)  
O1. Explicar por qué un esquema representa cómo funciona un circuito y no cómo es físicamente.  
O2. Reconocer los símbolos normalizados de las dos tradiciones (IEC y ANSI/IEEE) y los designadores de referencia.  
O3. Leer un esquema con un método sistemático: alimentación, bloques, camino de la señal y notas.  
O4. Interpretar nudos, etiquetas de red, símbolos de alimentación y buses.  
O5. Relacionar el esquema con el netlist, la lista de materiales y el ratsnest.  
O6. Dibujar esquemas legibles y suficientes con criterios de anotación y buenas prácticas.  
R (212 palabras). Un esquema electrónico es el plano funcional de un circuito: muestra qué hace cada componente y cómo se conecta, con símbolos normalizados en lugar de dibujos realistas. El capítulo enseña ese lenguaje. Empieza por las dos tradiciones de símbolos que conviven, la de IEC y la norteamericana, y por lo que un símbolo dice y lo que no dice. Los designadores de referencia identifican cada componente con letras normalizadas y una numeración que tiene sus reglas. Las convenciones de dibujo no son estética: fijan la disposición, la densidad y lo que debe incluirse siempre, y se comprueban con una prueba de legibilidad. La lectura se hace con método, en cinco pasos que van de la alimentación y la masa a los bloques, el camino de la señal, la separación entre señal y servicio y las notas. Los puntos de unión, las etiquetas de red y los símbolos de alimentación resuelven las ambigüedades del dibujo. El esquema es también el origen de los ficheros que fabrican la placa, el netlist y la lista de materiales, y debe llevar valores, encapsulados, notas de diseño y bloque de título. El capítulo cierra con buenas prácticas, errores frecuentes y criterios cuantitativos de anotación, y con dos problemas sobre lo que detecta la comprobación de reglas eléctricas.  
G. Diseño de Sistemas Electrónicos · Expresión Gráfica — TE6, FB5  
L. [G] Paul Horowitz y Winfield Hill, «The Art of Electronics», Cambridge University Press, 3.ª ed., 2015.  
Normas extraídas: IEC 60617 (11.1); ANSI Y32.2 (11.1); IEEE 315 (11.3); ASME Y14.44 (11.3); IEC 81346-2 (11.3)  

**Cap. 12 — Lectura Avanzada de Esquemas y Herramientas CAD** (`cap12`)  
O1. Reconocer los bloques funcionales de un circuito real y usarlos para orientar el diagnóstico.  
O2. Identificar las partes de una fuente de alimentación conmutada y su frontera de aislamiento.  
O3. Interpretar una hoja de datos distinguiendo máximos absolutos, valores garantizados y condiciones de medida.  
O4. Describir el flujo de una herramienta CAD electrónica, el diseño jerárquico y la comprobación de reglas eléctricas.  
O5. Gestionar bibliotecas, reutilización y control de versiones de un diseño.  
O6. Planificar el flujo completo del esquema al prototipo, con sus verificaciones previas a fabricar.  
R (210 palabras). El capítulo da el salto de la lectura de esquemas sencillos a los circuitos reales. Un aparato desconocido tiene cientos de componentes, y reconocer bloques funcionales es más rápido que analizarlos uno a uno; la fuente conmutada sirve de ejemplo completo, con su frontera de aislamiento, los síntomas que delata cada bloque y las medidas seguras. La hoja de datos se presenta como el documento que decide si un diseño funciona: los máximos absolutos indican lo que destruye, no lo que se usa; de los valores típico, mínimo y máximo solo dos están garantizados, y las condiciones de medida y las gráficas contienen lo que las tablas no dicen. Las herramientas CAD reúnen esquema, simulación y placa sobre una base de datos común; el capítulo explica cómo elegirlas, el diseño jerárquico y la comprobación de reglas eléctricas, y por qué la biblioteca es donde se cuela el error caro. La reutilización de bloques probados y el control de versiones dan continuidad al trabajo. La ingeniería inversa de una placa sin esquema se trata con un método en cinco fases y sus límites legales. El capítulo termina con las nueve etapas del esquema al prototipo, el primer encendido y los criterios cuantitativos para saber cuándo un diseño está listo para fabricar.  
G. Diseño de Sistemas Electrónicos · Tecnología Electrónica — TE6, TE7  
L. [G] Paul Horowitz y Winfield Hill, «The Art of Electronics», Cambridge University Press, 3.ª ed., 2015. [G] Douglas Brooks, «PCB Currents: How They Flow, How They React», Prentice Hall, 2013.  

**Cap. 13 — Técnicas Profesionales de Soldadura y Desoldadura** (`cap13`)  
O1. Explicar el mojado, el papel del óxido y del flux y las aleaciones de soldadura con y sin plomo.  
O2. Elegir y mantener el equipo de soldadura, la punta y la temperatura de trabajo.  
O3. Soldar componentes de orificio pasante y de montaje superficial, incluida la técnica de arrastre.  
O4. Desoldar sin dañar la placa con la herramienta adecuada a cada caso.  
O5. Describir el reflujo, la pasta de soldadura, el perfil térmico, el aire caliente y la soldadura por ola.  
O6. Reconocer los defectos de soldadura según los criterios de aceptación de IPC-A-610 y repararlos.  
R (221 palabras). La soldadura es la habilidad manual fundamental de la electrónica práctica: una junta defectuosa causa un porcentaje enorme de averías, y una buena es a la vez conexión eléctrica y unión mecánica. El capítulo parte de la física: soldar no es pegar, sino conseguir el mojado entre la aleación y el metal base, con el óxido como enemigo y la transferencia de calor como clave. El equipo importa por tres características concretas, y la punta y su cuidado son la fuente del error más frecuente. La técnica se enseña paso a paso para los componentes de orificio pasante y para el montaje superficial, que resulta más asequible de lo que parece, con la técnica de arrastre para los integrados de paso fino y el aire caliente. Desoldar es más difícil que soldar, y el capítulo detalla las herramientas y cuándo conviene sacrificar el componente. La transición sin plomo y la normativa RoHS se explican por sus consecuencias físicas, incluidos los bigotes de estaño y la oleada de fallos que siguió. El flux, el reflujo con pasta y perfil térmico, el horno y la soldadura por ola completan el proceso. El capítulo termina con los defectos, cómo se reconocen y el criterio de inspección de la industria, y con criterios cuantitativos y dos problemas sobre el calor que se lleva un pad.  
G. Tecnología Electrónica — TE6, CR9  
L. [G] IPC, «IPC-2221 / IPC-A-610», IPC. [S] Clyde F. Coombs y Happy T. Holden (eds.), «Printed Circuits Handbook», McGraw-Hill, 7.ª ed., 2016.  
Normas extraídas: RoHS (13.1, 13.6, 13.7, 13.B); IPC-A-610 (13.10)  

**Cap. 14 — Prácticas en Protoboard y Proyectos de Ensamblaje** (`cap15`)  
O1. Describir la estructura interna del protoboard, su resistencia de contacto y sus parásitos.  
O2. Montar y verificar una fuente de alimentación simétrica de ±12 V.  
O3. Montar un amplificador de audio con LM386 y un indicador de nivel con LM3914, explicando su funcionamiento interno.  
O4. Controlar la velocidad de un motor de continua con PWM y un MOSFET.  
O5. Evaluar los límites del protoboard en frecuencia y aplicar un desacoplo correcto.  
O6. Planificar el paso del protoboard a la placa definitiva y diagnosticar los errores de montaje más comunes.  
R (208 palabras). Entre la teoría y el circuito soldado está el prototipo en protoboard, que permite construir, probar y modificar sin soldar. El capítulo explica primero qué hay debajo de los agujeros: tiras de clips con una resistencia de contacto que deriva y unos parásitos que se cuantifican, de modo que se sabe qué se puede montar y qué no. A continuación propone cuatro proyectos que consolidan los capítulos anteriores: una fuente simétrica de ±12 V, calculada paso a paso; un amplificador de audio con LM386, con su ganancia ajustable por condensador y la red de Boucherot; un indicador de nivel de diez LED con LM3914, en modo punto o barra y con escala ajustable; y un control de velocidad de un motor de continua por PWM, que pone en juego el MOSFET, la bobina y la interferencia. La segunda parte trata los límites: la inductancia que provoca el rebote de masa, la capacidad que acopla nodos y la resistencia que hace caer la alimentación, y cuándo hay que abandonar el protoboard. El desacoplo se presenta como una cuestión de distancia antes que de valor. El paso a la placa definitiva, con montajes intermedios como el «dead-bug», y un catálogo de errores comunes y de criterios cuantitativos cierran el capítulo.  
G. Electrónica Analógica · Electrónica de Potencia · Diseño de Sistemas Electrónicos — TE2, TE6, CR5  
L. [G] Paul Horowitz y Winfield Hill, «The Art of Electronics», Cambridge University Press, 3.ª ed., 2015. [S] Albert Malvino y David J. Bates, «Principios de electrónica», McGraw-Hill, 7.ª ed., 2007.  

### Tomo III

**Cap. 15 — Proyecto Integral: El Receptor de Radio FM7303 V3.0r7 con el FNIRSI** (`cap16`)  
O1. Explicar el funcionamiento del receptor superheterodino de FM estéreo, la frecuencia intermedia y la frecuencia imagen.  
O2. Describir la función de cada integrado del FM7303, incluida la decodificación de la señal MPX.  
O3. Identificar los componentes del kit y relacionar el esquema con la placa por bloques y con la serigrafía.  
O4. Montar el receptor paso a paso aplicando la técnica de soldadura.  
O5. Alinear y calibrar el front-end, la FI, el AFC y el decodificador estéreo con el FNIRSI 2C53T en los puntos de prueba.  
O6. Diagnosticar averías siguiendo el camino de la señal y comparando con el mapa de tensiones.  
R (224 palabras). El capítulo es el más práctico del libro: el montaje, la alineación y la comprensión completa del receptor de FM estéreo FM7303 V3.0r7, un proyecto que pone a prueba casi todo lo estudiado. Empieza por el juego de chips, cinco integrados clásicos con una función clara cada uno, y por el principio del superheterodino: convertir cualquier emisora a una frecuencia intermedia fija de 10,7 MHz, donde se amplifica y se filtra siempre igual, a cambio de la frecuencia imagen que debe atenuar el circuito sintonizado de entrada. La señal MPX explica cómo se transmite el estéreo de forma compatible con los receptores mono. El amplificador de audio, la alimentación y el display completan la descripción. La parte constructiva recorre el inventario del kit, el esquema y la placa por bloques de colores, los puntos de prueba, el montaje en ocho pasos y la carcasa. El corazón del proyecto es la alineación con el FNIRSI 2C53T: comprobación en frío, tensiones, ajuste de RF y FI, seguimiento, AFC, el ajuste del estéreo a 38 kHz y el silenciador. El diagnóstico por etapas, la lista de materiales, el manual original traducido, las equivalencias de los integrados Toshiba, la lectura de la serigrafía, el front-end, el recorrido del esquema de la antena al altavoz y el mapa de tensiones convierten el kit en un caso de estudio completo.  
G. Comunicaciones · Electrónica Analógica · Instrumentación Electrónica — TE2, TE5, TE10  
L. [G] ARRL, «The ARRL Handbook», ARRL, edición anual. [G] Wes Hayward, Rick Campbell y Bob Larkin, «Experimental Methods in RF Design», ARRL, 2003. [G] Chris Bowick, «RF Circuit Design», Newnes, 2.ª ed., 2008.  

**Cap. 16 — Microcontroladores: Arduino** (`cap17`)  
O1. Describir los bloques de un microcontrolador, su memoria, su reloj y el ciclo de vida de un programa.  
O2. Identificar los recursos de la placa Arduino UNO y sus límites eléctricos y de corriente.  
O3. Programar entradas y salidas digitales, entradas analógicas y salidas PWM, teniendo en cuenta lo que mide el convertidor.  
O4. Elegir entre UART, I²C y SPI para conectar sensores, actuadores y módulos.  
O5. Estructurar programas que no bloquean, con millis() y máquinas de estados.  
O6. Usar la cadena de herramientas y técnicas de depuración para localizar errores de compilación, de carga y de ejecución.  
R (230 palabras). Con el microcontrolador el comportamiento de un circuito pasa a definirse por software. El capítulo lo presenta como un ordenador completo en un chip, con cinco bloques, una memoria RAM escasa que condiciona el programa, varias opciones de reloj y un ciclo de vida que empieza antes de setup(). La placa Arduino UNO añade lo mínimo para funcionar y un puente USB; sus pines tienen funciones alternativas y límites que hay que respetar. Un pin digital no es un interruptor ideal: alto y bajo no son simétricos, una entrada que flota es un problema y las cargas que exceden el pin necesitan un transistor. El convertidor de 10 bits mide una proporción de su referencia y tarda un tiempo en convertir, y el PWM no es una salida analógica hasta que se filtra. La comunicación se resuelve con UART, I²C o SPI, cada una con su uso y sus trampas, y los módulos se tratan como circuitos que hay que verificar antes de conectar. Se explica qué ocurre al pulsar «subir», cómo se leen el resultado de la compilación y las bibliotecas, y por qué delay() bloquea: la alternativa es comprobar el reloj con millis(), con una resta que resuelve el desbordamiento, y organizar el programa como una máquina de estados. La alimentación de la placa, sus límites de corriente y la depuración con el puerto serie cierran el capítulo.  
G. Sistemas Electrónicos Digitales y Microprocesadores · Informática · Electrónica Digital — TE3, FB3, TE10  
L. [S] Simon Monk, «Programming Arduino: Getting Started with Sketches», McGraw-Hill, 2.ª ed., 2016. [G] Michael Barr y Anthony Massa, «Programming Embedded Systems», O'Reilly, 2.ª ed., 2006.  
Normas extraídas: RS-485 (16.6); Hoja de datos de ATmega328P (16.11)  

**Cap. 17 — Ordenadores de Placa Única: Raspberry Pi** (`cap18`)  
O1. Distinguir un ordenador de placa única de un microcontrolador y decidir cuándo conviene cada uno con criterios cuantitativos.  
O2. Describir el conector GPIO de la Raspberry Pi, su estado al arrancar y sus límites eléctricos a 3,3 V.  
O3. Controlar el hardware desde Python a través del sistema operativo, con sus permisos y su rendimiento.  
O4. Explicar el proceso de arranque del sistema operativo y la gestión de la tarjeta de memoria.  
O5. Integrar interfaces de alto nivel (cámara, pantalla, red, audio, almacenamiento) en un proyecto.  
O6. Prever el apagado seguro y la alimentación de un sistema basado en Raspberry Pi.  
R (209 palabras). La Raspberry Pi es un ordenador completo del tamaño de una tarjeta, con procesador, memoria, almacenamiento, red y vídeo, y el capítulo la estudia frente al microcontrolador. Sus cuarenta pines no son cuarenta entradas y salidas equivalentes: cada uno tiene funciones, un estado al arrancar y unos límites que deben comprobarse antes de conectar nada, y trabajan a 3,3 V sin tolerar 5 V. Programar el hardware desde Python es cómodo, pero el acceso pasa por el sistema operativo, con sus permisos, su gestión de recursos y un rendimiento que explica tanto su facilidad como sus límites. Los proyectos que justifican un ordenador de placa son los que necesitan una interfaz de alto nivel: cámara, pantalla, red, audio o almacenamiento. La comparación con el microcontrolador se plantea como dos máquinas con propósitos distintos y se resume en una tabla de decisión y en criterios cuantitativos de coste, consumo y autonomía. El arranque del sistema operativo, el sistema de ficheros sobre la tarjeta y la configuración del hardware se explican en detalle, con una advertencia que recorre el capítulo: el apagado no es opcional, porque cortar la alimentación puede corromper la tarjeta. Tres problemas sobre un optoacoplador, los límites del espacio de usuario y el apagado seguro cierran el capítulo.  
G. Sistemas Electrónicos Digitales y Microprocesadores · Informática · Informática Industrial — TE3, FB3, TE10  
L. [S] Eben Upton y Gareth Halfacree, «Raspberry Pi User Guide», Wiley, 4.ª ed., 2016. [G] Michael Barr y Anthony Massa, «Programming Embedded Systems», O'Reilly, 2.ª ed., 2006.  

**Cap. 18 — Proyectos Avanzados: Arduino y Raspberry Pi Juntos** (`cap19`)  
O1. Repartir el trabajo entre un microcontrolador para el tiempo real y un ordenador de placa para el resto.  
O2. Elegir el medio de comunicación entre placas (UART, USB, SPI, I²C, Ethernet o wifi) y su nivel físico.  
O3. Diseñar un protocolo robusto entre placas con delimitación de tramas, detección de errores, confirmación y tiempos de espera.  
O4. Aplicar watchdog, reinicio en estado seguro, detección de alimentación baja y registro en un sistema que funciona sin parar.  
O5. Dimensionar el enlace, los tiempos y el consumo de una arquitectura mixta.  
O6. Planificar el paso del prototipo al producto: alimentación, caja, despliegue, documentación y obligaciones legales.  
R (221 palabras). El capítulo une el microcontrolador y el ordenador de placa en un mismo sistema. El primero es determinista, arranca al instante y consume poco; el segundo aporta procesamiento y conectividad. El criterio de reparto se resume en una frase: el microcontrolador para el tiempo real y el ordenador para todo lo demás, con una frontera bien trazada que separa un sistema robusto de uno frágil. Las placas pueden comunicarse por UART, USB, SPI, I²C, Ethernet o wifi, y la elección se resume en una tabla; pero enviar bytes por una UART funciona en el banco y falla en el equipo real, de modo que el enlace necesita un protocolo con delimitación de tramas, detección de errores, confirmación con reintento y tiempos de espera. La estación de monitorización ambiental sirve de proyecto integrador. Un sistema que funciona día y noche necesita además un watchdog bien usado, el registro de la causa de cada reinicio, el arranque en un estado seguro y la detección de alimentación baja. El paso del prototipo al producto obliga a decidir la alimentación definitiva, la caja, la conectividad, la documentación y las obligaciones legales, como el marcado CE y RoHS. Criterios cuantitativos sobre el caudal, la tolerancia de reloj de la UART y el presupuesto de fiabilidad, y una reflexión sobre el camino por delante, cierran el capítulo.  
G. Sistemas Electrónicos Digitales y Microprocesadores · Informática Industrial · Diseño de Sistemas Electrónicos — TE3, TE10, TE6  
L. [G] Jack Ganssle, «The Art of Designing Embedded Systems», Newnes, 2.ª ed., 2008. [G] Michael Barr y Anthony Massa, «Programming Embedded Systems», O'Reilly, 2.ª ed., 2006.  
Normas extraídas: RS-232 (18.2, 18.6, 18.9); RS-485 (18.2, 18.6, 18.9); marcado CE (18.8); RoHS (18.8)  

**Cap. 19 — Componentes Especiales, Sensores e Interfaces** (`cap20`)  
O1. Dimensionar optoacopladores y relés, incluidas sus protecciones, y elegir entre relé mecánico y de estado sólido.  
O2. Elegir cristales, resonadores y osciladores y su capacidad de carga para la base de tiempos de un sistema digital.  
O3. Diseñar la protección y el acondicionamiento de las entradas de un microcontrolador.  
O4. Comparar sensores por su salida y por sus parámetros, y explicar por qué la industria transmite en lazo de corriente.  
O5. Leer encoders rotatorios y pulsadores eliminando los rebotes.  
O6. Elegir conectores y cables teniendo en cuenta la fiabilidad del contacto y los errores de diseño frecuentes.  
R (218 palabras). Un proyecto real usa, además de los componentes básicos, una familia de componentes especializados para aislar, conmutar, medir y comunicar, y casi todos se conectan a un microcontrolador. El optoacoplador aísla con luz y se dimensiona por su relación de transferencia y su velocidad; el relé conmuta lo grande con lo pequeño y necesita dos protecciones imprescindibles, y el relé de estado sólido cambia sus virtudes e inconvenientes. Los cristales y resonadores fijan la base de tiempos: su exactitud, la capacidad de carga que suele ignorarse y sus modos de fallo condicionan todo el sistema digital. Ninguna señal del mundo real entra directamente en un microcontrolador: la protección, la adaptación de nivel y el filtrado previo a la conversión forman el acondicionamiento. Los sensores se clasifican por su salida en cuatro familias, con razones para preferir el digital, y el montaje importa tanto como el sensor. Los buses se estudian desde el punto de vista del componente, y los encoders y pulsadores, desde los rebotes y su lectura correcta. Los conectores y cables, que ocupan un lugar alto en la lista de averías, reciben su propia sección. Criterios cuantitativos para cada familia y tres problemas sobre la no linealidad del puente, el cable de un sensor capacitivo y el lazo de 4 a 20 mA cierran el capítulo.  
G. Instrumentación Electrónica · Sistemas Electrónicos Digitales y Microprocesadores · Informática Industrial — TE5, TE10, TE3  
L. [S] Ramón Pallás Areny, «Sensores y acondicionadores de señal», Marcombo, 4.ª ed., 2003. [G] Paul Horowitz y Winfield Hill, «The Art of Electronics», Cambridge University Press, 3.ª ed., 2015.  
Normas extraídas: RS-485 (19.6, 19.12)  

**Cap. 20 — FNIRSI 2C53T — Guía Completa del Instrumento 3-en-1** (`cap21`)  
O1. Describir los tres instrumentos del FNIRSI 2C53T y sus limitaciones de ancho de banda, muestreo y resolución.  
O2. Compensar la sonda y elegir entre ×1 y ×10, el acoplamiento de entrada y las escalas vertical y horizontal adecuadas.  
O3. Configurar el disparo para capturar señales repetitivas y eventos únicos.  
O4. Medir con medidas automáticas y con cursores, sabiendo de dónde salen sus errores.  
O5. Usar la FFT con la ventana y la resolución adecuadas para medir distorsión y ruido, y el modo X-Y.  
O6. Aplicar el multímetro True RMS y el generador DDS con un procedimiento de medida seguro, incluidas las medidas flotantes.  
R (225 palabras). El capítulo es la guía completa del FNIRSI 2C53T, el instrumento tres en uno que acompaña a todo el libro: osciloscopio, multímetro y generador. Parte de lo que un osciloscopio muestra y lo que no, y de cuatro limitaciones que conviene conocer desde el principio. Tras reconocer el panel, los botones y la pantalla, la compensación de la sonda se presenta como un paso obligatorio que invalida todas las medidas si se omite. Las escalas de voltios y tiempo por división, el acoplamiento AC, DC y GND y la elección entre las sondas ×1 y ×10, en la que manda la capacidad, preparan la medida. El sistema de disparo se explica a fondo: modos, nivel y flanco, acoplamiento, holdoff, pre-trigger y modo único para capturar un fallo raro. Las medidas automáticas y los cursores se comparan por su origen de error, y la función matemática añade la resta y la FFT, que el libro usa como instrumento para medir distorsión, ruido y oscilaciones: leakage, ventanas, promediado y los errores que producen espectros falsos. El modo X-Y, el multímetro True RMS de 19 999 cuentas y el generador DDS completan las funciones. Un flujo de trabajo en procedimientos, aplicaciones de diagnóstico, el mantenimiento, los límites de ancho de banda, muestreo y aliasing, y los peligros de la masa del osciloscopio en medidas flotantes cierran la guía.  
G. Instrumentación Electrónica — TE5  
L. [S] Miguel A. Pérez García y otros, «Instrumentación electrónica», Thomson, 2004. [G] Paul Horowitz y Winfield Hill, «The Art of Electronics», Cambridge University Press, 3.ª ed., 2015.  
Normas extraídas: Manual de 2C53T (20.17)  

### Tomo IV

**Cap. 21 — Prácticas de Laboratorio con el FNIRSI 2C53T** (`cap22`)  
O1. Comprobar experimentalmente la ley de Ohm, el divisor y el efecto de carga del instrumento.  
O2. Medir la carga y descarga de un circuito RC y la característica I-V de un diodo, punto a punto y en modo X-Y.  
O3. Medir la rectificación, el rizado y la forma de la corriente de un rectificador de media onda.  
O4. Levantar el diagrama de Bode de un filtro RC y la curva de resonancia y el factor Q de un circuito RLC.  
O5. Observar armónicos con la FFT, la modulación AM y FM y su demodulación.  
O6. Medir el tiempo de subida y el ancho de banda de un sistema de medida, y valores de L y C con puentes y con un medidor LCR.  
O7. Analizar las discrepancias entre teoría y medida y documentar una práctica en el cuaderno.  
R (219 palabras). El capítulo cierra el círculo entre teoría y banco con doce prácticas guiadas, montables en protoboard, que permiten ver y medir con el FNIRSI los fenómenos de los capítulos de teoría. Cada práctica indica su objetivo, el material, el montaje, el procedimiento y lo que debería observarse, y casi todas provocan un descubrimiento. El divisor de tensión enseña que el instrumento carga el circuito y que un divisor no alimenta nada. La carga de un condensador comprueba la exponencial; la curva I-V del diodo convierte la ecuación de Shockley en algo visto; el rectificador de media onda revela la forma impulsiva de la corriente. El filtro RC se mide punto a punto hasta obtener su diagrama de Bode, y la FFT muestra que la simetría de una forma de onda explica los armónicos ausentes. El 555 en astable, el transistor como interruptor y la resonancia RLC, con su factor Q y la sobretensión que sorprende, completan la parte de circuitos. Las últimas prácticas miden el tiempo de subida y el ancho de banda del propio sistema de medida, la modulación AM y FM y su demodulación, y las inductancias y capacidades con puentes clásicos y con un medidor LCR. El cierre ordena las fuentes de discrepancia entre la teoría y la medida y explica cómo se anota una práctica.  
G. Instrumentación Electrónica · Teoría de Circuitos · Electrónica Analógica — TE5, CR4, TE2  
L. [S] Miguel A. Pérez García y otros, «Instrumentación electrónica», Thomson, 2004. [G] Paul Horowitz y Winfield Hill, «The Art of Electronics», Cambridge University Press, 3.ª ed., 2015.  
Normas extraídas: Manual de 2C53T (21.6)  

**Cap. 22 — Métodos Formales de Análisis de Circuitos** (`cap23`)  
O1. Describir un circuito con los conceptos topológicos de nudo, rama, malla y árbol, y aplicar la dualidad.  
O2. Plantear y resolver el análisis por nudos y por mallas, incluidos el supernudo y la supermalla.  
O3. Aplicar los teoremas de superposición, Thévenin, Norton, Millman y máxima transferencia de potencia, y la transformación de fuentes.  
O4. Incluir fuentes dependientes en el análisis.  
O5. Extender los métodos al régimen de alterna con impedancias complejas.  
O6. Formular el análisis nodal en forma matricial, como lo hacen los simuladores, y aplicar reciprocidad, sustitución y el teorema de Tellegen.  
R (218 palabras). Resolver circuitos caso por caso funciona mientras son pequeños; con diez nudos y varias fuentes hace falta un método que no dependa de la intuición. El capítulo lo construye empezando por la topología: nudos, ramas y mallas, los números que se deducen de ellos y la dualidad. Las leyes de Kirchhoff se revisan en profundidad, incluidos los casos en que dejan de valer. El análisis por nudos, el que usan los ordenadores, se desarrolla con su matriz de conductancias y el supernudo para las fuentes de tensión; el análisis por mallas, con la supermalla, se reserva para los casos en que da menos ecuaciones. Los teoremas permiten sustituir media red por un equivalente: la superposición, válida solo en circuitos lineales; Thévenin y Norton, con su medida experimental y sus límites; la transformación de fuentes, y la máxima transferencia de potencia, con su rendimiento del 50 % y los tres criterios de acoplamiento. Todo se extiende a la alterna con números complejos, y las fuentes dependientes cambian una regla de las anteriores. El teorema de Millman es un atajo para nudos con muchas ramas; la formulación matricial del análisis nodal es la base de los simuladores, y la reciprocidad, la sustitución y el teorema de Tellegen cierran un capítulo que convierte el análisis de circuitos en un procedimiento sistemático.  
G. Teoría de Circuitos — CR4, TE1, FB1  
L. [G] Charles Alexander y Matthew Sadiku, «Fundamentals of Electric Circuits», McGraw-Hill. [S] William H. Hayt, Jack E. Kemmerly y Steven M. Durbin, «Análisis de circuitos en ingeniería», McGraw-Hill, 8.ª ed., 2012.  

**Cap. 23 — Régimen Transitorio y Análisis en Alterna** (`cap24`)  
O1. Separar la respuesta de un circuito en transitorio y régimen permanente y resolver circuitos de primer orden con sus tres datos.  
O2. Resolver la respuesta de segundo orden de un circuito RLC y relacionar el amortiguamiento con el factor de calidad.  
O3. Describir una senoide por su valor eficaz, su factor de cresta y su desfase, y medir el desfase.  
O4. Analizar circuitos en régimen senoidal permanente con fasores e impedancias.  
O5. Calcular las potencias activa, reactiva y aparente y corregir el factor de potencia.  
O6. Analizar la resonancia serie y paralelo, la admitancia y los límites del factor de calidad.  
O7. Analizar la inductancia mutua y el transformador en alterna.  
R (216 palabras). Entre el instante en que algo cambia y el momento en que el circuito se asienta hay un transitorio gobernado por condensadores y bobinas, y el capítulo lo estudia resolviendo las ecuaciones diferenciales del circuito antes de pasar al régimen senoidal permanente. Toda respuesta es la suma de una natural, que tiene la forma del circuito y decae, y una forzada, que tiene la forma de la fuente; en primer orden bastan el valor inicial, el final y la constante de tiempo. El segundo orden lo gobierna el amortiguamiento, equivalente al factor de calidad: el circuito que más oscila tras un escalón es el que más selectivamente resuena. La senoide, que no es una convención arbitraria, se describe por su valor eficaz, su factor de cresta y su desfase. Los fasores convierten la alterna en una continua compleja en la que R, jωL y 1/(jωC) se combinan con Kirchhoff, Thévenin y Norton. En alterna hay tres potencias, activa, reactiva y aparente, y el cableado se dimensiona por la aparente; un condensador corrige el desfase de una carga inductiva, pero no los armónicos de una fuente conmutada. La resonancia serie y paralelo, la admitancia, el factor de calidad cargado y sus límites, la inductancia mutua y el transformador en alterna, con su banda limitada, completan el capítulo.  
G. Teoría de Circuitos · Electrotecnia y Máquinas Eléctricas — CR4, TE1, FB1  
L. [G] Charles Alexander y Matthew Sadiku, «Fundamentals of Electric Circuits», McGraw-Hill. [S] William H. Hayt, Jack E. Kemmerly y Steven M. Durbin, «Análisis de circuitos en ingeniería», McGraw-Hill, 8.ª ed., 2012.  
Normas extraídas: EN 61000-3-2 (23.5)  

**Cap. 24 — Cuadripolos, Función de Transferencia y Filtros** (`cap25`)  
O1. Modelar un bloque como cuadripolo y elegir el juego de parámetros adecuado.  
O2. Operar con decibelios absolutos y relativos sin errores conceptuales.  
O3. Trazar diagramas de Bode asintóticos de módulo y fase a partir de polos y ceros.  
O4. Diseñar filtros pasivos y activos (Sallen-Key, realimentación múltiple, variable de estado) y conocer los de condensadores conmutados.  
O5. Elegir el orden y la aproximación de un filtro (Butterworth, Chebyshev, elíptico, Bessel) según su compromiso.  
O6. Diseñar filtros paso banda y banda eliminada y relacionarlos con el factor de calidad.  
O7. Evaluar la fase y el retardo de grupo de un filtro y sus consecuencias en el dominio del tiempo.  
R (228 palabras). Un circuito de señal interesa por cómo trata cada frecuencia, y el capítulo da el salto al análisis en frecuencia. Primero modela cualquier bloque como una caja de dos puertos, con cuatro magnitudes y varios juegos de parámetros, de los que dos se usan casi siempre y otros se reservan para la radiofrecuencia. El decibelio se presenta como una relación y no como una cantidad, con los valores que conviene saber de memoria y los que llevan referencia. La función de transferencia se representa en el diagrama de Bode, que se dibuja con asíntotas a partir de los polos y los ceros, con el pico de resonancia del segundo orden y una fase que es donde está la dificultad. Los filtros son el uso más directo de estas ideas: los pasivos, con sus cuatro tipos y sus parámetros; los activos, que resuelven las limitaciones de los pasivos con las topologías de Sallen-Key, de realimentación múltiple y de variable de estado, siempre condicionados por el operacional; y los de condensadores conmutados, que se sintetizan sin resistencias. El orden coincide con el número de elementos que almacenan energía, y las aproximaciones de Butterworth, Chebyshev, elíptica y Bessel reparten de forma distinta el compromiso entre pendiente, rizado y fase. Los filtros de banda, el notch y el retardo de grupo, que decide si retardar es o no distorsionar, cierran el capítulo.  
G. Teoría de Circuitos · Electrónica Analógica · Señales y Sistemas — CR4, TE2, TE6  
L. [G] Sergio Franco, «Design with Operational Amplifiers and Analog Integrated Circuits», McGraw-Hill, 4.ª ed., 2015. [G] Charles Alexander y Matthew Sadiku, «Fundamentals of Electric Circuits», McGraw-Hill.  

**Cap. 25 — Semiconductores en Profundidad** (`cap26`)  
O1. Explicar la estructura de bandas del silicio, la generación y recombinación de portadores y el dopado.  
O2. Describir la unión PN y la movilidad de los portadores como origen del comportamiento de los dispositivos.  
O3. Analizar los modos de trabajo del BJT y sus modelos (Ebers-Moll, transporte en la base, pequeña señal, Gummel-Poon).  
O4. Explicar la formación del canal del MOSFET, sus capacidades, sus regiones y su coeficiente térmico.  
O5. Relacionar las capacidades de unión y el tiempo de tránsito con la velocidad de los dispositivos.  
O6. Evaluar el efecto de la temperatura en los parámetros de diodos y transistores.  
O7. Comparar el silicio con SiC y GaN y explicar la estructura y los límites del IGBT.  
R (236 palabras). Los capítulos 5 a 7 presentaron el diodo y los transistores por lo que hacen en el circuito; este abre la caja para explicar de dónde salen las cifras de las hojas de datos. Parte del cristal de silicio, que no es buen conductor ni buen aislante sino que está exactamente en medio, de su estructura de bandas y de la banda prohibida, que determina casi todo, con el par electrón-hueco y la generación y recombinación. El dopado crea portadores libres y la unión PN es donde ocurre todo lo demás. Sobre ella se construye el bipolar, con sus cuatro modos de trabajo y cuatro modelos que sirven para cosas distintas, de Ebers-Moll a Gummel-Poon, pasando por el transporte en la base y la pequeña señal. El MOSFET se explica por su estructura, la formación del canal y unas capacidades que son su límite real, y por su comportamiento: dos regiones, un coeficiente térmico decisivo, el diodo de cuerpo y la sensibilidad electrostática. La velocidad de los dispositivos depende de dos causas físicas, las capacidades de la unión y el tiempo de tránsito, que se combaten de forma distinta. La temperatura lo mueve todo, y el capítulo resume sus efectos en una tabla. Los materiales de banda ancha, SiC y GaN, rompen los compromisos del silicio, y el IGBT, con la modulación de conductividad, su cola de corriente y el riesgo de latch-up, cierra el capítulo.  
G. Fundamentos de Electrónica · Física — CR5, FB2, TE2  
L. [G] Ben Streetman y Sanjay Banerjee, «Solid State Electronic Devices», Pearson, 7.ª ed., 2015. [S] Simon M. Sze y Kwok K. Ng, «Physics of Semiconductor Devices», Wiley, 3.ª ed., 2007.  

**Cap. 26 — El Amplificador Operacional y la Realimentación** (`cap27`)  
O1. Aplicar el modelo ideal del operacional y reconocer cuándo deja de valer.  
O2. Cuantificar los beneficios de la realimentación negativa e identificar sus cuatro topologías.  
O3. Diseñar las configuraciones básicas y los circuitos de operación con señales (sumador, restador, integrador, derivador, logarítmico).  
O4. Evaluar las limitaciones del operacional real y elegir la familia adecuada.  
O5. Diseñar comparadores con histéresis y amplificadores de instrumentación.  
O6. Analizar la estabilidad del lazo con los márgenes de fase y de ganancia y aplicar técnicas de compensación, incluida la carga capacitiva.  
R (217 palabras). Si hubiera que elegir un solo bloque que resume la electrónica analógica moderna, sería el amplificador operacional, y con la realimentación se convierte en casi cualquier cosa. El capítulo parte del modelo ideal, con sus dos reglas de oro y la condición que se olvida, y de los errores de razonamiento habituales. La realimentación negativa convierte una ganancia grande, imprecisa y no lineal en otra exacta fijada por resistencias: sus cinco beneficios se cuantifican con el factor 1 + A·β, junto con lo que no mejora, las cuatro topologías y la masa virtual. Las configuraciones básicas resuelven casi todo y se combinan para sumar, restar, integrar, derivar y operar con logaritmos. El operacional real tiene límites que en algún momento se notan, y elegirlo es elegir por el parámetro que importa. La realimentación positiva da los comparadores con histéresis. El amplificador de instrumentación de tres operacionales resuelve la medida de diferencias pequeñas sobre una tensión común. La segunda mitad trata la estabilidad: el precio de la realimentación, los márgenes de fase y de ganancia, la compensación por polo dominante y por efecto Miller, el caso difícil de la carga capacitiva y cómo medir el margen de fase sin analizador de redes. Tres problemas de diseño, una célula de carga, un fotodiodo y un termostato, cierran el capítulo.  
G. Electrónica Analógica · Regulación Automática · Instrumentación Electrónica — TE2, TE8, TE5  
L. [G] Sergio Franco, «Design with Operational Amplifiers and Analog Integrated Circuits», McGraw-Hill, 4.ª ed., 2015. [G] Ron Mancini (ed.), «Op Amps for Everyone», Texas Instruments / Newnes. [G] Adel Sedra y Kenneth Smith, «Microelectronic Circuits», Oxford University Press.  

**Cap. 27 — Osciladores, PLL y Referencias de Frecuencia** (`cap28`)  
O1. Enunciar las condiciones de oscilación y clasificar las tres familias de osciladores.  
O2. Describir el funcionamiento de un PLL y elegir su ancho de banda de lazo.  
O3. Diseñar osciladores de cristal en configuración Pierce y osciladores RC de baja frecuencia con control de amplitud.  
O4. Analizar osciladores de relajación y multivibradores.  
O5. Explicar el ruido de fase y el jitter y sus consecuencias en los sistemas.  
O6. Asegurar el arranque de un oscilador y la estabilización de su amplitud.  
R (225 palabras). El capítulo trata los circuitos que generan su propia señal, los que sincronizan una señal con otra y las referencias que fijan su frecuencia, todos con la realimentación del capítulo anterior puesta a trabajar para crear y enganchar; dos de estos bloques están en el FM7303. Un oscilador convierte energía continua en una señal periódica: necesita una ganancia de lazo suficiente y una fase adecuada, y su estabilidad de frecuencia depende de la familia elegida. El lazo de enganche de fase compara la fase de la entrada con la de un oscilador propio y lo corrige hasta que coinciden; su ancho de banda es la decisión central, con el enganche, la captura y los espurios del fraccionario. El cristal se distingue del circuito LC por su estabilidad y sus dos resonancias, y se monta en el circuito de Pierce. Por debajo de unos cientos de kilohercios se usan los osciladores RC, como el puente de Wien con control automático de amplitud o los de desplazamiento de fase, y los multivibradores de relajación, sencillos e imprecisos. El ruido de fase y el jitter son el mismo fenómeno visto en frecuencia y en tiempo, con consecuencias distintas en radio, conversión y comunicaciones. El capítulo termina con el arranque y la estabilización de amplitud y con tres problemas, uno de ellos una fuente lineal completa desde la especificación.  
G. Electrónica Analógica · Comunicaciones — TE2, TE6, TE10  
L. [G] Paul Horowitz y Winfield Hill, «The Art of Electronics», Cambridge University Press, 3.ª ed., 2015. [G] Chris Bowick, «RF Circuit Design», Newnes, 2.ª ed., 2008.  

**Cap. 28 — Electrónica Digital: Lógica, Secuencias y Memoria** (`cap29`)  
O1. Explicar la regeneración que justifica la representación digital y sus costes.  
O2. Simplificar funciones lógicas con el álgebra de Boole y formas canónicas, y prever los glitches.  
O3. Diseñar circuitos secuenciales con latches y flip-flops respetando sus tiempos.  
O4. Diseñar máquinas de estados de Moore y Mealy, contadores y registros de desplazamiento.  
O5. Comparar las tecnologías de memoria (SRAM, DRAM, Flash, EEPROM, FRAM).  
O6. Aplicar las condiciones de setup, hold y skew para fijar la frecuencia máxima de un diseño síncrono.  
O7. Representar números en hexadecimal, BCD, complemento a dos, coma fija y coma flotante, y describir cómo se construye un procesador.  
R (221 palabras). La electrónica digital trabaja con dos niveles y, sobre ellos, construye desde una puerta hasta un microprocesador; el capítulo es el cimiento teórico de los microcontroladores. Empieza por la razón de fondo, la regeneración de la señal, con lo que se paga por ella y lo que siempre seguirá siendo analógico. El álgebra de Boole y las puertas reales llevan a la lógica combinacional, con sus bloques que se repiten, la simplificación, las formas canónicas y los glitches que no aparecen en la tabla de verdad. La memoria llega con la lógica secuencial: latch y flip-flop no son lo mismo, y los tiempos son lo que importa. Las máquinas de estados de Moore y Mealy se diseñan paso a paso, con la codificación de los estados y el riesgo de los estados no alcanzables; contadores y registros son casos particulares. Las memorias, SRAM, DRAM, Flash, EEPROM y FRAM, guardan un bit de cinco formas distintas con consecuencias prácticas que se resumen en una tabla. El diseño síncrono se justifica como la única forma sensata de controlar retardos que varían con la temperatura, la tensión y el ejemplar: setup, hold, skew y frecuencia máxima. La representación numérica, del hexadecimal a la coma flotante y el orden de los bytes, y el ensamblaje de un procesador con las piezas vistas cierran el capítulo.  
G. Electrónica Digital · Sistemas Electrónicos Digitales y Microprocesadores — TE3, TE6  
L. [G] M. Morris Mano y Michael Ciletti, «Digital Design», Pearson. [S] David Money Harris y Sarah L. Harris, «Digital Design and Computer Architecture», Morgan Kaufmann, 2.ª ed., 2012. [S] Thomas L. Floyd, «Fundamentos de sistemas digitales», Pearson, 9.ª ed., 2006.  
Normas extraídas: JEDEC (28.6)  

### Tomo V

**Cap. 29 — Señales y Sistemas: Muestreo, Convolución y DSP** (`cap30`)  
O1. Clasificar las señales y caracterizar los sistemas lineales e invariantes por su respuesta al impulso, su causalidad y su estabilidad.  
O2. Calcular la convolución continua y discreta y relacionarla con el producto en frecuencia.  
O3. Aplicar el teorema de muestreo y dimensionar el filtro antialiasing y el sobremuestreo.  
O4. Usar la transformada Z para obtener la función de transferencia discreta y estudiar su estabilidad en el círculo unidad.  
O5. Aplicar la FFT con ventanas y el algoritmo de Goertzel, y comparar filtros digitales FIR e IIR.  
O6. Convertir un circuito en un algoritmo y evaluar los efectos de la coma fija.  
O7. Usar la correlación, el filtro adaptado y el espectrograma para analizar señales.  
R (234 palabras). El capítulo tiende el puente entre el mundo analógico y el digital con el lenguaje de las señales y los sistemas, y desemboca en el procesamiento digital de señal. Una señal puede ser continua o discreta en dos ejes independientes, determinista o aleatoria, periódica o no. Un sistema lineal e invariante queda descrito por completo por su respuesta al impulso, y su salida es la convolución de la entrada con ella, que en frecuencia se convierte en un producto; la FFT permite calcularla deprisa. El teorema de muestreo fija la frecuencia mínima, el aliasing es lo que ocurre si no se cumple y el filtro antialiasing, hoy apoyado en el sobremuestreo, es su defensa; la cuantificación es el otro eje de la discretización. La transformada Z hace con las señales muestreadas lo que Laplace con las continuas: el círculo unidad sustituye al eje imaginario como frontera de la estabilidad. La FFT cambió el procesado de señal, con las ventanas como detalle que más resultados estropea, el algoritmo de Goertzel para una sola frecuencia y los filtros FIR e IIR, que pueden lo que el analógico no. El paso del circuito al algoritmo se hace con tres métodos de conversión y las trampas de la coma fija. La correlación, el filtro adaptado, el amplificador lock-in como caso particular y el espectrograma, con su compromiso inevitable entre resolución en tiempo y en frecuencia, cierran el capítulo.  
G. Señales y Sistemas · Comunicaciones · Matemáticas — FB1, TE7, TE10  
L. [G] Alan Oppenheim y Alan Willsky, «Signals and Systems», Pearson, 2.ª ed., 1997. [G] Richard Lyons, «Understanding Digital Signal Processing», Pearson, 3.ª ed., 2011.  

**Cap. 30 — Control y Comunicaciones** (`cap31`)  
O1. Describir un sistema de control en lazo abierto y cerrado con la terminología precisa.  
O2. Sintonizar un controlador PID por métodos clásicos, incluido Ziegler-Nichols, e implementarlo en forma discreta con anti-windup.  
O3. Analizar la estabilidad de un lazo con los márgenes de fase, de ganancia y de retardo y el lugar de las raíces.  
O4. Valorar los efectos del muestreo y la cuantificación en un control digital y elegir alternativas al PID cuando no basta.  
O5. Explicar el planteamiento del control en espacio de estados, la controlabilidad, la observabilidad y el observador.  
O6. Comparar las modulaciones analógicas y digitales y la multiplexación por su ancho de banda y su robustez frente al ruido.  
O7. Aplicar la detección y corrección de errores a un enlace de comunicaciones.  
R (221 palabras). El capítulo aplica lo anterior a dos campos que comparten cimiento: el control, que hace que un sistema se comporte como se quiere mediante realimentación, y las comunicaciones, que llevan información mediante la modulación. Controlar es hacer que una magnitud tome el valor deseado pese a las perturbaciones, y el capítulo insiste en decidir antes de elegir el controlador. El PID se presenta con sus elementos, la caracterización de la planta y los criterios de calidad, y se lleva de la forma de libro a la que funciona: sintonía por cuatro métodos, forma discreta, anti-windup y el método de Ziegler-Nichols en sus dos variantes. La estabilidad del lazo se analiza con los márgenes de fase, de ganancia y de retardo, el pico de sensibilidad y el lugar de las raíces. El control digital añade el retardo del muestreo y el suelo de la cuantificación, y cuando la lógica clásica no basta aparecen el todo-nada con histéresis, el control difuso, el adaptativo y el predictivo. Los actuadores, último eslabón del lazo, y una ampliación sobre el espacio de estados completan la parte de control. En comunicaciones, el capítulo explica por qué hay que modular, el compromiso entre banda y ruido de AM, FM y PM, las modulaciones digitales y sus constelaciones, la multiplexación del medio y la detección y corrección de errores.  
G. Regulación Automática · Comunicaciones · Automatización Industrial — TE8, CR6, TE10  
L. [G] Katsuhiko Ogata, «Modern Control Engineering», Pearson, 5.ª ed., 2010. [G] Karl Åström y Tore Hägglund, «Advanced PID Control», ISA, 2006. [S] Simon Haykin, «Communication Systems», Wiley, 4.ª ed., 2001.  
Normas extraídas: NEMA 17 (30.8)  

**Cap. 31 — Ruido y Compatibilidad Electromagnética (EMC)** (`cap32`)  
O1. Distinguir ruido de interferencia y describir los ruidos térmico, de disparo, 1/f y en ráfagas.  
O2. Sumar ruidos en cuadratura con su densidad espectral y su ancho de banda equivalente y referirlos a la entrada.  
O3. Calcular la relación señal/ruido, la figura de ruido con la fórmula de Friis y la temperatura de ruido de una cadena.  
O4. Elaborar el presupuesto de ruido de una cadena de medida o de recepción.  
O5. Identificar las cuatro vías de acoplamiento de una interferencia y distinguir el modo común del diferencial.  
O6. Aplicar apantallamiento, masas, filtros y ferritas contra la interferencia, y resolver bucles de tierra.  
O7. Describir los ensayos de emisión e inmunidad de la normativa y realizar medidas de precompliance en el banco.  
R (221 palabras). Ningún circuito vive aislado: sus componentes generan ruido que pone un suelo a la señal, el exterior le inyecta interferencias y él ensucia a sus vecinos. La primera mitad del capítulo trata el ruido como límite físico. Separa ruido de interferencia, describe sus tipos, térmico, de disparo, 1/f y en ráfagas, y establece reglas propias para sumarlo: en cuadratura, con densidad espectral y ancho de banda equivalente, referido a la entrada. La relación señal/ruido, la figura de ruido y la fórmula de Friis explican por qué la primera etapa decide, y los presupuestos de ruido de una cadena, con números, enseñan a calcular antes de montar. El promediado y el amplificador lock-in recuperan señales enterradas, y la temperatura de ruido es la forma de expresarlo en radiofrecuencia. La segunda mitad aborda la compatibilidad electromagnética. Toda interferencia tiene fuente, camino y receptor, y el camino es una de cuatro vías: conducción, acoplamiento capacitivo, inductivo o radiación. El modo común, más difícil que el diferencial, decide el filtro; las masas, los planos y los bucles de tierra se resuelven por la impedancia común; el apantallamiento y los filtros y ferritas tienen sus detalles que lo arruinan todo. La normativa y sus ensayos, la medida de precompliance en el banco sin cámara anecoica y el FM7303 como víctima y como fuente cierran el capítulo.  
G. Instrumentación Electrónica · Comunicaciones · Diseño de Sistemas Electrónicos — TE5, TE6, FB2  
L. [G] Henry Ott, «Electromagnetic Compatibility Engineering», Wiley, 2009. [G] Paul Horowitz y Winfield Hill, «The Art of Electronics», Cambridge University Press, 3.ª ed., 2015.  
Normas extraídas: RS-485 (31.10); Manual de FM7303 (31.C)  

**Cap. 32 — Electrónica de Potencia y Conversión de Energía** (`cap33`)  
O1. Explicar por qué conmutar es más eficiente que regular linealmente y dónde se pierde la energía.  
O2. Analizar los convertidores reductor, elevador y reductor-elevador por el balance voltios-segundo, en modo continuo y discontinuo.  
O3. Describir las topologías aisladas (flyback, forward) y las de más potencia (push-pull, medio puente, puente completo).  
O4. Comparar los modos de control en tensión, en corriente y por histéresis, y compensar el lazo con redes de tipo II y III.  
O5. Diseñar los magnéticos de un convertidor, incluido el transformador de un flyback.  
O6. Explicar la corrección del factor de potencia, la rectificación síncrona y la conmutación suave.  
O7. Gobernar motores de continua, paso a paso y BLDC con un puente en H, y describir el principio del motor de inducción.  
R (237 palabras). La sección 8.4 presentó la fuente conmutada como una idea; el capítulo la convierte en una disciplina de diseño en la que el rendimiento y el calor mandan. Conmutar es eficiente porque el interruptor no disipa idealmente ni abierto ni cerrado, y la bobina promedia los trozos de tensión; todo convertidor tiene tres bloques. El reductor se estudia en detalle: dos fases del ciclo, el balance voltios-segundo, el rizado y el dimensionado de la bobina, los modos continuo y discontinuo, las pérdidas y un trazado que no es un detalle. El elevador usa la bobina como bomba, y el reductor-elevador y sus parientes se eligen con una tabla. Las topologías aisladas, flyback y forward, y las de más potencia, push-pull, medio puente y puente completo, superan los límites de una sola rama. Un convertidor es un lazo de control: el modo tensión, el modo corriente y el de histéresis se comparan, y la compensación con redes de tipo II y III se calcula, no se ajusta por tanteo. Las pérdidas se reparten en cinco sitios, y la corrección del factor de potencia, la rectificación síncrona y la conmutación suave de los convertidores resonantes las reducen. El diseño de magnéticos, con el transformador de un flyback calculado con números, y el gobierno de motores con el puente en H, ampliado con el motor de continua, el de inducción, el paso a paso y el BLDC, completan el capítulo.  
G. Electrónica de Potencia · Electrotecnia y Máquinas Eléctricas · Regulación Automática — TE4, TE6, CR4  
L. [G] Robert Erickson y Dragan Maksimović, «Fundamentals of Power Electronics», Springer, 3.ª ed., 2020. [S] Ned Mohan, Tore M. Undeland y William P. Robbins, «Power Electronics: Converters, Applications, and Design», Wiley, 3.ª ed., 2003. [G] Marty Brown, «Power Supply Cookbook», Newnes, 2.ª ed., 2001. [G] Colonel Wm. T. McLyman, «Transformer and Inductor Design Handbook», CRC Press, 4.ª ed., 2011.  
Normas extraídas: EN 61000-3-2 (32.8)  

**Cap. 33 — Conversión de Datos: ADC y DAC** (`cap34`)  
O1. Cuantificar el error de cuantificación y la mejora que aportan el dither y el sobremuestreo.  
O2. Describir el muestreo y retención y el límite que impone el jitter de apertura.  
O3. Comparar las arquitecturas de ADC (flash, SAR, sigma-delta, doble rampa) y de DAC (ponderado, R-2R, string, de corriente, PWM, sigma-delta).  
O4. Interpretar los errores estáticos y dinámicos (INL, DNL, monotonía, glitch, ENOB) en las especificaciones.  
O5. Diseñar el acondicionamiento previo al convertidor: amplificador, filtro antialiasing, referencia y multiplexado.  
O6. Evaluar la influencia del jitter del reloj de muestreo en un convertidor de alta velocidad.  
R (212 palabras). El capítulo describe la máquina que cruza la frontera entre lo analógico y lo digital: el conversor analógico-digital, que mide, y el digital-analógico, que reconstruye. La cuantificación introduce un error irreductible de medio LSB, con la regla de los 6,02 dB por bit, pero la cifra honesta es el número efectivo de bits; el dither y el sobremuestreo ganan resolución. El muestreo y retención congela la señal mientras se convierte, y su jitter de apertura fija el límite. Los errores de un DAC, monotonía y glitch incluidos, se miden directamente porque la entrada se controla. Las cuatro arquitecturas de ADC, flash, aproximaciones sucesivas, sigma-delta y doble rampa, responden a cuatro compromisos, y las de DAC, de las resistencias ponderadas y la escalera R-2R al sigma-delta, a los mismos. Un convertidor de 16 bits no tiene 16 bits de exactitud: unos errores se calibran y los de linealidad, INL y DNL, no. La etapa que decide la calidad de la medida es el acondicionamiento previo, con el amplificador, el filtro antialiasing, la referencia, que es el patrón del sistema, y la trampa del multiplexado. Los convertidores de los proyectos del libro, el dither, el jitter del reloj de muestreo y un resumen con las herramientas y las pruebas de caracterización cierran el capítulo.  
G. Instrumentación Electrónica · Electrónica Digital · Señales y Sistemas — TE5, TE3, TE6  
L. [S] Walt Kester (ed.), «Data Conversion Handbook», Newnes, 2005. [G] Paul Horowitz y Winfield Hill, «The Art of Electronics», Cambridge University Press, 3.ª ed., 2015.  

**Cap. 34 — Sensores y Acondicionamiento de Señal** (`cap35`)  
O1. Describir la cadena de medida y elaborar su presupuesto de incertidumbre, distinguiendo exactitud, resolución y repetibilidad.  
O2. Elegir entre RTD, termopar, termistor e integrado para medir temperatura.  
O3. Medir fuerza y deformación con galgas extensométricas en puente de Wheatstone.  
O4. Describir sensores de movimiento, campo magnético, proximidad, corriente, luz, gas y humedad.  
O5. Aplicar el amplificador de instrumentación y la medida ratiométrica en el acondicionamiento.  
O6. Linealizar, calibrar y filtrar la medida en el orden correcto.  
O7. Valorar cuándo conviene un sensor inteligente con bus digital frente a uno analógico.  
R (214 palabras). Un sistema electrónico solo es útil si percibe el mundo, y el sensor entrega una señal débil, ruidosa y no lineal que hay que acondicionar para que un convertidor la lea con fidelidad. El capítulo empieza por la cadena de medida, cuya calidad la fija el eslabón más débil, con sus seis etapas, el presupuesto de incertidumbre y la distinción entre exactitud, resolución y repetibilidad. La temperatura, la aplicación más común, se reparte entre tres familias con tres físicas distintas: la RTD de platino, el termopar y el termistor NTC, con el integrado como respuesta a menudo correcta. La galga extensométrica mide deformación como una resistencia que cambia, y el puente de Wheatstone, en sus tres configuraciones, la convierte en tensión. Siguen los sensores de movimiento, como acelerómetros, giróscopos e IMU; los de campo, proximidad y corriente, con el efecto Hall, el transformador de corriente y el shunt; y los de luz, gas y humedad, que se miden indirectamente. El amplificador de instrumentación resuelve la medida de diferencias pequeñas sobre una tensión común, y la linealización, la calibración y el filtrado convierten el número bruto en un valor útil. La excitación del sensor y la medida ratiométrica, los sensores de los proyectos del libro y los sensores inteligentes con bus digital cierran el capítulo.  
G. Instrumentación Electrónica — TE5, TE6  
L. [S] Ramón Pallás Areny, «Sensores y acondicionadores de señal», Marcombo, 4.ª ed., 2003. [S] Ramón Pallás Areny y John G. Webster, «Sensors and Signal Conditioning», Wiley, 2.ª ed., 2001.  

**Cap. 35 — Radiofrecuencia y Líneas de Transmisión** (`cap36`)  
O1. Determinar cuándo un conductor debe tratarse como línea de transmisión y calcular reflexiones y relación de onda estacionaria.  
O2. Interpretar los parámetros S y la carta de Smith.  
O3. Diseñar redes de adaptación en L, T y π, y con líneas, y relacionar su Q con el ancho de banda.  
O4. Describir filtros trazados en cobre con stubs y líneas acopladas.  
O5. Analizar los bloques de un receptor, su intermodulación y su margen dinámico.  
O6. Describir los parámetros de una antena y el papel del plano de masa y del balun.  
O7. Calcular el balance de un enlace de radio y diagnosticar la pérdida de sensibilidad de un receptor.  
R (224 palabras). A partir de cierta frecuencia un cable deja de ser un nudo de potencial único y la señal viaja como una onda que se refleja en cada discontinuidad. El capítulo da las herramientas de la radiofrecuencia empezando por la longitud crítica y la impedancia característica. Las líneas de transmisión, el coeficiente de reflexión y la relación de onda estacionaria explican las tres formas de terminar una línea digital y el comportamiento del coaxial. En radiofrecuencia no se miden tensiones sino ondas, y los parámetros S, medidos en 50 Ω, caracterizan cualquier bloque; la carta de Smith sustituye cálculos por movimientos sobre un plano de reflexiones. Las redes de adaptación transforman impedancias sin disipar, con un Q que fija el ancho de banda, y por encima de unos cientos de megahercios los filtros se trazan en cobre con stubs y líneas acopladas. Los bloques de RF se organizan en una cadena con su presupuesto y su margen dinámico, y las antenas se entienden como adaptadores de impedancia en los que el plano de masa y el entorno forman parte del diseño. Con todo ello se revisa el front-end del FM7303, y la intermodulación y el punto de intercepción dan la linealidad del receptor. El diagnóstico de un receptor que recibe poco y el balance de un enlace, con la zona de Fresnel, cierran el capítulo.  
G. Comunicaciones · Física — TE10, FB2, TE6  
L. [G] Chris Bowick, «RF Circuit Design», Newnes, 2.ª ed., 2008. [S] David M. Pozar, «Microwave Engineering», Wiley, 4.ª ed., 2012. [G] Wes Hayward, Rick Campbell y Bob Larkin, «Experimental Methods in RF Design», ARRL, 2003.  

### Tomo VI

**Cap. 36 — Lógica Programable: CPLD, FPGA y HDL** (`cap37`)  
O1. Explicar en qué se diferencia el hardware configurable de un procesador que ejecuta instrucciones.  
O2. Comparar CPLD y FPGA y describir la estructura interna de una FPGA (LUT, flip-flops, interconexión, bloques especializados).  
O3. Describir hardware en VHDL y Verilog con estilo síncrono y verificarlo con un banco de pruebas.  
O4. Seguir el flujo de diseño de una FPGA con sus restricciones, simulación, depuración e informes.  
O5. Cerrar tiempos con el análisis de slack y resolver el cruce de dominios de reloj.  
O6. Implementar bloques de DSP en hardware, como filtros FIR y CORDIC, e integrar un procesador RISC-V.  
O7. Decidir entre FPGA, microcontrolador y ASIC con criterios técnicos y económicos.  
R (231 palabras). La lógica programable resuelve los problemas en los que la secuencialidad de un microcontrolador es un cuello de botella: un chip cuya función no se programa con instrucciones, sino describiendo el circuito que se quiere que sea. El capítulo empieza por ese cambio mental y por el coste real de la tecnología, compara CPLD y FPGA por su arquitectura y abre una FPGA: tablas de consulta, flip-flops, una interconexión que es lo que de verdad cuesta, bloques especializados y la configuración. Describir hardware no es programar: VHDL y Verilog son concurrentes, distinguen lo combinacional de lo secuencial y se escriben en estilo síncrono, y el divisor de frecuencia y un módulo completo con su banco de pruebas, que es el verdadero trabajo, lo muestran. El flujo de diseño tiene siete etapas, con restricciones tan importantes como el código. La comparación con el microcontrolador concluye que a menudo la respuesta son los dos. Una SDR en FPGA, con el CORDIC y el filtro FIR implementados, la recreación de sistemas digitales antiguos y el caso de una consola de 8 bits llevan los conceptos a proyectos completos. Los ASIC, con su punto de equilibrio económico y su verificación, y un caso real con treinta años de distancia, comparan fabricar silicio con configurarlo. Un procesador RISC-V dentro de la FPGA, el cierre de tiempos y el cruce de dominios de reloj completan el capítulo.  
G. Sistemas Electrónicos Digitales y Microprocesadores · Electrónica Digital — TE3, TE6, TE7  
L. [G] Pong P. Chu, «FPGA Prototyping by VHDL Examples», Wiley. [S] David Money Harris y Sarah L. Harris, «Digital Design and Computer Architecture», Morgan Kaufmann, 2.ª ed., 2012.  

**Cap. 37 — Sistemas Embebidos en Profundidad** (`cap38`)  
O1. Identificar lo que distingue a un sistema empotrado y la diferencia entre tiempo real duro y blando.  
O2. Describir la anatomía de un microcontrolador y su arquitectura de memoria, y programarlo en bare-metal sobre sus registros.  
O3. Atender interrupciones controlando la latencia, las prioridades y las variables compartidas.  
O4. Usar temporizadores, captura, PWM y DMA para tareas con exigencias temporales y de caudal.  
O5. Diseñar el perfil de consumo con los modos de bajo consumo, y configurar el reloj del sistema y el watchdog.  
O6. Elegir la arquitectura del firmware (superbucle, cooperativo o RTOS) y aplicar semáforos, mutex y prioridades sin inversión de prioridad.  
O7. Depurar con herramientas hardware y diseñar el arranque seguro y la actualización del firmware.  
R (230 palabras). Los capítulos de Arduino y Raspberry Pi usaron los microcontroladores como herramientas; este abre la caja. Un sistema empotrado es un computador especializado dentro de un producto, que responde al mundo físico en tiempo real con poca memoria y poca energía, y el coste de un fallo justifica su disciplina. El capítulo describe la anatomía de un microcontrolador y enseña a programarlo atacando los registros, con la secuencia de arranque que nadie ve y la habilitación del reloj de cada periférico. Las interrupciones atienden al mundo sin esperarlo, a cambio de una latencia que se descompone y de un problema real: las variables compartidas. Los temporizadores, con sus modos, la captura y el PWM, son el periférico más útil, y el DMA mueve datos sin gastar el procesador. En un sistema a batería manda el consumo medio, que se diseña con los modos de bajo consumo y vigilando las fugas; el reloj del sistema, el watchdog y la supervisión de alimentación aseguran la fiabilidad. La arquitectura del firmware, del superbucle al sistema operativo de tiempo real, decide si un proyecto puede crecer; la planificación por prioridades, los semáforos, los mutex y la inversión de prioridad se explican con nombres. La depuración dentro del chip, el arranque seguro con firma y doble banco, el mapa de memoria con pila y enlazador, y una ampliación sobre arquitectura de computadores cierran el capítulo.  
G. Sistemas Electrónicos Digitales y Microprocesadores · Informática Industrial · Informática — TE3, TE10, FB3  
L. [G] Jack Ganssle, «The Art of Designing Embedded Systems», Newnes, 2.ª ed., 2008. [G] Michael Barr y Anthony Massa, «Programming Embedded Systems», O'Reilly, 2.ª ed., 2006. [S] David Money Harris y Sarah L. Harris, «Digital Design and Computer Architecture», Morgan Kaufmann, 2.ª ed., 2012.  

**Cap. 38 — Baterías y Gestión de Energía** (`cap39`)  
O1. Elaborar el presupuesto energético de un equipo y valorar la recolección de energía.  
O2. Comparar las químicas primarias y secundarias por su tensión, energía, vida y curva de descarga.  
O3. Interpretar los parámetros de una batería, incluidas la capacidad, la resistencia interna y la vida.  
O4. Describir la carga CC-CV del Li-ion y las funciones de un sistema de gestión de batería con equilibrado.  
O5. Diseñar la alimentación de sistemas con varias fuentes y con USB-C Power Delivery.  
O6. Aplicar las reglas de envejecimiento, manipulación, transporte y reciclaje de las baterías de litio.  
R (225 palabras). En cuanto un equipo se mueve, la batería pasa a definir su autonomía, su tamaño, su peso, su coste y, a menudo, su seguridad. El capítulo trata la energía como restricción de diseño: el presupuesto energético, lo que aporta cada tecnología y los tres errores del cálculo. Las químicas primarias y secundarias se comparan por tensión, densidad de energía y vida, y la curva de descarga decide el circuito. La hoja de datos de una batería se lee con atención a la capacidad, a un efecto que sorprende, a la resistencia interna y a las tensiones que hay que respetar. La recolección de energía hace posible un sensor que funciona durante años: fuentes y números, la célula solar, el arranque en frío y la gestión del ciclo de trabajo. El litio no se carga como las demás químicas: el perfil CC-CV tiene fases y números que hay que respetar, con un compromiso entre capacidad y vida, y un estado de carga difícil de estimar. El sistema de gestión de batería vigila permanentemente la celda con cinco protecciones y el equilibrado, pasivo o activo. La alimentación desde varias fuentes, la negociación de USB-C Power Delivery, el envejecimiento por dos caminos que se suman y la seguridad en la manipulación, el almacenamiento, el transporte y el reciclaje cierran el capítulo con tres problemas de dimensionado y elección.  
G. Electrónica de Potencia · Diseño de Sistemas Electrónicos — TE4, TE6, CR10  
L. [S] Thomas B. Reddy (ed.), «Linden's Handbook of Batteries», McGraw-Hill, 4.ª ed., 2011. [G] Robert Erickson y Dragan Maksimović, «Fundamentals of Power Electronics», Springer, 3.ª ed., 2020.  

**Cap. 39 — Diseño Avanzado de Circuito Impreso** (`cap40`)  
O1. Explicar por qué la placa forma parte del circuito y los parámetros de fabricación que lo condicionan.  
O2. Elegir el apilado de capas y la impedancia de las pistas.  
O3. Dimensionar pistas y vías por corriente, caída de tensión, inductancia y temperatura según IPC-2221.  
O4. Diseñar planos de masa y de alimentación y colocar el desacoplo para minimizar el área de los bucles.  
O5. Diseñar la evacuación térmica a través del cobre de la placa.  
O6. Colocar y particionar los componentes antes de trazar.  
O7. Preparar la fabricación con Gerbers, comprobación de reglas, clases IPC, fiduciales y paneles.  
R (231 palabras). Una placa de circuito impreso no es un soporte: es un componente más, con resistencia, capacidad e inductancia repartidas que pueden hacer fracasar un circuito correcto sobre el papel. El capítulo parte de cómo se fabrica una placa y de las decisiones que se toman antes de trazar nada. El apilado de capas fija la impedancia de las pistas y la calidad de los retornos, con tres reglas que ordenan cualquier apilado y el diálogo con el fabricante. La anchura de una pista responde a dos preguntas distintas que se confunden, la ampacidad, resuelta por la norma IPC-2221, y la caída de tensión; las vías son inductancia antes que agujeros, y conducen corriente y calor. El plano de masa no es un cable ancho, sino la forma de minimizar el área del bucle, y una ranura bajo una señal lo destruye; el desacoplo solo sirve si está en el sitio correcto, con varios valores y el plano como parte de él. La placa es también el disipador de los componentes de montaje superficial. La fabricación se prepara con los Gerbers, las clases de IPC-6012, los acabados y la comprobación de reglas de diseño. La colocación decide la mayor parte del resultado, y el particionado, los fiduciales, los paneles y la preparación para producción completan el paso del prototipo a la serie, con un resumen de herramientas y errores que conviene evitar.  
G. Diseño de Sistemas Electrónicos · Tecnología Electrónica · Expresión Gráfica — TE6, FB5, CR9  
L. [G] Douglas Brooks, «PCB Currents: How They Flow, How They React», Prentice Hall, 2013. [S] Clyde F. Coombs y Happy T. Holden (eds.), «Printed Circuits Handbook», McGraw-Hill, 7.ª ed., 2016. [G] IPC, «IPC-2221 / IPC-A-610», IPC.  
Normas extraídas: IPC-2221 (39.3, 39.11); IPC-2581 (39.8); IPC-6012 (39.8)  

**Cap. 40 — Integridad de Señal y de Alimentación** (`cap41`)  
O1. Determinar cuándo una pista deja de comportarse como un cable a partir del tiempo de flanco.  
O2. Diseñar pistas de impedancia controlada en microstrip, stripline y pares diferenciales.  
O3. Elegir la terminación adecuada contra las reflexiones.  
O4. Reducir la diafonía cercana y lejana entre pistas.  
O5. Interpretar el diagrama de ojo, el jitter y la ecualización de un enlace digital.  
O6. Diseñar la red de distribución de alimentación con un objetivo de impedancia y prevenir el rebote de masa.  
R (221 palabras). Cuando las señales son rápidas, las pistas se comportan como líneas de transmisión y aparecen reflexiones, diafonía y jitter que corrompen los datos aunque el esquema sea correcto; a la vez, la red de alimentación debe sostener la tensión mientras muchas salidas conmutan. El capítulo trata estas dos disciplinas, la integridad de señal y la de alimentación, a partir de una idea: lo decide el flanco, no la frecuencia. La impedancia controlada convierte la anchura de la pista en un parámetro eléctrico, en microstrip, stripline y líneas diferenciales. Las reflexiones se ven en la pantalla y se resuelven con tres terminaciones, a menudo con una simple resistencia serie, o reduciendo el flanco. La diafonía es acoplamiento entre bucles vecinos, cercana o lejana, y se reduce separando las pistas y dándoles retorno propio. El diagrama de ojo resume miles de bits en una pantalla: se lee, se compara con una máscara y se abre con ecualización. La red de distribución de alimentación debe presentar baja impedancia en todo el margen de frecuencias, con un objetivo de impedancia, condensadores para cada banda y cuidado con las antirresonancias. El rebote de masa y el ruido de conmutación simultánea, las pérdidas a alta velocidad y los pares diferenciales con su encaminamiento acoplado completan el capítulo, que insiste en pensar en bucles y no en pistas.  
G. Diseño de Sistemas Electrónicos · Comunicaciones — TE6, TE10, FB2  
L. [G] Howard Johnson y Martin Graham, «High-Speed Digital Design: A Handbook of Black Magic», Prentice Hall, 1993. [G] Eric Bogatin, «Signal and Power Integrity — Simplified», Prentice Hall, 3.ª ed., 2018. [G] Douglas Brooks, «PCB Currents: How They Flow, How They React», Prentice Hall, 2013.  
Normas extraídas: RS-485 (40.9)  

**Cap. 41 — Simulación de Circuitos con SPICE** (`cap42`)  
O1. Explicar qué resuelve un simulador SPICE y qué no puede predecir.  
O2. Elegir el tipo de análisis (punto de trabajo, barrido de continua, alterna, transitorio) según la pregunta.  
O3. Escribir y leer un netlist con subcircuitos y elegir modelos de componentes adecuados.  
O4. Evaluar tolerancias con análisis de peor caso y de Monte Carlo, y explorar el diseño con barridos paramétricos.  
O5. Resolver problemas de convergencia con los remedios en orden.  
O6. Incluir los parásitos de la placa en una simulación post-layout.  
R (216 palabras). SPICE es el simulador estándar de la electrónica analógica: resuelve numéricamente las ecuaciones del circuito y predice tensiones, corrientes, respuesta en frecuencia, ruido y comportamiento en el tiempo. No sustituye a la medida, pero permite explorar ideas y entender fallos sin gastar una pieza. El capítulo explica primero para qué sirve simular y lo que simular no es. Cuatro preguntas dan lugar a cuatro análisis, punto de trabajo, barrido de continua, alterna y transitorio, más otros complementarios, y elegir mal es un error frecuente. Un simulador no sabe de un componente más que lo que dice su modelo, y hay tres niveles de modelo, con el MOSFET como caso ilustrativo; el netlist, que es lo que el simulador lee de verdad, se aprende a escribir y a leer. Simular con valores nominales es simular un circuito que no existe: el peor caso da la garantía absoluta y Monte Carlo la respuesta realista, con una distribución supuesta que importa. Los problemas de convergencia tienen causas habituales y remedios en orden. El capítulo insiste en lo que SPICE no puede hacer, porque simular no es saber, y en la simulación post-layout, que incluye los parásitos de la placa. El barrido paramétrico explora el espacio de diseño, y un resumen de herramientas y fuentes de modelos cierra el capítulo.  
G. Modelado y Simulación de Sistemas · Teoría de Circuitos · Electrónica Analógica — TE7, TE6, FB3  
L. [S] Andrei Vladimirescu, «The SPICE Book», Wiley, 1994. [G] Ron Kielkowski, «Inside SPICE», McGraw-Hill, 2.ª ed., 1998.  

**Cap. 42 — Amplificadores con Transistores Discretos** (`cap43`)  
O1. Justificar el uso de transistores discretos frente a los integrados en los casos en que siguen siendo necesarios.  
O2. Polarizar un transistor con estabilidad frente a la dispersión de β y a la temperatura.  
O3. Analizar las configuraciones de emisor común, colector común y base común con el modelo híbrido en π.  
O4. Calcular la respuesta en frecuencia de una etapa y vencer el efecto Miller.  
O5. Diseñar etapas múltiples y pares diferenciales con carga activa.  
O6. Comparar las clases de etapas de salida (A, B, AB, C, D) por rendimiento y distorsión, y minimizar el ruido de la primera etapa.  
R (227 palabras). El operacional resolvió la amplificación como bloque, pero diseñar etapas a medida en radiofrecuencia, potencia o bajo ruido exige volver al transistor individual. El capítulo empieza por los casos en que los discretos siguen siendo la respuesta, con una mirada a la válvula de vacío, y construye el amplificador desde el punto de trabajo: la corriente de reposo lo decide todo, la β no es de fiar y hay cuatro polarizaciones con distinta estabilidad térmica. Las tres configuraciones básicas, emisor común, colector común y base común, se comparan en una tabla, con su equivalente en MOSFET y la forma de reconocerlas en un esquema. El análisis en pequeña señal separa el reposo del movimiento con el modelo híbrido en π y muestra el efecto de la resistencia de emisor. La ganancia se paga con ancho de banda, y en el emisor común manda el efecto Miller, que se vence de tres formas. Las etapas en cascada, su acoplamiento, el par diferencial, el CMRR y la carga activa explican lo que hay dentro de los integrados. Las clases de salida se presentan como puntos de trabajo, de la A a la D, con sus rendimientos máximos deducidos y la sorpresa de que la clase B calienta más a volumen medio. La llave analógica, el ruido del amplificador discreto y una ampliación sobre la clase D cierran el capítulo.  
G. Electrónica Analógica · Fundamentos de Electrónica — TE2, TE6, CR5  
L. [G] Adel Sedra y Kenneth Smith, «Microelectronic Circuits», Oxford University Press. [G] Douglas Self, «Audio Power Amplifier Design», Focal Press, 6.ª ed., 2013. [G] Bob Cordell, «Designing Audio Power Amplifiers», Routledge, 2.ª ed., 2019.  

### Tomo VII

**Cap. 43 — Buses y Protocolos de Comunicación** (`cap44`)  
O1. Clasificar cualquier bus por cuatro elecciones: serie o paralelo, síncrono o asíncrono, uno o varios maestros, referido a masa o diferencial.  
O2. Describir el funcionamiento, los niveles y los errores de UART, SPI e I²C, y dimensionar las resistencias de pull-up de I²C.  
O3. Explicar el arbitraje y los mecanismos de robustez de CAN y la arquitectura host-dispositivo de USB.  
O4. Elegir el bus adecuado para una aplicación, incluidos 1-Wire, I²S y los enlaces de radio, y diagnosticarlo en orden.  
O5. Aislar galvánicamente un bus con optoacopladores, aisladores digitales o transformadores, incluida su alimentación.  
O6. Determinar los límites de longitud y la terminación de un bus, y valorar la fibra óptica.  
R (231 palabras). Un sistema moderno es una conversación entre chips que sigue protocolos con sus reglas, sus virtudes y sus límites, y el capítulo enseña a elegir el bus adecuado y a diagnosticarlo con el osciloscopio o el analizador lógico. Empieza por el mapa: cuatro preguntas clasifican cualquier bus, y el caudal real lo limitan otros factores. La UART envía bytes sin reloj compartido, con niveles que son tres cosas distintas y control de flujo; SPI es el síncrono más simple, con modos que causan casi todos sus problemas; I²C comparte dos hilos en drenador abierto, y sus resistencias de pull-up, que es lo que más se hace mal, se dimensionan entre dos límites opuestos que a veces dejan la ventana vacía. CAN nació para el ruido del automóvil, con arbitraje no destructivo y orientación a mensajes, y USB es distinto de todos por su asimetría host-dispositivo, la enumeración y las clases. 1-Wire, I²S y otros buses de nicho completan el repertorio, y la elección se reduce a cuatro preguntas encadenadas, con un diagnóstico en orden y un apartado sobre los enlaces de radio BLE, Zigbee, LoRa y RFID. El aislamiento galvánico, con optoacopladores, aisladores digitales o transformadores, sin olvidar la alimentación del otro lado, y la terminación y la longitud como límites físicos de cualquier bus cierran el capítulo, con una ampliación sobre fibra óptica y un enlace RS-485 de 100 metros.  
G. Informática Industrial · Sistemas Electrónicos Digitales y Microprocesadores · Comunicaciones — TE10, TE3  
L. [S] Jan Axelson, «USB Complete», Lakeview Research, 5.ª ed., 2015. [G] Michael Barr y Anthony Massa, «Programming Embedded Systems», O'Reilly, 2.ª ed., 2006.  
Normas extraídas: RS-485 (43.1, 43.2, 43.6, 43.7, 43.8, 43.9, 43.10, 43.B, 43.C); RS-232 (43.2, 43.7); IEEE 802.15.4 (43.8)  

**Cap. 44 — Optoelectrónica y Displays** (`cap45`)  
O1. Explicar la emisión y la detección de luz en los semiconductores.  
O2. Polarizar LED con resistencia o driver de corriente constante, regular su brillo por PWM y prever su comportamiento térmico.  
O3. Elegir entre fotodiodo, fototransistor y LDR según la precisión y la velocidad necesarias.  
O4. Dimensionar optoacopladores teniendo en cuenta el CTR, su envejecimiento y el rechazo de modo común transitorio.  
O5. Comparar las tecnologías de display y multiplexarlas, incluidos los LED direccionables y su alimentación.  
O6. Describir la comunicación óptica, el diodo láser con su control de potencia y su seguridad, y los sensores de imagen CCD y CMOS.  
R (210 palabras). La electrónica también ve y emite luz, y el capítulo aplica la física del semiconductor a los dispositivos que convierten electricidad en luz y viceversa. Ambos sentidos se explican por lo mismo. Un LED se alimenta con corriente, no con tensión: la resistencia en serie solo funciona si deja caer una fracción apreciable de la alimentación, el driver de corriente constante resuelve el resto, el brillo se regula por PWM porque bajar la corriente cambia el color y la temperatura decide la vida. Los tres detectores, fotodiodo, fototransistor y LDR, son tres compromisos distintos, y la luz ambiente se combate modulando la fuente. El optoacoplador aísla con luz, con un CTR que envejece y un rechazo de modo común transitorio, y los aisladores digitales lo están reemplazando. Los displays se eligen por el problema, no por el tamaño: siete segmentos, LCD de caracteres o gráfico, OLED y e-ink. El multiplexado ahorra pines a cambio de corriente de pico, y los LED direccionables invierten el planteamiento, con la alimentación como problema real. La comunicación por luz, en fibra y en espacio libre, el láser, cuyo umbral lo cambia todo y cuya seguridad es real, y los sensores de imagen CCD y CMOS, con el obturador y el color, cierran el capítulo.  
G. Fundamentos de Electrónica · Instrumentación Electrónica · Tecnología Electrónica — CR5, TE2, TE5  
L. [S] E. Fred Schubert, «Light-Emitting Diodes», Cambridge University Press, 2.ª ed., 2006. [G] Paul Horowitz y Winfield Hill, «The Art of Electronics», Cambridge University Press, 3.ª ed., 2015.  
Normas extraídas: RoHS (44.3)  

**Cap. 45 — Fiabilidad y Diseño para Fabricación (DFM)** (`cap46`)  
O1. Definir la fiabilidad y sus métricas (tasa de fallos, FIT, MTBF, curva de bañera) e interpretarlas sin trampas.  
O2. Identificar los mecanismos de fallo térmicos, electroquímicos, mecánicos y eléctricos.  
O3. Aplicar el derating y la ley de Arrhenius para estimar la vida de un componente.  
O4. Diseñar para fabricación y para test, y analizar tolerancias por peor caso y estadísticamente.  
O5. Gestionar normas, trazabilidad, obsolescencia, componentes falsificados y erratas del silicio.  
O6. Aplicar redundancia, FMEA, ensayos acelerados HALT y HASS y criterios de mantenibilidad (MTTR).  
R (221 palabras). Que un prototipo funcione en la mesa es solo el principio: un buen diseño debe funcionar en miles de unidades, fabricarse sin sobresaltos y durar años en condiciones reales. El capítulo define la fiabilidad como una probabilidad, con sus métricas, sus trampas y la curva de bañera, y deja claro que un MTBF es una tasa y no una vida útil. Los mecanismos de fallo se agrupan en térmicos, electroquímicos, mecánicos y eléctricos, con tres modos de aparición. Un componente falla porque trabaja cerca de su límite: el derating, con sus cifras habituales y sus estándares, y la ley de Arrhenius, que relaciona la temperatura con la vida, convierten esa idea en números, con la fatiga de las soldaduras como excepción. El diseño para fabricación reduce la variedad, facilita el montaje y documenta bien, y el diseño para test asegura que una placa se pueda probar. Las tolerancias se analizan por peor caso y estadísticamente. Las normas, la trazabilidad y la obsolescencia hacen mantenible un producto; los componentes falsificados se detectan con lo que hay en el banco, y la errata del silicio es el documento más valioso y menos leído. La redundancia, el FMEA, los ensayos HALT y HASS y la mantenibilidad completan el capítulo, ilustrado con cuatro fallos célebres y la plaga de condensadores como caso de estudio completo.  
G. Tecnología Electrónica · Diseño de Sistemas Electrónicos · Proyectos — TE6, CR9, FB1  
L. [G] Patrick O'Connor y Andre Kleyner, «Practical Reliability Engineering», Wiley, 5.ª ed., 2012.  
Normas extraídas: MIL-STD-975 (45.3); MIL-HDBK-217 (45.4); RoHS (45.8); REACH (45.8)  

**Cap. 46 — Instrumentación, Gestión Térmica y Seguridad** (`cap47`)  
O1. Elegir los instrumentos de un banco de electrónica y medir sin falsear la medida.  
O2. Distinguir exactitud de resolución y calcular la incertidumbre combinada, el TUR y la trazabilidad de una calibración.  
O3. Modelar la transmisión de calor como una cadena de resistencias térmicas, incluida la impedancia térmica transitoria.  
O4. Dimensionar disipadores y elegir refrigeración activa con ventiladores o células Peltier.  
O5. Aplicar las reglas de seguridad eléctrica y de laboratorio, las clases de protección, las distancias de aislamiento, las categorías de sobretensión y el código IP.  
R (231 palabras). El capítulo cierra la parte de diseño con tres disciplinas transversales: medir bien, evacuar el calor y trabajar seguro. Empieza por los instrumentos de un banco, qué aporta cada uno y en qué orden conviene adquirirlos, y reúne una idea que atraviesa el libro: el instrumento forma parte del circuito, con cuatro formas de falsear una medida, la regla del ancho de banda, la medida de corriente y las medidas flotantes. La exactitud no es la resolución: la incertidumbre se especifica, se combina en cuadratura, exige un patrón varias veces mejor y una cadena de trazabilidad, y calibrar no es lo mismo que ajustar ni que verificar. La transmisión de calor por conducción sigue una ecuación idéntica a la ley de Ohm, de modo que un problema térmico se resuelve como un circuito de resistencias, con el material de interfaz como factor decisivo y la impedancia térmica transitoria para los pulsos de potencia. El disipador se dimensiona invirtiendo ese cálculo, y la refrigeración activa con ventiladores o células Peltier se elige con una tabla. La seguridad eléctrica parte de que daña la corriente y no la tensión: el diferencial protege a las personas, y las clases de protección, el doble aislamiento, las distancias, las categorías de sobretensión de la IEC 61010 y el código IP de la IEC 60529 organizan la protección. Ampliaciones sobre convección, radiación y calibración completan el capítulo.  
G. Instrumentación Electrónica · Tecnología Electrónica — TE5, CR1, TE6  
L. [S] Miguel A. Pérez García y otros, «Instrumentación electrónica», Thomson, 2004. [G] Paul Horowitz y Winfield Hill, «The Art of Electronics», Cambridge University Press, 3.ª ed., 2015.  
Normas extraídas: IEC 61010 (46.10); IEC 60529 (46.10)  

**Cap. 47 — Proyectos de Integración: Cuatro Diseños Completos** (`cap48`)  
O1. Relacionar cada uno de los cuatro proyectos detallados con los capítulos del libro que integra.  
O2. Aplicar un método por etapas a un proyecto propio, de la especificación con números a la validación.  
O3. Elaborar los presupuestos de potencia, de error y de tiempo antes de dibujar el esquema.  
O4. Documentar y compartir un proyecto con control de versiones.  
R (223 palabras). El capítulo introduce los cuatro proyectos completos que siguen: una estación de medida ambiental conectada, una fuente de alimentación de laboratorio, un amplificador de audio de alta fidelidad y una radio definida por software. Todos siguen el mismo método, de la especificación a las medidas, y una tabla de cobertura muestra qué parte del libro integra cada uno. Su núcleo es el método para abordar un proyecto propio, que empieza por evitar el error de abrir el programa de esquemas: primero la especificación con números, después el diagrama de bloques, la elección de los componentes clave, el esquema, el prototipo y, por último, la placa, el montaje y la validación, con los errores que más veces arruinan un proyecto y un presupuesto de tiempo. El paso más difícil es el primero, y el capítulo insiste en una línea que suele faltar: la exactitud, que no es lo mismo que la regulación. Tres presupuestos conviene hacerlos siempre antes de dibujar nada: el de potencia, el de error, con la suma en cuadratura y la regla de que lo que está tres veces por debajo del término dominante apenas cuenta, y el de tiempo, con el camino crítico y los márgenes. La documentación, mínima e imprescindible, con control de versiones, y el paso de un diagrama de bloques a un diseño completo cierran el capítulo.  
G. Proyectos · Diseño de Sistemas Electrónicos · Trabajo Fin de Grado — TE6, CR12  
L. [G] Paul Horowitz y Winfield Hill, «The Art of Electronics», Cambridge University Press, 3.ª ed., 2015.  

**Cap. 48 — Proyecto Detallado I: Estación de Medida Ambiental IoT** (`cap49`)  
O1. Redactar la especificación con números de una estación de medida ambiental y derivar de ella la arquitectura.  
O2. Elegir y montar sensores digitales y un micrófono analógico con su acondicionamiento y su detector de nivel.  
O3. Diseñar el esquema completo con un ESP32 respetando sus restricciones de pines y su consumo.  
O4. Dimensionar el bus I²C y el presupuesto de alimentación y de corriente.  
O5. Estructurar el firmware por ritmos y capas y enviar los datos a la nube con MQTT.  
O6. Montar, calibrar, validar y proteger el dispositivo frente a ataques.  
R (222 palabras). El primero de los proyectos detallados es una estación que mide el clima, la luz, el sonido y el movimiento de una estancia, lo muestra en una pantalla y lo envía a la nube. Se desarrolla de principio a fin, empezando por la especificación con números y el criterio de aceptación. La arquitectura sale de la restricción que domina el proyecto, el consumo, con un presupuesto por fases y un diagrama de tiempos. Los sensores se eligen con preferencia por los digitales, y su montaje, separado del calor del resto del circuito, decide la medida. El ESP32 aporta conectividad y recursos a cambio de restricciones de pines y de un consumo que decide la alimentación. El esquema completo se presenta como documento de trabajo, con anotaciones imprescindibles y comprobaciones previas, y el bus I²C se dimensiona para este caso. La medida del nivel sonoro con un micrófono de electret reúne acondicionamiento, conversión y procesado. La alimentación, el presupuesto de corriente y la lista de materiales, con criterios de compra por especificación, preceden al firmware, organizado en tres ritmos, capas y una máquina de estados. Los datos se envían por MQTT a un panel, con la marca de tiempo y la seguridad como requisitos. El montaje, la puesta a punto, la calibración, la seguridad del dispositivo conectado y cinco ampliaciones cierran el proyecto.  
G. Sistemas Electrónicos Digitales y Microprocesadores · Instrumentación Electrónica · Informática Industrial — TE3, TE5, TE10  
L. [G] Michael Barr y Anthony Massa, «Programming Embedded Systems», O'Reilly, 2.ª ed., 2006. [S] Ramón Pallás Areny, «Sensores y acondicionadores de señal», Marcombo, 4.ª ed., 2003.  
Normas extraídas: RS-485 (48.3)  

**Cap. 49 — Proyecto Detallado II: Fuente de Alimentación de Laboratorio** (`cap50`)  
O1. Especificar una fuente de alimentación de laboratorio y elegir su arquitectura con prerregulador y regulador lineal.  
O2. Aplicar las reglas de seguridad para trabajar con la red: zonas, barrera de aislamiento, primario y tierra de protección.  
O3. Dimensionar el transformador, el rectificador y el condensador de filtro.  
O4. Diseñar el lazo de regulación de tensión y el límite de corriente con su estabilidad.  
O5. Calcular la disipación del elemento de paso, su área de operación segura y el disipador.  
O6. Medir la regulación de línea y de carga, el rizado y el ruido, y preparar la fabricación de la placa.  
R (237 palabras). El segundo proyecto es la herramienta que más se usa en un banco: una fuente de alimentación regulable con límite de corriente. Es electrónica lineal clásica y reúne el rectificador y el filtro, el operacional en lazo cerrado, los transistores de paso y su disipación, y la seguridad al trabajar con la red, por la que empieza el capítulo: dos zonas y la barrera entre ellas, lo que debe llevar el primario y la tierra de protección. La arquitectura resuelve tres problemas a la vez con un prerregulador y un regulador lineal, la transición entre modos y la descarga de la salida. De la red a la continua, el transformador, el rectificador y el condensador de filtro condicionan todo lo demás. La fuente es un lazo de control cuya estabilidad es el problema; el límite de corriente, con su doble lazo, la convierte en instrumento. La disipación es el talón de Aquiles del lineal: el caso peor, el área de operación segura y el disipador se calculan con números, reunidos y comprobados frente a la especificación. La lista de materiales, el montaje por bloques, los ajustes y las pruebas de esfuerzo preceden a la medida de las especificaciones que definen una fuente: la regulación de línea y de carga, el sensado remoto, el rizado y el ruido. Las ampliaciones, un proyecto ampliado con los cálculos revisados y la documentación de fabricación de la placa cierran el capítulo.  
G. Electrónica de Potencia · Electrónica Analógica · Regulación Automática — TE4, TE6, TE8  
L. [G] Marty Brown, «Power Supply Cookbook», Newnes, 2.ª ed., 2001. [G] Paul Horowitz y Winfield Hill, «The Art of Electronics», Cambridge University Press, 3.ª ed., 2015.  

### Tomo VIII

**Cap. 50 — Proyecto Detallado III: Amplificador de Audio Hi-Fi** (`cap51`)  
O1. Especificar un amplificador de audio con números y organizarlo como una cadena de cinco bloques.  
O2. Diseñar el preamplificador con control de volumen y control de tono Baxandall atendiendo al ruido.  
O3. Diseñar una etapa de potencia en clase AB con sus resistencias de emisor y sus protecciones.  
O4. Eliminar la distorsión de cruce con un circuito de bias basado en el multiplicador de VBE y ajustarlo.  
O5. Calcular la potencia, la disipación máxima, la alimentación y el diseño térmico del amplificador.  
O6. Medir la fidelidad (respuesta, distorsión, ruido) y diagnosticar cuellos térmicos, zumbidos y ruido de fondo.  
R (227 palabras). El tercer proyecto es el clásico analógico por excelencia: un amplificador que convierte una señal débil en la potencia capaz de mover un altavoz, con fidelidad. Diseñarlo enseña a pensar por etapas y reúne el operacional y la realimentación, los filtros, los transistores, la potencia y la disipación. La especificación con números decide su tamaño, su calor y su coste, y la cadena de cinco bloques explica por qué cada uno está donde está. El preamplificador decide buena parte del ruido y lleva el control de volumen, con su trampa, y el control de tono Baxandall. La etapa de potencia en clase AB, con el seguidor complementario, la configuración Darlington y las resistencias de emisor, entrega la corriente al altavoz con las protecciones imprescindibles. La distorsión de cruce es el defecto que la realimentación no arregla del todo, y el multiplicador de VBE fija el bias con un compromiso que se ajusta en el banco. La fidelidad se descompone en cuatro parámetros medibles, con un debate sobre la realimentación tratado con honestidad. Tres cálculos encadenados dan la potencia, la disipación, cuyo máximo no está a plena potencia, y la alimentación. La lista de materiales, el montaje y la puesta a punto, el diagnóstico fino del calor y del zumbido, la interacción con el altavoz y los límites del instrumental doméstico para medir distorsiones pequeñas cierran el proyecto.  
G. Electrónica Analógica · Electrónica de Potencia · Instrumentación Electrónica — TE2, TE6, TE5  
L. [G] Douglas Self, «Audio Power Amplifier Design», Focal Press, 6.ª ed., 2013. [G] Bob Cordell, «Designing Audio Power Amplifiers», Routledge, 2.ª ed., 2019.  

**Cap. 51 — Proyecto Detallado IV: Radio Definida por Software (SDR)** (`cap52`)  
O1. Especificar un receptor SDR y decidir dónde se sitúa la frontera entre lo analógico y lo digital.  
O2. Aplicar el teorema de muestreo y el muestreo en cuadratura I/Q, y corregir el desequilibrio entre canales.  
O3. Diseñar el front-end bloque a bloque, con su presupuesto de ruido y su rechazo de imagen.  
O4. Describir la cadena de procesado digital, la demodulación y su carga computacional.  
O5. Interpretar el espectro y la cascada (waterfall) como herramientas de diagnóstico.  
O6. Comparar la SDR con el receptor FM7303 y montar un receptor utilizable con su antena y su filtrado.  
R (228 palabras). El último proyecto detallado cierra un círculo que empezó con el FM7303: aquella era una radio hecha de hardware, y la radio definida por software hace lo mismo con muy poco hardware, un front-end, un mezclador en cuadratura y la tarjeta de sonido como conversor, y resuelve el resto con cálculo. El capítulo fija primero la especificación y la arquitectura. La conversión directa necesita dos canales, I y Q, porque una señal de radio tiene amplitud y fase y una sola muestra real pierde la fase; el teorema de Nyquist vuelve a ser la base, y el desequilibrio entre canales, el defecto que hay que corregir. El front-end se desarrolla bloque a bloque: atenuador y preselector, un detector de muestreo en cuadratura como mezclador, el oscilador local, la banda base y la alimentación, con un presupuesto de ruido que explica por qué no lleva amplificador de bajo ruido y el rechazo de imagen en números. A partir del par I/Q, todo es cálculo: las etapas de procesado, la demodulación de cada modo y su carga computacional. El espectro instantáneo y la cascada permiten ver la radio en lugar de oírla y usarla como instrumento. La comparación bloque a bloque con el FM7303 muestra lo que sigue siendo analógico. El montaje real con un receptor comercial, la antena y el ruido del ordenador, y cinco ampliaciones, cierran el capítulo.  
G. Comunicaciones · Señales y Sistemas · Electrónica Analógica — TE10, TE7, TE2  
L. [S] Travis F. Collins, Robin Getz, Di Pu y Alexander M. Wyglinski, «Software-Defined Radio for Engineers», Artech House, 2018. [G] Richard Lyons, «Understanding Digital Signal Processing», Pearson, 3.ª ed., 2011. [G] Chris Bowick, «RF Circuit Design», Newnes, 2.ª ed., 2008.  

**Cap. 52 — Diagnóstico y Reparación de Equipos** (`cap53`)  
O1. Aplicar el método de diagnóstico (síntoma, hipótesis, medida) con el principio de la causa única.  
O2. Trabajar con seguridad ante la red, las baterías de litio y la electricidad estática.  
O3. Inspeccionar y medir sin alimentar, y realizar el primer encendido con límite de corriente o lámpara serie.  
O4. Comprobar las alimentaciones y rastrear la señal por etapas con seguimiento, inyección y bisección.  
O5. Localizar cortocircuitos, puntos calientes y fallos intermitentes con el multímetro, el osciloscopio y la cámara térmica.  
O6. Confirmar las averías típicas de cada familia de componentes y de equipo antes de sustituir, y reparar la placa.  
O7. Documentar las reparaciones en un cuaderno de averías y entender el marco del ecodiseño y del derecho a reparar.  
R (225 palabras). Reparar electrónica es aplicar el método científico a un circuito averiado: observar el síntoma, formular una hipótesis, medir para confirmarla o descartarla y repetir hasta localizar el fallo. El capítulo reúne en ese método todo lo que el libro ha enseñado por separado, en un orden que va descartando hipótesis: seguridad antes de tocar nada; inspección sin alimentar, el paso que más averías resuelve por minuto; medidas sin tensión; primer encendido con límite de corriente o lámpara serie; las alimentaciones, primero siempre, y el rastreo por etapas con seguimiento, inyección y bisección. Dos secciones enseñan a sacar todo el partido del multímetro Brymen BM869s y del FNIRSI, y otras tratan la localización de cortocircuitos sin desoldar, la cámara térmica, los fallos intermitentes y sus cuatro causas dominantes, la medida de corriente con el osciloscopio y un trazador de curvas improvisado. Las averías típicas se confirman por familia de componentes y por tipo de equipo, con procedimientos específicos para fuentes de alimentación, sistemas con microcontrolador y amplificadores de audio, y un caso completo de principio a fin. La reparación misma, entender por qué falló, el cuaderno de averías, la reparación sin esquema y de la propia placa, los líquidos y la corrosión, los límites honestos del instrumental y el marco del ecodiseño y del derecho a reparar cierran el capítulo, con una tarjeta de referencia rápida.  
G. Instrumentación Electrónica · Tecnología Electrónica — TE5, TE6, CR10  
L. [S] Robert A. Pease, «Troubleshooting Analog Circuits», Butterworth-Heinemann, 1991. [G] Paul Horowitz y Winfield Hill, «The Art of Electronics», Cambridge University Press, 3.ª ed., 2015.  
Normas extraídas: EIA-96 (52.29); Directiva (UE) 2024/1799 (52.33)  

**Cap. 53 — Ingeniería Inversa de Hardware** (`cap54`)  
O1. Delimitar los fines, el encuadre legal y la ética de la ingeniería inversa de hardware.  
O2. Identificar los componentes de una placa desconocida por su marcado y por su comportamiento.  
O3. Levantar el esquema completo de una placa, incluidas las multicapa, con un método ordenado.  
O4. Deducir la función de un circuito por estímulo y respuesta y la arquitectura de bloques analógicos y de RF por sus formas de onda.  
O5. Descifrar protocolos digitales capturados y valorar la extracción y el análisis del firmware y el trazado del silicio.  
O6. Documentar y publicar los resultados de forma responsable.  
R (211 palabras). La ingeniería inversa es el diagnóstico llevado al extremo: entender un circuito del que nadie ha dado el esquema. El capítulo empieza por el encuadre legal y la ética, que van al principio y no al final: entender es legítimo, copiar no. Identificar los componentes de una placa desconocida exige leer el marcado o, cuando falta, deducir el componente por su comportamiento. Levantar el esquema es un trabajo mecánico y ordenado en seis pasos, de las alimentaciones a los bloques funcionales, la continuidad nodo a nodo y la comprobación de lo dibujado; en placas multicapa, donde las pistas no se ven, se deduce lo posible sin destruir y se reconstruye por comportamiento. El análisis funcional por estímulo y respuesta es a menudo más rápido: el mapa de conectores, el estado de reposo y el seguimiento de la señal. Los protocolos digitales se descifran identificando el bus, capturando bien, deduciendo el formato y la suma de comprobación y correlacionando con el comportamiento; los bloques analógicos y de RF se reconocen por sus frecuencias y su respuesta. El firmware puede extraerse y analizarse dentro de límites, y el trazado del silicio es el último recurso. Documentar, anotar la incertidumbre y publicar con responsabilidad, tres problemas resueltos y un último ejercicio cierran el libro.  
G. Diseño de Sistemas Electrónicos · Sistemas Electrónicos Digitales y Microprocesadores · Instrumentación Electrónica — TE6, TE3, TE5  
L. [S] Jasper van Woudenberg y Colin O'Flynn, «The Hardware Hacking Handbook», No Starch Press, 2021. [S] Andrew Huang, «Hacking the Xbox», No Starch Press, 2003.  
Normas extraídas: RS-485 (53.6)  

**Ap. A — Tablas de Códigos de Color de Resistencias** (`apA`)  
O1. Decodificar el valor y la tolerancia de una resistencia de cuatro o cinco bandas según la norma IEC 60062.  
O2. Asignar a cada color su cifra, su multiplicador, su tolerancia y su coeficiente de temperatura.  
O3. Seguir ejemplos de lectura resueltos de resistencias de cuatro y cinco bandas.  
O4. Leer los códigos numéricos de tres y cuatro dígitos de las resistencias SMD y la R como coma decimal.  
R (157 palabras). El apéndice reúne en tablas lo necesario para leer el valor de cualquier resistencia, según la norma IEC 60062. La tabla de bandas de color asigna a cada color su cifra, su multiplicador, su letra de tolerancia y su coeficiente de temperatura. Con cuatro bandas se leen dos cifras, el multiplicador y la tolerancia; con cinco, tres cifras; con seis, la última banda es el coeficiente de temperatura. La tabla sigue la edición de 2016 de la norma, que asignó nuevas tolerancias al amarillo y al gris y añadió el rosa como multiplicador. Una serie de ejemplos de lectura resueltos muestra el procedimiento completo. La última sección trata el marcado numérico de las resistencias de montaje superficial: el código de tres dígitos, el de cuatro y la letra R como coma decimal, con remisión a la sección 2.5 para el EIA-96 y las resistencias de cero ohmios. Es un apéndice de consulta que complementa el capítulo 2.  
G. Tecnología Electrónica — CR5  
Normas extraídas: IEC 60062 (A.2); EIA-96 (A.4)  

**Ap. B — Tablas de Equivalencia de Componentes** (`apB`)  
O1. Encontrar un sustituto para un transistor bipolar, un MOSFET de potencia, un regulador o un integrado común.  
O2. Comprobar que el equivalente cumple o supera las especificaciones de tensión, corriente y potencia del original.  
O3. Identificar el dato en que un equivalente queda por debajo del original.  
O4. Comparar MOSFET por su resistencia en conducción en las condiciones indicadas.  
R (99 palabras). Cuando no se dispone del componente original para una reparación, este apéndice ayuda a encontrar un sustituto adecuado, con una advertencia general: el equivalente debe cumplir o superar las especificaciones de tensión, corriente y potencia del original. Las tablas cubren cuatro familias. En los transistores bipolares se indica entre paréntesis el dato en que el equivalente queda por debajo del original, para que la sustitución sea consciente. Los MOSFET de potencia se comparan por su resistencia en conducción máxima con una tensión de puerta de 10 V. Siguen los reguladores de tensión y una selección de circuitos integrados comunes.  
G. Tecnología Electrónica — CR5, TE6  

**Ap. C — Tablas de Referencia Rápida** (`apC`)  
O1. Elegir el calibre de un cable por su designación AWG.  
O2. Usar los prefijos y las unidades del Sistema Internacional que aparecen en el libro.  
O3. Consultar los niveles lógicos de las familias digitales y las constantes físicas útiles.  
O4. Repasar de un vistazo las fórmulas esenciales del libro.  
R (134 palabras). El apéndice reúne tablas de consulta rápida que el lector necesitará una y otra vez. La primera da los calibres de cable según el sistema AWG, que indica el grosor del conductor. La segunda recoge los prefijos y las unidades del Sistema Internacional que aparecen en el libro, con su equivalencia y un valor de referencia. La tercera da los niveles lógicos de cada familia, con los umbrales de las familias CMOS clásicas en proporción a la alimentación. La cuarta reúne las constantes físicas útiles. La última es un resumen de las fórmulas esenciales: la ley de Ohm, la potencia, las asociaciones de resistencias, la constante de tiempo, las reactancias, la frecuencia de resonancia, el divisor de tensión, la ganancia del bipolar, la resistencia de un LED y la frecuencia del 555 en astable.  
G. Teoría de Circuitos · Física — CR4, FB2  
Normas extraídas: JESD8-7 (C.3)  

**Ap. D — Normas de Seguridad y Buenas Prácticas** (`apD`)  
O1. Aplicar las normas de seguridad eléctrica en el banco.  
O2. Proteger los componentes frente a las descargas electrostáticas.  
O3. Trabajar con seguridad al soldar y al manejar el FNIRSI 2C53T.  
O4. Gestionar los residuos electrónicos de acuerdo con su peligrosidad.  
R (138 palabras). El apéndice reúne las normas de seguridad y las buenas prácticas del libro en un solo lugar. Empieza por la seguridad eléctrica, la más importante para quien trabaja con equipos conectados a la red. Las reglas van del transformador de aislamiento y la descarga de los condensadores a la regla de una mano en el bolsillo. Sigue la protección contra las descargas electrostáticas, con muñequera, tapete y bolsas de apantallamiento, y la seguridad en la soldadura: ventilación con extractor de humos, la temperatura de la punta, el soporte del soldador y la higiene tras manipular plomo. Una sección específica trata el manejo seguro del FNIRSI 2C53T y sus límites. La última trata la gestión de los residuos: los componentes electrónicos contienen materiales que no deben desecharse con la basura común y que tienen su propio circuito de recogida.  
G. Instrumentación Electrónica · Tecnología Electrónica — CR10, TE5  
Normas extraídas: RAEE (D.5)  

**Ap. E — Fichas de los Integrados del FM7303** (`apE`)  
O1. Numerar las patillas de los encapsulados que usa el kit FM7303.  
O2. Identificar la función, el encapsulado, la alimentación y las equivalencias de cada integrado del receptor.  
O3. Relacionar cada integrado con su papel en la cadena del receptor.  
O4. Recurrir a la hoja de datos del fabricante cuando se necesite un dato exacto patilla por patilla.  
R (129 palabras). El apéndice reúne, en fichas de consulta rápida, los cinco circuitos integrados del receptor FM7303: el front-end de FM TA7358AP, el amplificador de FI TA7061BP, el TA7303P con amplificador de FI, detector, medida de intensidad de señal y silenciador, el decodificador estéreo PLL TA7343AP y el amplificador de potencia de audio estéreo TEA2025. Para cada uno se indican su función, su encapsulado, su alimentación, sus equivalencias y su papel concreto en la radio, y una figura muestra cómo se numeran las patillas en los dos encapsulados del kit. El apéndice advierte de que las funciones patilla por patilla varían entre fabricantes y versiones, por lo que conviene consultar la hoja de datos concreta, y se complementa con el apéndice B y con la anatomía por bloques del capítulo 15.  
G. Comunicaciones · Electrónica Analógica — TE2, TE10  

**Ap. F — Valores Normalizados y Encapsulados** (`apF`)  
O1. Explicar por qué los componentes se fabrican en series normalizadas de valores.  
O2. Usar las series E12 y E24 para elegir valores comerciales.  
O3. Identificar los tipos de encapsulado y su forma de montaje.  
O4. Relacionar el encapsulado con la técnica de soldadura que exige.  
R (78 palabras). Las resistencias, y muchos condensadores, no se fabrican en cualquier valor, sino en series normalizadas, y la primera parte del apéndice reproduce las series E12 y E24 para elegir valores comerciales. La segunda parte describe los tipos de encapsulado, la carcasa física de un componente, que determina cómo se monta y cómo se suelda, desde los de orificio pasante hasta los de montaje superficial. Es un apéndice de consulta que complementa los capítulos de componentes y de soldadura.  
G. Tecnología Electrónica — CR5  

**Ap. G — Bibliografía y Lecturas Recomendadas** (`apG`)  
O1. Localizar las fuentes directas del proyecto FM7303 y su linaje teórico.  
O2. Elegir referencias generales de electrónica para consolidar los fundamentos.  
O3. Encontrar la obra de referencia de cada área del libro.  
O4. Usar la bibliografía por problema, apoyada en hojas de datos, notas de aplicación y normas.  
R (122 palabras). El apéndice es una selección comentada de fuentes para profundizar, ordenadas por cercanía al proyecto. Empieza por las fuentes directas del FM7303, el manual del kit y las hojas de datos de los fabricantes, y por el linaje teórico de esta familia de receptores. Siguen las referencias generales de electrónica, encabezadas por «The Art of Electronics», y el manual del FNIRSI 2C53T. La última sección recoge obras de referencia para cada bloque del libro, de los fundamentos y los semiconductores a la potencia, el control, la radiofrecuencia, las placas, la fiabilidad, la simulación y el audio, y termina con un consejo: acudir a ellas por problema y no por orden, con las hojas de datos y las normas como fuente más actualizada.  
G. Proyectos —   
Normas extraídas: IPC-2221 (); IPC-A-610 ()  

**Ap. H — Cuestionario de Autoevaluación** (`apH`)  
O1. Comprobar lo aprendido en seis bloques de preguntas sin consultar el texto.  
O2. Identificar los bloques en que conviene volver a los capítulos correspondientes.  
O3. Contrastar las respuestas con el solucionario.  
O4. Usar el cuestionario como muestra de autoevaluación del curso completo.  
R (82 palabras). El apéndice propone treinta preguntas para comprobar lo aprendido, agrupadas en seis bloques: fundamentos, componentes, esquemas e instrumentos, soldadura y diagnóstico, el receptor FM7303 y el FNIRSI con sus prácticas. Se recomienda responderlas sin mirar el texto y, si se fallan varias de un bloque, volver a los capítulos correspondientes. El solucionario está al final, y el propio apéndice advierte de que el cuestionario es una muestra. La autoevaluación por capítulos de esta edición lo amplía a todos los capítulos del libro.  
G.  —   

**Ap. I — Equivalencias de Instrumental y del Proyecto** (`apI`)  
O1. Adaptar los procedimientos del libro al instrumental disponible.  
O2. Identificar qué funciones de cada instrumento usa realmente el libro.  
O3. Elegir equivalentes por categoría de instrumento y saber en qué no conviene escatimar.  
O4. Encontrar alternativas al kit FM7303.  
R (73 palabras). El libro usa instrumentos concretos, el osciloscopio portátil FNIRSI 2C53T y el multímetro Brymen BM869s, y un receptor concreto, el kit FM7303. Este apéndice explica cómo adaptar sus procedimientos a otro instrumental: qué funciones de cada instrumento se usan realmente, qué equivalentes sirven por categoría, en qué conviene no escatimar y qué alternativas hay al kit. Termina con la generalización de los procedimientos, que en su mayoría no dependen del modelo de instrumento.  
G. Instrumentación Electrónica — TE5  

**Ap. J — Símbolos y Notación** (`apJ`)  
O1. Identificar los símbolos que más se repiten en el libro, con su significado y su unidad.  
O2. Interpretar la convención de subíndices de las hojas de datos.  
O3. Distinguir los valores instantáneos de los de continua por la notación.  
O4. Localizar el capítulo donde se desarrolla cada magnitud.  
R (94 palabras). El apéndice relaciona los símbolos que más se repiten en el libro con su significado, su unidad y los capítulos donde se desarrollan, agrupados en cuatro tablas: magnitudes y circuitos, semiconductores, amplificadores con ruido y conversión, y radiofrecuencia con señal digital y fiabilidad. Explica la convención de subíndices de las hojas de datos, como VCE o RDS(on), y la que distingue las minúsculas de los valores instantáneos de las mayúsculas de los de continua. Las letras griegas y las constantes físicas tienen sus propias tablas en la sección 0.1 y en la tabla C.4.  
G. Teoría de Circuitos — FB1  
