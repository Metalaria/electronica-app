# Análisis de huecos frente a la Orden CIN/351/2009

Borrador para el autor. Referencia: **Grado en Ingeniería Electrónica Industrial y Automática** (supuesto; es el grado que habilita para la especialidad de electrónica industrial de la profesión de ingeniero técnico industrial). Competencias: Orden CIN/351/2009, de 9 de febrero, BOE núm. 44, de 20 de febrero de 2009, sec. I, págs. 18145-18149 (BOE-A-2009-2893), Anexo, apartado 5 (Planificación de las enseñanzas), tabla de módulos: <https://www.boe.es/diario_boe/txt.php?id=BOE-A-2009-2893>. El BOE no numera las filas de la tabla; los códigos FB1–FB6, CR1–CR12 y TE1–TE11 son nuestros y siguen el orden de la tabla (la Universidad de La Laguna, por ejemplo, las numera [1]–[29]).

Método: la cobertura se ha valorado sobre el contenido de los capítulos (títulos de sección y de apartado, primeras frases y texto completo de `web/public/libro/partes/*.json`), con una búsqueda de términos por tema (`datos/_evidencias.json`) para confirmar presencias y ausencias. Los números de capítulo y sección son los impresos (el fichero `cap24.json` es el capítulo 23). «Completa» significa que el libro cubre lo que una asignatura de grado espera de esa competencia; «parcial», que falta algún bloque que se espera; «ninguna», que no hay contenido. No se cuenta como hueco lo que un libro de electrónica no tiene por qué tratar.

## Resumen

- En el alcance: 17 competencias — 5 completas, 11 parciales, 1 sin cobertura.
- Fuera del alcance: 12 competencias (lista al final).
- Propuestas: 13 — 5 esenciales, 5 recomendables, 3 opcionales; unas 184 páginas en total (80 las esenciales).

| Código | Competencia (abreviada) | Cobertura | Capítulos que la cubren | Propuestas |
|---|---|---|---|---|
| FB1 | matemáticas para la ingeniería | parcial | 0, 22, 43 | P08 |
| FB2 | física: campos, ondas y electromagnetismo | parcial | 1, 3, 4, 25, 37 | P09 |
| FB3 | informática y programación | parcial | 16, 17, 39, 38, 50 | P12 |
| CR4 | teoría de circuitos y máquinas eléctricas | parcial | 1, 22, 23, 24, 4, 33 | P01, P02 |
| CR5 | fundamentos de electrónica | completa | 5, 6, 7, 8, 9, 25 | — |
| CR6 | automatismos y métodos de control | parcial | 30, 19 | P03 |
| TE1 | electrotecnia | parcial | 23, 48, 33 | P01, P07 |
| TE2 | electrónica analógica | completa | 6, 8, 24, 26, 27, 44, 52 | — |
| TE3 | electrónica digital y microprocesadores | completa | 9, 28, 38, 16, 39 | P11 |
| TE4 | electrónica de potencia | parcial | 5, 10, 33, 51 | P04, P02 |
| TE5 | instrumentación electrónica | completa | 20, 21, 35, 36, 48, 19 | — |
| TE6 | diseño de sistemas electrónicos | completa | 41, 42, 47, 49, 50, 51, 52, 53 | — |
| TE7 | modelado y simulación | parcial | 43, 30, 48, 29 | P06 |
| TE8 | regulación automática y control | parcial | 30, 26, 33, 51 | P05, P03 |
| TE9 | sistemas robotizados | ninguna | — | P10 |
| TE10 | informática industrial y comunicaciones | parcial | 45, 30, 37, 39, 18 | P03, P13 |
| TE11 | diseño de sistemas de control y automatización | parcial | 30, 33, 51 | P03 |

## Competencias en el alcance

### FB1 — parcial

> Capacidad para la resolución de los problemas matemáticos que puedan plantearse en la ingeniería. Aptitud para aplicar los conocimientos sobre: álgebra lineal; geometría; geometría diferencial; cálculo diferencial e integral; ecuaciones diferenciales y en derivadas parciales; métodos numéricos; algorítmica numérica; estadística y optimización.

El libro cubre con rigor las matemáticas que usa la electrónica, siempre aplicadas a un circuito. No cubre lo que la competencia nombra y la electrónica no necesita en primera línea (geometría y geometría diferencial, EDP, optimización general), y trata de pasada dos cosas que un curso sí espera y que el propio libro usa: el álgebra lineal más allá de las nociones de 0.12 (autovalores, que sostienen el espacio de estados de 30.12) y los métodos numéricos (Newton-Raphson e integración de EDO, que explican el comportamiento de SPICE en 41.6).

- Capítulo 0 (Fundamentos Matemáticos para la Electrónica), 0.1-0.21: notación, álgebra, trigonometría, complejos, derivadas e integrales, EDO de primer y segundo orden, Laplace, Fourier, convolución, transformada Z, Cramer, estadística, Monte Carlo, propagación de errores, mínimos cuadrados, Taylor, análisis dimensional, Bode.
- Capítulo 22 (Métodos Formales de Análisis de Circuitos), 22.13: formulación matricial del análisis nodal.
- Capítulo 43 (Simulación de Circuitos con SPICE), 41.5, 41.6: Monte Carlo y convergencia por Newton-Raphson, solo citado.

Propuestas: P08.

### FB2 — parcial

> Comprensión y dominio de los conceptos básicos sobre las leyes generales de la mecánica, termodinámica, campos y ondas y electromagnetismo y su aplicación para la resolución de problemas propios de la ingeniería.

El electromagnetismo aparece siempre aplicado y suficiente para la electrónica. Falta un tratamiento formal de campo: ley de Gauss, ley de Ampère y ecuaciones de Maxwell (citadas solo de pasada en 4.1) y la onda electromagnética que une la línea de transmisión con la antena. Mecánica y termodinámica quedan fuera del objeto del libro, como es normal en un texto de electrónica.

- Capítulo 1 (Fundamentos de Electricidad y Teoría de Circuitos), 1.1, 1.14: carga, campo y efecto pelicular.
- Capítulo 3 (Condensadores — Teoría, Tipos y Aplicaciones), 3.1: campo eléctrico en el dieléctrico, capacidad.
- Capítulo 4 (Inductores y Transformadores), 4.1, 4.9, 4.10: inducción (Faraday, Lenz), histéresis, saturación, reluctancia.
- Capítulo 25 (Semiconductores en Profundidad), 25.1-25.2: física del estado sólido aplicada.
- Capítulo 37 (Radiofrecuencia y Líneas de Transmisión), 35.1-35.8: ondas en líneas de transmisión y antenas.

Propuestas: P09.

### FB3 — parcial

> Conocimientos básicos sobre el uso y programación de los ordenadores, sistemas operativos, bases de datos y programas informáticos con aplicación en ingeniería.

La programación aplicada a sistemas empotrados está muy bien cubierta. No hay una introducción a la programación (tipos, estructuras de datos, algoritmos) ni a las bases de datos, que el libro da por sabidas; es razonable en un libro de electrónica, y basta un apéndice de consulta de C.

- Capítulo 16 (Microcontroladores: Arduino), 16.3-16.11: programación de Arduino en C/C++, cadena de herramientas, depuración.
- Capítulo 17 (Ordenadores de Placa Única: Raspberry Pi), 17.3, 17.6: Python y sistema operativo Linux en Raspberry Pi.
- Capítulo 39 (Sistemas Embebidos en Profundidad), 37.3, 37.9-37.14: programación bare-metal, arquitectura del firmware, RTOS.
- Capítulo 38 (Lógica Programable: CPLD, FPGA y HDL), 36.4-36.7: descripción de hardware en VHDL y Verilog.
- Capítulo 50 (Proyecto Detallado I: Estación de Medida Ambiental IoT), 48.10-48.11: firmware por capas, MQTT y almacenamiento en un panel.

Propuestas: P12.

### CR4 — parcial

> Conocimiento y utilización de los principios de teoría de circuitos y máquinas eléctricas.

La teoría de circuitos está completa y a nivel universitario. Las máquinas eléctricas solo aparecen en el transformador y en la ampliación 32.13; no hay ninguna referencia a los sistemas trifásicos (cero apariciones de «trifásico» en todo el libro), ni a la máquina síncrona, ni al circuito equivalente del motor de inducción.

- Capítulo 1 (Fundamentos de Electricidad y Teoría de Circuitos), 1.1-1.11: leyes y teoremas.
- Capítulo 22 (Métodos Formales de Análisis de Circuitos), 22.1-22.14: métodos formales de análisis.
- Capítulo 23 (Régimen Transitorio y Análisis en Alterna), 23.1-23.9: transitorio, alterna, potencias, factor de potencia, transformador.
- Capítulo 24 (Cuadripolos, Función de Transferencia y Filtros), 24.1-24.9: cuadripolos, función de transferencia, filtros.
- Capítulo 4 (Inductores y Transformadores), 4.6, 4.9: transformador ideal y real.
- Capítulo 33 (Electrónica de Potencia y Conversión de Energía), 32.13: ampliación breve: motor de continua, de inducción, paso a paso y BLDC.

Propuestas: P01, P02.

### CR5 — completa

> Conocimientos de los fundamentos de la electrónica.

Cubierta de sobra: los fundamentos de la electrónica son el núcleo del libro.

- Capítulo 5 (Diodos — Teoría Semiconductora y Aplicaciones Completas), 5.1-5.11: diodo.
- Capítulo 6 (Transistores BJT — Teoría Avanzada y Diseño de Circuitos), 6.1-6.15: BJT.
- Capítulo 7 (Transistores MOSFET — Teoría Exhaustiva y Aplicaciones), 7.1-7.11: MOSFET.
- Capítulo 8 (Circuitos Integrados Analógicos), 8.1-8.10: integrados analógicos.
- Capítulo 9 (Circuitos Integrados Digitales), 9.1-9.10: integrados digitales.
- Capítulo 25 (Semiconductores en Profundidad), 25.1-25.10: semiconductores en profundidad.

### CR6 — parcial

> Conocimientos sobre los fundamentos de automatismos y métodos de control.

Los métodos de control están bien cubiertos. Los automatismos no: no hay lógica cableada con relés y contactores, autómatas programables, lenguajes IEC 61131-3 ni GRAFCET (una sola mención de «PLC», en 19.13, como receptor de un lazo de 4-20 mA).

- Capítulo 30 (Control y Comunicaciones), 30.1-30.3, 30.5, 30.7, 30.9, 30.11, 30.12: control realimentado, PID, control digital, otras técnicas.
- Capítulo 19 (Componentes Especiales, Sensores e Interfaces), 19.2, 19.10: relés y relés de estado sólido como componentes.

Propuestas: P03.

### TE1 — parcial

> Conocimiento aplicado de electrotecnia.

La electrotecnia monofásica está cubierta. Faltan los sistemas trifásicos y las instalaciones de baja tensión con sus protecciones (magnetotérmicos, selectividad, esquemas de conexión a tierra) y el Reglamento electrotécnico para baja tensión, que el libro no cita.

- Capítulo 23 (Régimen Transitorio y Análisis en Alterna), 23.2, 23.4, 23.5, 23.8, 23.9: alterna, potencias, corrección del factor de potencia, transformador.
- Capítulo 48 (Instrumentación, Gestión Térmica y Seguridad), 46.7, 46.10: diferencial, clases de protección y aislamiento.
- Capítulo 33 (Electrónica de Potencia y Conversión de Energía), 32.8: corrección del factor de potencia activa.

Propuestas: P01, P07.

### TE2 — completa

> Conocimiento de los fundamentos y aplicaciones de la electrónica analógica.

Cubierta con profundidad de grado y con diseño.

- Capítulo 6 (Transistores BJT — Teoría Avanzada y Diseño de Circuitos), 6.5-6.14: etapas con BJT.
- Capítulo 8 (Circuitos Integrados Analógicos), 8.1-8.9: operacional, reguladores, referencias, S&H.
- Capítulo 24 (Cuadripolos, Función de Transferencia y Filtros), 24.4-24.9: filtros activos.
- Capítulo 26 (El Amplificador Operacional y la Realimentación), 26.1-26.10: operacional y realimentación, estabilidad.
- Capítulo 27 (Osciladores, PLL y Referencias de Frecuencia), 27.1-27.7: osciladores y PLL.
- Capítulo 44 (Amplificadores con Transistores Discretos), 42.1-42.11: amplificadores discretos, clases de salida.
- Capítulo 52 (Proyecto Detallado III: Amplificador de Audio Hi-Fi), 50.1-50.12: proyecto de amplificador.

### TE3 — completa

> Conocimiento de los fundamentos y aplicaciones de la electrónica digital y microprocesadores.

Cubierta. La única ausencia frente a una asignatura de microprocesadores es la programación en lenguaje ensamblador y los modos de direccionamiento (solo nueve menciones de «ensamblador»); es una mejora opcional, no un hueco.

- Capítulo 9 (Circuitos Integrados Digitales), 9.1-9.9: familias lógicas, metaestabilidad.
- Capítulo 28 (Electrónica Digital: Lógica, Secuencias y Memoria), 28.1-28.10: combinacional, secuencial, máquinas de estados, memorias, diseño síncrono, representación numérica, del bit al procesador.
- Capítulo 38 (Lógica Programable: CPLD, FPGA y HDL), 36.1-36.17: lógica programable, HDL, cierre de tiempos, RISC-V.
- Capítulo 16 (Microcontroladores: Arduino), 16.1-16.11: microcontrolador.
- Capítulo 39 (Sistemas Embebidos en Profundidad), 37.1-37.15: sistemas empotrados, interrupciones, DMA, arquitectura de computadores.

Propuestas: P11.

### TE4 — parcial

> Conocimiento aplicado de electrónica de potencia.

La conversión CC-CC está tratada con profundidad de grado. Faltan los convertidores CC-CA (inversores monofásicos y trifásicos con modulación PWM senoidal; ninguna aparición en el libro), los rectificadores controlados trifásicos y el accionamiento de motores de alterna.

- Capítulo 5 (Diodos — Teoría Semiconductora y Aplicaciones Completas), 5.6, 5.7: rectificación con diodos y recuperación inversa.
- Capítulo 10 (Componentes de Potencia y Protección), 10.1, 10.2, 10.6: tiristores con control de fase, IGBT, snubbers.
- Capítulo 33 (Electrónica de Potencia y Conversión de Energía), 32.1-32.16: convertidores CC-CC, aislados, PFC, rectificación síncrona, resonantes, puente en H, magnéticos, compensación.
- Capítulo 51 (Proyecto Detallado II: Fuente de Alimentación de Laboratorio), 49.1-49.16: proyecto de fuente lineal.

Propuestas: P04, P02.

### TE5 — completa

> Conocimiento aplicado de instrumentación electrónica.

Cubierta, con un enfoque de banco poco habitual en los textos universitarios. Podría añadirse la terminología de la evaluación de la incertidumbre de tipo A y B, pero el contenido de fondo está.

- Capítulo 20 (FNIRSI 2C53T — Guía Completa del Instrumento 3-en-1), 20.1-20.21: osciloscopio, FFT, generador, multímetro.
- Capítulo 21 (Prácticas de Laboratorio con el FNIRSI 2C53T), 21.1-21.13: prácticas de laboratorio.
- Capítulo 35 (Conversión de Datos: ADC y DAC), 33.1-33.10: conversión de datos.
- Capítulo 36 (Sensores y Acondicionamiento de Señal), 34.1-34.11: sensores y acondicionamiento, cadena de medida.
- Capítulo 48 (Instrumentación, Gestión Térmica y Seguridad), 46.1-46.3, 46.14: medida, incertidumbre, calibración, trazabilidad.
- Capítulo 19 (Componentes Especiales, Sensores e Interfaces), 19.5, 19.13: sensores y lazo de 4-20 mA.

### TE6 — completa

> Capacidad para diseñar sistemas electrónicos analógicos, digitales y de potencia.

Cubierta: además de los cuatro proyectos completos, casi todos los capítulos terminan con problemas de diseño.

- Capítulo 41 (Diseño Avanzado de Circuito Impreso), 39.1-39.12: diseño de circuito impreso.
- Capítulo 42 (Integridad de Señal y de Alimentación), 40.1-40.10: integridad de señal y alimentación.
- Capítulo 47 (Fiabilidad y Diseño para Fabricación (DFM)), 45.1-45.18: fiabilidad y DFM.
- Capítulo 49 (Proyectos de Integración: Cuatro Diseños Completos), 47.1-47.5: método de proyecto.
- Capítulo 50 (Proyecto Detallado I: Estación de Medida Ambiental IoT), 48.1-48.14: proyecto IoT.
- Capítulo 51 (Proyecto Detallado II: Fuente de Alimentación de Laboratorio), 49.1-49.16: proyecto de fuente.
- Capítulo 52 (Proyecto Detallado III: Amplificador de Audio Hi-Fi), 50.1-50.12: proyecto de amplificador.
- Capítulo 53 (Proyecto Detallado IV: Radio Definida por Software (SDR)), 51.1-51.10: proyecto SDR.

### TE7 — parcial

> Conocimiento y capacidad para el modelado y simulación de sistemas.

La simulación de circuitos está completa. El modelado de sistemas dinámicos no eléctricos (mecánicos, térmicos, electromecánicos) y su simulación por diagramas de bloques no se tratan, y el libro no usa ninguna herramienta de simulación de sistemas.

- Capítulo 43 (Simulación de Circuitos con SPICE), 41.1-41.10: simulación de circuitos con SPICE.
- Capítulo 30 (Control y Comunicaciones), 30.12: espacio de estados, como ampliación.
- Capítulo 48 (Instrumentación, Gestión Térmica y Seguridad), 46.4, 46.5: analogía térmica-eléctrica.
- Capítulo 29 (Señales y Sistemas: Muestreo, Convolución y DSP), 29.2, 29.7: sistemas LTI y paso del circuito al algoritmo.

Propuestas: P06.

### TE8 — parcial

> Conocimientos de regulación automática y técnicas de control y su aplicación a la automatización industrial.

El control realimentado se trata con criterio práctico. Frente a una asignatura de regulación automática faltan los criterios formales de estabilidad (Routh-Hurwitz, ninguna aparición; criterio de Nyquist, una mención), el error en régimen permanente y el tipo del sistema, y el diseño sistemático de compensadores de adelanto y retraso (las redes de 32.16 lo son, pero no se presentan así). La aplicación a la automatización industrial depende de P03.

- Capítulo 30 (Control y Comunicaciones), 30.1-30.3, 30.5, 30.9, 30.11, 30.12: PID, sintonía, márgenes, lugar de las raíces, control digital.
- Capítulo 26 (El Amplificador Operacional y la Realimentación), 26.8-26.10: estabilidad y compensación del operacional.
- Capítulo 33 (Electrónica de Potencia y Conversión de Energía), 32.6, 32.16: control de convertidores, redes de tipo II y III.
- Capítulo 51 (Proyecto Detallado II: Fuente de Alimentación de Laboratorio), 49.6, 49.8: lazos de tensión y corriente.

Propuestas: P05, P03.

### TE9 — ninguna

> Conocimientos de principios y aplicaciones de los sistemas robotizados.

No hay contenido de sistemas robotizados (una sola mención de «robots» en la introducción del capítulo 18). Los componentes que un robot necesita sí están: motores y puente en H (32.9, 32.13), encoders (19.9), sensores de movimiento (34.4) y control (cap. 30).


Propuestas: P10.

### TE10 — parcial

> Conocimiento aplicado de informática industrial y comunicaciones.

Las comunicaciones electrónicas están muy bien cubiertas. La informática industrial no: buses de campo y Ethernet industrial (Modbus, PROFINET, EtherCAT: dos menciones en total), arquitectura de un sistema de automatización con SCADA y OPC UA (ninguna aparición).

- Capítulo 45 (Buses y Protocolos de Comunicación), 43.1-43.12: UART, SPI, I²C, CAN, USB, RS-485, aislamiento, terminación, fibra.
- Capítulo 30 (Control y Comunicaciones), 30.4, 30.6, 30.10, 30.13: modulación, multiplexación, corrección de errores.
- Capítulo 37 (Radiofrecuencia y Líneas de Transmisión), 35.1-35.12: radiofrecuencia.
- Capítulo 39 (Sistemas Embebidos en Profundidad), 37.9-37.14: firmware y RTOS.
- Capítulo 18 (Proyectos Avanzados: Arduino y Raspberry Pi Juntos), 18.2, 18.6: protocolo robusto entre placas; Modbus RTU solo citado.

Propuestas: P03, P13.

### TE11 — parcial

> Capacidad para diseñar sistemas de control y automatización industrial.

El diseño de lazos de control sí se practica; el diseño de un sistema de automatización industrial (especificación, GRAFCET, autómata, seguridad de máquina) no aparece.

- Capítulo 30 (Control y Comunicaciones), 30.14: problemas de diseño de lazos PID.
- Capítulo 33 (Electrónica de Potencia y Conversión de Energía), 32.16: diseño de la compensación de un convertidor.
- Capítulo 51 (Proyecto Detallado II: Fuente de Alimentación de Laboratorio), 49.6, 49.8: diseño de los lazos de una fuente.

Propuestas: P03.

## Propuestas de contenido nuevo

Por prioridad. Las páginas son una estimación con la maqueta 1.1 (200 × 265 mm, columna de 116 mm).

### P01 — Sistemas trifásicos (esencial, sección, ~12 págs.)

- Dónde: Nueva sección 23.10 en el capítulo 23 (cap24.json), tras «Inductancia mutua y el transformador en alterna»; el resumen actual pasa a 23.11.
- Competencias: CR4, TE1.
- Requisitos en el libro: Capítulo 23, Capítulo 1.
- Esquema:
  1. Por qué tres fases: potencia instantánea constante y ahorro de conductor.
  2. Secuencia de fases, tensiones de fase y de línea, factor √3, diagrama fasorial.
  3. Cargas en estrella y en triángulo, equilibradas y desequilibradas; el neutro y su corriente.
  4. Potencias activa, reactiva y aparente en trifásica; corrección del factor de potencia.
  5. Medida de potencia: un vatímetro con neutro y el método de los dos vatímetros (Aron).
  6. La red de 400/230 V que llega a un taller, con números.
  7. En el banco: por qué no se mide la red trifásica con el FNIRSI y qué instrumento hace falta.

### P03 — Automatismos y autómatas programables (esencial, capítulo, ~26 págs.)

- Dónde: Nuevo capítulo en el tomo V, a continuación de «Control y comunicaciones» (cap31.json), o al comienzo del bloque «Diseño y realización».
- Competencias: CR6, TE8, TE10, TE11.
- Requisitos en el libro: Capítulo 9, Capítulo 19, Capítulo 28, Capítulo 30.
- Esquema:
  1. Lógica cableada: relés, contactores, enclavamientos, arranque directo y estrella-triángulo de un motor.
  2. Sensores y actuadores industriales: detectores inductivos y capacitivos, finales de carrera, electroválvulas.
  3. El autómata programable: arquitectura, ciclo de scan, entradas y salidas, tiempo de respuesta.
  4. Lenguajes de la norma IEC 61131-3: diagrama de contactos, bloques funcionales, texto estructurado y SFC.
  5. GRAFCET (IEC 60848): etapas, transiciones, divergencias; del GRAFCET al programa.
  6. Seguridad de máquinas: parada de emergencia, categorías y funciones de seguridad.
  7. Autómata frente a microcontrolador: cuándo cada uno.
  8. Problema de diseño: automatizar una máquina sencilla desde la especificación al programa.

### P04 — Inversores y rectificadores controlados (esencial, sección, ~16 págs.)

- Dónde: Dos secciones nuevas en el capítulo 32, tras 32.9 «Gobernar motores: puente en H»: 32.10 «Convertidores CC-CA» y 32.11 «Rectificadores controlados»; renumerar las siguientes.
- Competencias: TE4.
- Requisitos en el libro: Capítulo 10, Capítulo 33, Capítulo 23.
- Esquema:
  1. Del puente en H al inversor monofásico: onda cuadrada, cuasi cuadrada y modulación PWM senoidal.
  2. Índice de modulación, sobremodulación, armónicos y filtrado de salida.
  3. El inversor trifásico de seis interruptores y la modulación vectorial (SVPWM), en lo esencial.
  4. Tiempos muertos, drivers de rama y protección de cortocircuito de rama.
  5. Rectificadores controlados monofásicos y trifásicos con tiristores: ángulo de disparo, tensión media, factor de potencia.
  6. Rectificadores trifásicos con diodos (puente de seis pulsos) y su rizado.
  7. Problemas de diseño: un inversor de 500 W para una carga resistiva.

### P05 — Análisis y compensación clásicos del lazo de control (esencial, sección, ~14 págs.)

- Dónde: Tres secciones nuevas en el capítulo 30, tras 30.9 «Estabilidad del lazo de control».
- Competencias: TE8.
- Requisitos en el libro: Capítulo 0, Capítulo 24, Capítulo 30.
- Esquema:
  1. Especificaciones temporales del sistema de segundo orden: sobreimpulso, tiempo de pico y de establecimiento.
  2. Tipo del sistema y error en régimen permanente ante escalón, rampa y parábola.
  3. Criterio de Routh-Hurwitz: estabilidad absoluta y margen de una ganancia.
  4. Criterio de Nyquist y su relación con los márgenes de 30.9.
  5. Compensadores de adelanto y de retraso por frecuencia y por lugar de las raíces.
  6. La conexión con las redes de tipo II y III de 32.16.
  7. Problemas de diseño con números.

### P13 — Comunicaciones industriales (esencial, sección, ~12 págs.)

- Dónde: Dos secciones nuevas en el capítulo 43 (Buses y protocolos), tras 43.5 «CAN»; o integradas en el capítulo nuevo de P03.
- Competencias: TE10.
- Requisitos en el libro: Capítulo 45, Capítulo 30.
- Esquema:
  1. La pirámide de la automatización: campo, control, supervisión.
  2. Modbus RTU sobre RS-485 y Modbus TCP: tramas, funciones, mapa de registros.
  3. Buses de campo y Ethernet industrial (PROFIBUS, PROFINET, EtherCAT): determinismo y topologías.
  4. IO-Link para sensores inteligentes.
  5. Supervisión: SCADA, HMI y OPC UA, en lo que necesita saber quien diseña el equipo de campo.
  6. Problema de diseño: un nodo Modbus RTU con un microcontrolador y su prueba.

### P02 — Máquinas eléctricas y accionamientos (recomendable, capítulo, ~28 págs.)

- Dónde: Nuevo capítulo en el bloque «Electrónica de grado», a continuación del capítulo 32 (Electrónica de potencia); absorbe y amplía la ampliación 32.13.
- Competencias: CR4, TE4, TE8.
- Requisitos en el libro: Capítulo 4, Capítulo 23, Capítulo 33.
- Esquema:
  1. El circuito magnético: reluctancia, fuerza magnetomotriz, par y fuerza electromotriz.
  2. El transformador trifásico, grupos de conexión y ensayos de vacío y cortocircuito.
  3. La máquina de corriente continua: ecuaciones, curvas par-velocidad, control por inducido.
  4. El motor de inducción: campo giratorio, deslizamiento, circuito equivalente, curva par-velocidad.
  5. La máquina síncrona y el motor de imanes permanentes (PMSM y BLDC).
  6. Accionamientos: control escalar V/f, nociones de control vectorial, frenado y cuatro cuadrantes.
  7. Elección y protección de un motor; lectura de la placa de características.
  8. Problemas de diseño: dimensionar un accionamiento para una carga dada.

### P06 — Modelado de sistemas físicos y simulación por diagramas de bloques (recomendable, sección, ~10 págs.)

- Dónde: Nueva sección en el capítulo 30, antes de la ampliación 30.12, o nueva sección final del capítulo 41 (SPICE).
- Competencias: TE7.
- Requisitos en el libro: Capítulo 0, Capítulo 23, Capítulo 43.
- Esquema:
  1. Analogías eléctrica, mecánica y térmica: masa, muelle, amortiguador frente a L, C y R.
  2. Modelo de un motor de continua con su carga mecánica.
  3. Linealización alrededor de un punto de trabajo (enlace con 0.14).
  4. Diagramas de bloques y su álgebra.
  5. Simulación numérica de un modelo: paso fijo y variable, rigidez.
  6. Herramientas libres (Octave, Scilab/Xcos o Python con SciPy) frente a SPICE con fuentes controladas.

### P07 — Instalaciones y protecciones de baja tensión (recomendable, sección, ~8 págs.)

- Dónde: Nueva sección en el capítulo 46 (Instrumentación, gestión térmica y seguridad), tras 46.7, o nuevo apéndice.
- Competencias: TE1.
- Requisitos en el libro: Capítulo 10, Capítulo 48.
- Esquema:
  1. El Reglamento electrotécnico para baja tensión y sus instrucciones técnicas complementarias, en lo que afecta a un taller.
  2. Magnetotérmicos: curvas B, C y D, poder de corte, selectividad.
  3. Diferenciales: sensibilidad, tipos AC, A y B y por qué importa con electrónica de potencia.
  4. Esquemas de conexión a tierra TT, TN e IT y su consecuencia para la seguridad.
  5. Dimensionado de la acometida de un banco de trabajo con números.

### P08 — Álgebra lineal y métodos numéricos para el circuito (recomendable, sección, ~10 págs.)

- Dónde: Ampliación de 0.12 «Nociones de Álgebra Lineal y Estadística» (autovalores) y una sección nueva en el capítulo 0, tras 0.12 (métodos numéricos).
- Competencias: FB1, TE7.
- Requisitos en el libro: Capítulo 0.
- Esquema:
  1. Sistemas n×n: pivotaje y condicionamiento (0.12 ya presenta Cramer y la eliminación gaussiana).
  2. Autovalores y autovectores: modos naturales de un circuito y estabilidad en espacio de estados.
  3. Newton-Raphson: el punto de trabajo de un diodo, y por qué SPICE no converge.
  4. Integración numérica de EDO: Euler explícito e implícito y trapecio; estabilidad numérica.
  5. Ejercicios con un circuito de tres mallas y un RC no lineal.

### P09 — Del campo a la onda: ecuaciones de Maxwell (recomendable, sección, ~8 págs.)

- Dónde: Nueva sección inicial del capítulo 35 (Radiofrecuencia), antes de 35.1, o ampliación al final del capítulo 4.
- Competencias: FB2.
- Requisitos en el libro: Capítulo 3, Capítulo 4.
- Esquema:
  1. Leyes de Gauss y de Ampère en forma integral, con los ejemplos del condensador y la bobina.
  2. La corriente de desplazamiento y las cuatro ecuaciones de Maxwell.
  3. La onda plana: velocidad, impedancia del vacío, longitud de onda.
  4. De la onda a la línea de transmisión y a la antena (enlace con 35.1 y 35.8).
  5. El vector de Poynting y la potencia radiada.

### P10 — Electrónica para sistemas robotizados (opcional, capítulo, ~22 págs.)

- Dónde: Nuevo capítulo o proyecto por etapas en el bloque «Proyectos», tras el capítulo 51 (SDR).
- Competencias: TE9.
- Requisitos en el libro: Capítulo 19, Capítulo 30, Capítulo 33, Capítulo 36, Capítulo 39.
- Esquema:
  1. Arquitectura de un robot: sensores, actuadores, control y planificación.
  2. Cinemática directa e inversa de un brazo de dos o tres ejes.
  3. Control de ejes: servo de posición con encoder, perfiles de velocidad.
  4. Robot móvil diferencial: odometría con encoders e IMU.
  5. Seguridad de robots industriales (ISO 10218) en lo esencial.
  6. Proyecto por etapas: un brazo de tres ejes con servos o paso a paso.

### P11 — Programación en ensamblador y modos de direccionamiento (opcional, sección, ~6 págs.)

- Dónde: Nueva sección del capítulo 37 (Sistemas embebidos), junto a la ampliación 37.15.
- Competencias: TE3.
- Requisitos en el libro: Capítulo 28, Capítulo 39.
- Esquema:
  1. Juego de instrucciones y modos de direccionamiento de un núcleo real (AVR o Cortex-M).
  2. Leer el ensamblador que genera el compilador.
  3. Una rutina de interrupción en ensamblador y su latencia contada en ciclos.
  4. Cuándo merece la pena escribir ensamblador hoy.

### P12 — Fundamentos de C para sistemas empotrados (opcional, apéndice, ~12 págs.)

- Dónde: Nuevo apéndice K.
- Competencias: FB3.
- Requisitos en el libro: Capítulo 16.
- Esquema:
  1. Tipos enteros de tamaño fijo, operadores de bits, punteros y estructuras.
  2. volatile, const y el modelo de memoria de un microcontrolador.
  3. Máquinas de estados y búferes circulares como estructuras de datos de uso diario.
  4. Errores típicos: desbordamiento, promoción de enteros, comportamiento indefinido.

## Fuera del alcance

- **FB4** — Química general, orgánica e inorgánica: materia de primer curso ajena al objeto del libro; solo se toca la química de baterías (cap. 38) y de la soldadura (cap. 13) como aplicación.
- **FB5** — Expresión gráfica (geometría métrica y descriptiva, CAD mecánico): el libro trata el dibujo de esquemas y el CAD electrónico (caps. 11, 12 y 39), que es otra disciplina.
- **FB6** — Empresa, marco jurídico y gestión: fuera del objeto de un texto técnico de electrónica.
- **CR1** — Termodinámica aplicada y transmisión de calor: el libro solo trata la gestión térmica de componentes (caps. 10 y 46, con conducción, convección y radiación en 46.4-46.13); la termodinámica general corresponde a otra asignatura.
- **CR2** — Mecánica de fluidos (tuberías, canales): ajena a la electrónica.
- **CR3** — Ciencia y tecnología de materiales en general: el libro trata solo los materiales electrónicos (semiconductores, dieléctricos, núcleos magnéticos, aleaciones de soldadura), no la relación microestructura-propiedades de la ciencia de materiales.
- **CR7** — Teoría de máquinas y mecanismos: ajena a la electrónica.
- **CR8** — Resistencia de materiales: ajena a la electrónica (la galga extensométrica de 34.3 mide deformación, pero no enseña la teoría).
- **CR9** — Sistemas de producción y fabricación en general: el libro trata la fabricación electrónica (soldadura, reflujo, DFM, cap. 13, 39 y 45) como caso particular, no los sistemas de producción.
- **CR10** — Tecnologías medioambientales y sostenibilidad: el libro solo menciona RoHS, RAEE y el ecodiseño (13.6, D.5, 52.33).
- **CR11** — Organización de empresas: fuera del objeto del libro.
- **CR12** — Organización y gestión de proyectos y oficina técnica: el libro desarrolla proyectos técnicos por etapas (caps. 47-51), pero no su gestión, planificación ni la oficina de proyectos.
