// P03 — «Automatismos y Autómatas Programables»: a NEW CHAPTER for «Electrónica Práctica Avanzada».
// Provisional part id and file name: cap-new-automatas (cap-new-automatas.typ). All labels use that prefix and every
// cross-reference is a label (#nr), never a hand-written number, because the chapter renumbers the ones after it.
// Two placements (see NOTAS.md): (A) tomo V, right after «Control y Comunicaciones» (cap31.typ, printed 30): the new
// chapter is 31 and 31-53 become 32-54; colour A6552B. (B) start of the «Diseño y realización» block, before
// «Baterías y Gestión de Energía» (cap39.typ, printed 38): the new chapter is 38 and 38-53 become 39-54; colour
// 2E6EA6. The #capitulo line below uses (A); for (B) change only the colour.
// Fieldbuses are NOT treated here: they are P13's sections <sec-new-44-modbus> and <sec-new-44-campo>.
// Every number comes from scripts/calculos.py (electrical) or scripts/simulacion.py (scan-cycle simulator, plc.py),
// and the input-wiring example from the ngspice runs in spice/ (scripts/spice_analisis.py).

#capitulo("A6552B")[Automatismos y Autómatas Programables] <cap-new-automatas>

Una cinta que se para cuando la pieza llega a su sitio, un cilindro que baja, espera y sube, un motor que arranca en estrella y pasa a triángulo: casi todo lo que se mueve en una fábrica no necesita un PID (capítulo #nr("cap-31")), sino una #strong[secuencia]. Este capítulo trata de cómo se construyen, primero con contactores, como se hicieron durante medio siglo y se sigue haciendo la potencia y la seguridad, y después con el #strong[autómata programable] (PLC, del inglés #emph[programmable logic controller]). Por debajo está la lógica digital de los capítulos #nr("cap-9") y #nr("cap-29")\; lo que cambia es el entorno: 24 V, cables de veinte metros, motores de 400 V y personas cerca.

#nota[
  Las normas que gobiernan el oficio son la IEC 61131-2 (el equipo del autómata), la IEC 61131-3 (sus lenguajes), la IEC 60848 (el GRAFCET) y la IEC 60204-1 y la ISO 13850 (la parada de emergencia). Las comunicaciones del autómata están en las secciones #nr("sec-new-44-modbus") y #nr("sec-new-44-campo").
]

== Lógica Cableada: Contactores y el Circuito de Mando <sec-new-automatas.1>

=== El contactor

Un #strong[contactor] es un relé (sección #nr("sec-20.3")) hecho para potencia: tres #strong[contactos principales] (bornes 1-2, 3-4 y 5-6) para la corriente de un motor, con cámaras que apagan el arco, una bobina (A1-A2), normalmente de 24 V en continua o de 230 V en alterna, y #strong[contactos auxiliares] para el mando. En estos, la primera cifra es la posición y la segunda la función: 1-2 cerrado, 3-4 abierto (13-14 es el primer auxiliar abierto, 21-22 el segundo, cerrado); 95-96 y 97-98 son los del relé térmico.

Se elige por su #strong[categoría de empleo] (IEC 60947-4-1): AC-1 para cargas resistivas, AC-3 para arrancar motores de jaula y desconectarlos en marcha, AC-4 para frenar por contracorriente o mover a impulsos. Un mismo contactor puede admitir 40 A en AC-1 y 25 A en AC-3, porque al arrancar un motor cierra sobre seis o siete veces su corriente nominal. El contactor no protege: del cortocircuito se encargan los fusibles o el magnetotérmico (sección #nr("sec-10.3")), y de la sobrecarga el #strong[relé térmico] F2, que abre su contacto 95-96 si el motor se calienta; el #strong[guardamotor] reúne las dos funciones.

=== Fuerza, mando y la autorretención

Un automatismo cableado se dibuja en dos esquemas (figura #nr("fig-new-automatas.1")). El #strong[de fuerza] lleva la energía de la red de 400 V (sección #nr("sec-new-24-trifasica")) al motor a través de la protección, el contactor y el relé térmico. El #strong[de mando] decide cuándo se cierra el contactor: una línea de 24 o 230 V con pulsadores, contactos auxiliares y bobinas, dibujada en vertical entre dos barras. Las letras clásicas son KM para los contactores, S para los pulsadores, F para las protecciones, H para las lámparas; la IEC 81346-2 propone otras (QA para el contactor, SF para el pulsador, BG para un detector), que se van extendiendo. El mando es lógica de Boole (sección #nr("sec-9.1")) escrita con contactos: en serie, Y; en paralelo, O; un contacto cerrado, la negación.

El circuito más importante tiene cuatro elementos: la marcha S1, abierta; en paralelo con ella, el auxiliar 13-14 del propio KM1; y en serie con los dos, el paro S0, cerrado, y el 95-96 del relé térmico. Al pulsar S1 la bobina se excita, KM1 cierra su 13-14 y ese contacto la sigue alimentando al soltar S1: es la #strong[autorretención]. Con S0 y S1 valiendo 1 cuando se pulsan, es un biestable (sección #nr("sec-29.4")):

#ec[$ "KM1" = ( "S1" + "KM1" ) dot.op overline("S0") dot.op overline("F2") $]

Con marcha y paro pulsados a la vez el motor se para: es un circuito con #strong[prioridad de paro]. Tiene además dos virtudes de seguridad que no están en la ecuación. Si se va la tensión, el contactor cae y #strong[no vuelve a arrancar solo] cuando vuelve. Y el paro es cerrado a propósito: si se rompe su cable o se afloja un borne, la máquina se para, en lugar de quedarse sin paro sin que nadie lo sepa. Los paros y las protecciones se cablean siempre así.

#figura("aut-arranque-directo.svg", 70%, [Arranque directo de un motor trifásico. Fuerza: protección Q1, contactos principales de KM1, relé térmico F2 y motor. Mando: el paro S0 y el contacto 95-96 de F2 en serie, y la marcha S1 en paralelo con el contacto 13-14 de KM1, que retiene la bobina.]) <fig-new-automatas.1>

Para invertir el giro se usan dos contactores que alimentan el motor con dos fases intercambiadas; cerrados a la vez, cortocircuitarían esas fases. Lo impiden un #strong[enclavamiento eléctrico] (un contacto cerrado de cada contactor en serie con la bobina del otro) y uno #strong[mecánico]. Hacen falta los dos: el eléctrico protege contra pulsar los dos pulsadores; el mecánico, contra un contactor con los contactos soldados, que tiene la bobina sin tensión y su auxiliar cerrado. Con un autómata, el enclavamiento por programa se añade a estos dos, no los sustituye.

=== El arranque estrella-triángulo

Un motor de inducción arrancado en directo toma de seis a ocho veces su corriente nominal (sección #nr("sec-33.13")), y en motores medianos esa punta no se admite. El arranque más sencillo para reducirla es el #strong[estrella-triángulo], para motores cuyo devanado trabaja en triángulo a la tensión de la red (en la de 400 V, un motor de 400/690 V). Arranca en estrella, con cada devanado a 400/√3 = 230,9 V, y pasa a triángulo cerca de su velocidad. En estrella, la corriente de cada devanado baja en √3 y la de línea es la del devanado (en triángulo es √3 veces mayor), así que la corriente de línea baja a la tercera parte; el par, proporcional al cuadrado de la tensión, también:

#ec[$ I_("arr,Y") = (I_("arr,Δ"))/(3) quad quad T_("arr,Y") = (T_("arr,Δ"))/(3) $]

Un motor de 11 kW con 21 A nominales a 400 V en triángulo y una corriente de arranque de 7 veces la nominal toma 147 A en directo y 49 A en estrella. El precio es el par: vale para ventiladores, bombas centrífugas y máquinas que arrancan en vacío, no para una cinta cargada.

El esquema (figura #nr("fig-new-automatas.2")) tiene tres contactores: KM1, de línea, alimenta U1-V1-W1; KM3 une U2-V2-W2 para formar la estrella; KM2 los lleva a las fases para el triángulo. En marcha, KM1 y KM2 llevan la corriente de devanado, I#sub[n]/√3 = 12,12 A: se eligen para el 58 % de la nominal en AC-3, y KM3, que solo trabaja al arrancar, para el 33 % (7,0 A). El relé térmico, tras KM1, se ajusta también a 12,12 A.

#importante[
  KM2 y KM3 cerrados a la vez son un cortocircuito entre fases. Además de los enclavamientos, el paso a triángulo necesita una #strong[pausa]: se abre KM3, se esperan unas decenas de milisegundos y se cierra KM2. Con tiempos típicos de 25 ms para cerrar un contactor y 15 ms para abrirlo, sin pausa los contactos de KM2 tocarían 10 ms después de separarse los de KM3, y el arco de KM3 puede durar hasta el siguiente paso por cero de la corriente, 10 ms a 50 Hz. Con 50 ms de pausa el hueco es de 60 ms.
]

#figura("aut-estrella-triangulo.svg", 100%, [Arranque estrella-triángulo. Fuerza: KM1 alimenta U1-V1-W1, KM3 une U2-V2-W2 (estrella) y KM2 los lleva a las fases (triángulo). Mando: la autorretención de KM1, el temporizador KT y los enclavamientos de KM2 y KM3. A la derecha, las tres bobinas en el simulador de este capítulo: 6 s en estrella y 50 ms de pausa.]) <fig-new-automatas.2>

Durante la pausa el motor queda sin alimentación y se desfasa de la red, y al cerrar en triángulo hay un pico de corriente (es una #strong[transición abierta]). Hoy, en potencias medianas, el estrella-triángulo compite con el arrancador suave de tiristores (sección #nr("sec-10.1")) y con el variador de frecuencia.

#strong[En el banco.] Con la fuerza abierta, alimentar solo el mando y comprobar la secuencia de los contactores (se oyen) y que el paro funciona en todos los estados, también con la marcha pulsada. Empujar a mano la armadura de un contactor y ver que el otro no entra. Con una pinza con captura de pico, la corriente de arranque en estrella debe salir cerca de un tercio de la de directo.

== Sensores y Actuadores Industriales <sec-new-automatas.2>

Los sensores de un automatismo casi nunca miden: #strong[detectan]. Dan un 1 o un 0 según haya o no una pieza o un cilindro esté o no en su final. Los analógicos de la sección #nr("sec-35.1") también se usan, pero la mayoría de las entradas son de este tipo.

=== Finales de carrera y detectores de proximidad

El #strong[final de carrera] es un interruptor accionado por la máquina: robusto, fácil de diagnosticar y el único que se admite sin más en funciones de seguridad si tiene #strong[maniobra positiva de apertura] (una flecha dentro de un círculo): el contacto cerrado se abre por empuje directo del actuador, sin muelles intermedios, y se separa aunque se haya soldado (IEC 60947-5-1, anexo K). En contra, el desgaste, los rebotes (sección #nr("sec-20.10")) y que necesita tocar la pieza.

El #strong[detector inductivo] tiene un oscilador cuya bobina crea un campo de alta frecuencia frente a su cara; un metal cercano absorbe energía por corrientes de Foucault, la oscilación se amortigua y la salida conmuta (sección #nr("sec-35.5")). Detecta solo metales, sin contacto ni desgaste. Tres datos lo describen (IEC 60947-5-2):

- La #strong[distancia nominal] S#sub[n], medida con un blanco normalizado: un cuadrado de acero dulce de 1 mm de espesor, de lado igual al diámetro de la cara sensible o a 3·S#sub[n] si es mayor.
- La #strong[distancia de trabajo asegurada] S#sub[a], la que se usa para diseñar: hasta 0,81·S#sub[n], porque la de cada ejemplar puede ser un 10 % menor que la nominal y variar otro 10 % con la tensión y la temperatura (0,9 × 0,9 = 0,81).
- El #strong[factor de corrección] del material: acero inoxidable de 0,6 a 1, latón y aluminio de 0,35 a 0,5, cobre de 0,25 a 0,45.

#ejemplo[
  Un M18 enrasado tiene S#sub[n] = 5 mm: con acero, S#sub[a] = 0,81 × 5 = 4,05 mm. Con aluminio, en el peor caso, 4,05 × 0,35 = 1,42 mm: montado a 2 mm, unos ejemplares detectarán la pieza y otros no. El no enrasado del mismo tamaño (S#sub[n] = 8 mm, que pide espacio libre de metal alrededor) da 2,27 mm y resuelve el problema.
]

El #strong[capacitivo] usa un campo eléctrico y detecta casi cualquier material, plásticos, granulados y líquidos (también a través de la pared de un depósito de plástico), a cambio de ser más sensible a la humedad y la suciedad. Los #strong[fotoeléctricos] pueden ser de barrera (emisor y receptor enfrentados, el de más alcance), réflex (contra un reflector, con luz polarizada para no confundir una pieza brillante con él) o difusos (la luz vuelve reflejada por la propia pieza, el de menos alcance y el que más depende del color).

=== Cómo se conectan

Casi todos trabajan a 24 V en continua, con un código de colores fijo: marrón al positivo, azul al negativo, negro a la salida y blanco a una segunda salida. Al elegir uno hay que decidir:

- #strong[PNP o NPN.] El PNP conmuta el positivo: al detectar pone 24 V en el hilo negro y entrega corriente a una carga que va a 0 V. El NPN une el negro a 0 V y absorbe la corriente de una carga que va a +24 V. En Europa se usa casi siempre PNP.
- #strong[NA o NC]: si la salida se activa al detectar o al dejar de detectar.
- #strong[Tres o dos hilos.] El de dos hilos va en serie con la carga, como un interruptor, y se alimenta de la corriente que pasa: en reposo deja una #strong[corriente residual] y conduciendo le #strong[cae una tensión] de varios voltios, dos cosas que hay que comprobar con la entrada (sección #nr("sec-new-automatas.3")).

Los sensores IO-Link añaden un canal de comunicación por el mismo hilo negro (sección #nr("sec-new-44-campo")).

=== Electroválvulas y cilindros

El autómata gobierna bobinas de contactores y relés, lámparas y, sobre todo, #strong[electroválvulas] para cilindros neumáticos. La 5/2 (cinco vías, dos posiciones) mueve un cilindro de doble efecto. #strong[Monoestable], con una bobina y retorno por muelle, vuelve al reposo al quitarle la tensión; #strong[biestable], con dos bobinas, se queda en la última posición mandada: es una memoria neumática. La 5/3 de centro cerrado bloquea el cilindro donde esté. Elegir entre ellas es una decisión de seguridad, porque fija qué hace la máquina si falla la energía. La posición del cilindro la dan detectores magnéticos montados en su camisa, que ven el imán del émbolo. Las bobinas de 24 V consumen de 1 a 5 W y, al cortarlas, dan el pico de toda inductancia (sección #nr("sec-20.3")); muchas lo traen limitado en el conector.

== El Autómata Programable: Arquitectura y Cableado <sec-new-automatas.3>

=== Qué hay dentro

Un autómata es un ordenador hecho para el armario eléctrico. Su CPU es un microcontrolador o un procesador como los del capítulo #nr("cap-38")\; lo que lo define es lo que la rodea: fuente de 24 V, #strong[módulos de entradas y salidas] aislados por optoacoplador (sección #nr("sec-20.2")), memoria que conserva los datos sin tensión y puertos de comunicación. Los compactos lo llevan todo en una caja con unas decenas de E/S; los modulares montan CPU y tarjetas en un perfil y llegan a miles de puntos, a menudo repartidos por la máquina en #strong[periferia descentralizada] unida por un bus de campo. La IEC 61131-2 fija lo que debe soportar: temperatura, vibración, inmunidad electromagnética (capítulo #nr("cap-32")) y el comportamiento de sus E/S.

=== Las entradas de 24 V

Una entrada de 24 V es una resistencia de unos kilohmios (o un limitador de corriente) en serie con el LED de un optoacoplador y un filtro. La IEC 61131-2 define tres tipos de entrada que absorben corriente, cada uno con una zona en que tiene que leer 1, otra en que tiene que leer 0 y una de transición donde puede leer cualquier cosa:

#tabla(none, columns: 3, align: (left, left, left,),
  [Tipo], [Lee 1], [Lee 0],
  [1], [15 a 30 V y 2 a 15 mA], [hasta 5 V, o hasta 15 V con 0,5 mA como máximo],
  [2], [11 a 30 V y 6 a 30 mA], [hasta 5 V, o hasta 11 V con 2 mA como máximo],
  [3], [11 a 30 V y 2 a 15 mA], [hasta 5 V, o hasta 11 V con 1,5 mA como máximo],
)

El tipo 1 es para contactos y detectores de tres hilos; los tipos 2 y 3 admiten además los de dos hilos, y el 3 lo hace sin el consumo del 2: es el más usado hoy.

Una entrada que absorbe corriente necesita alguien que se la dé. De ahí las dos maneras de cablear (figura #nr("fig-new-automatas.3")): la #strong[lógica positiva], con entradas #strong[sumidero] (#emph[sink]), su común a 0 V y detectores PNP, que es la de Europa; y la #strong[negativa], con entradas #strong[fuente] (#emph[source]), el común a +24 V y detectores NPN. Los nombres confunden porque cada uno describe lo que hace su lado con la corriente: el detector PNP es una fuente y va a una entrada sumidero. Muchos autómatas sirven para las dos lógicas según dónde se lleve el común de cada grupo de entradas, pero no se pueden mezclar en un mismo grupo.

#figura("aut-cableado-24v.svg", 100%, [Cableado de entradas a 24 V. (a) Lógica positiva: detector PNP y entrada sumidero, con el común a 0 V. (b) Lógica negativa: detector NPN y entrada fuente, con el común a +24 V. (c) Detector de dos hilos con una resistencia R#sub[p] en paralelo con la entrada para absorber su corriente residual.]) <fig-new-automatas.3>

#ejemplo[
  Un detector de dos hilos tiene 1,5 mA de corriente residual y 7 V de caída, y se conecta a una entrada de tipo 1 que se comporta como 4,7 kΩ (5,11 mA a 24 V). En reposo, la corriente residual le pone 1,5 mA × 4,7 kΩ = 7,05 V: más de 5 V con más de 0,5 mA, zona de transición; la entrada puede leer 1 sin pieza. Una resistencia R#sub[p] en paralelo se lleva parte de la corriente; para no pasar de 5 V, el conjunto no puede superar 5 V/1,5 mA = 3 333 Ω:

  #ec[$ R_("p") <= (V_("0,máx") dot.op R_("ent"))/(I_("res") dot.op R_("ent") - V_("0,máx")) = ("5" dot.op "4 700")/("7,05" - "5") = "11,46 kΩ" $]

  Con 10 kΩ la entrada queda a 4,80 V en reposo. Conduciendo recibe 24 − 7 = 17 V y lee 1; el detector lleva 5,32 mA y R#sub[p] disipa 29 mW (90 mW con la fuente a 30 V). Pero con la fuente a 21 V la entrada recibe 14 V, menos de los 15 V del tipo 1: la resistencia arregla la corriente residual, no la caída, y hace falta una fuente de al menos 22 V. Con una entrada de tipo 3, que lee 0 hasta 11 V con 1,5 mA y 1 desde 11 V, el detector funciona sin resistencia y desde 18 V de fuente.
]

#comprobacion[
  El circuito (c) de la figura #nr("fig-new-automatas.3") con ngspice: en reposo, 7,05 V sin R#sub[p] y 4,80 V con 10 kΩ; conduciendo, 14,0 V con la fuente a 21 V, 15,0 V a 22 V y 17,0 V a 24 V, con 5,32 mA por el detector.
]

=== Las salidas

#tabla(none, columns: 4, align: (left, left, left, left,),
  [Salida], [Cargas], [A favor], [En contra],
  [Relé], [continua o alterna, hasta unos 2 A], [aislamiento, cualquier carga], [lenta (unos 10 ms), vida limitada en maniobras],
  [Transistor], [continua, típicamente 0,5 A a 24 V], [rápida, sin desgaste, protegida contra cortocircuito], [solo continua, una polaridad],
  [Triac], [alterna], [sin desgaste], [corriente de fuga],
)

Las de transistor son, como las entradas, de lógica positiva (PNP) o negativa, y casi todas llevan un Zener que descarga deprisa las cargas inductivas, pero con un límite de energía por maniobra: una bobina grande conmutada a menudo necesita su propio diodo o varistor (sección #nr("sec-20.3")). Para más corriente, la salida gobierna un contactor; para conmutar alterna muchas veces, un relé de estado sólido (sección #nr("sec-20.11")). Las #strong[analógicas] trabajan con 0 a 10 V o con el bucle de 4 a 20 mA del problema #nr("prob-20.C"), con convertidores de 12 a 16 bits (capítulo #nr("cap-34")), y son lentas: milisegundos.

== El Ciclo de Scan y el Tiempo de Respuesta <sec-new-automatas.4>

=== La imagen de proceso

Un autómata no ejecuta su programa cuando cambia una entrada, sino una y otra vez, en el #strong[ciclo de scan] (figura #nr("fig-new-automatas.4")). Cada vuelta:

+ #strong[Escribe las salidas]: copia a los bornes la imagen de salidas que calculó la vuelta anterior.
+ #strong[Lee las entradas]: copia el estado de todos los bornes a la #strong[imagen de proceso de las entradas].
+ #strong[Ejecuta el programa] entero, leyendo solo esa imagen y escribiendo solo en la de salidas.

Entre vueltas atiende las comunicaciones y se autodiagnostica. La duración de una vuelta, el #strong[tiempo de ciclo] T#sub[c], va de un milisegundo a unas decenas y no es constante: depende de las ramas que se ejecuten. Durante una vuelta las entradas no cambian aunque cambien los bornes: el programa ve una fotografía coherente del proceso, y una entrada que se usa en diez sitios vale lo mismo en los diez. Es el registro de entrada de un circuito síncrono (sección #nr("sec-29.8")): el autómata es una máquina de estados con un reloj de periodo T#sub[c], y la imagen de entradas es su sincronizador (sección #nr("sec-9.9")).

=== El tiempo de respuesta

#deduccion[El tiempo de respuesta de un autómata cíclico][
  #eclabel[#strong[Ec. 1 — Tiempo de respuesta]]
  #ec[$ t_("e") + T_("c") + t_("s") <= t_("r") <= t_("e") + 2 dot.op T_("c") + t_("s") $]

  #strong[Origen.] El filtro de la entrada retrasa el cambio t#sub[e]. Si llega justo antes de una lectura, el programa lo procesa en esa vuelta y la salida se escribe al empezar la siguiente: un ciclo. Si llega justo después de una lectura, espera casi un ciclo a la siguiente y luego otro: dos. El módulo de salida añade t#sub[s].

  #strong[Media.] Si los cambios llegan sin relación con el ciclo, la respuesta se reparte por igual entre los extremos y su media es t#sub[e] + 1,5·T#sub[c] + t#sub[s].

  #strong[Dominio de validez.] Un programa que accede a la periferia directamente, o en una tarea de interrupción, tiene otra respuesta; y si encadena la decisión a través de varias vueltas (una memoria que se calcula después de donde se usa), cada vuelta suma un T#sub[c].
]

Con T#sub[c] = 10 ms, un filtro de 3 ms y salida de transistor, la respuesta va de 13 a 23 ms. El simulador de este capítulo (un programa de Python que reproduce el ciclo tal como se ha descrito) lo confirma con 4 000 cambios en instantes al azar: mínimo 13,0 ms, máximo 23,0 ms, media 18,0 ms, uniformes entre los extremos.

#figura("aut-ciclo-scan.svg", 100%, [El ciclo de scan. A la izquierda, sus pasos. En el centro, el mejor y el peor caso con T#sub[c] = 10 ms y un filtro de 3 ms: la entrada cambia 0,2 ms antes o después del último instante que alcanza una lectura, y la salida responde en 13,2 o en 22,8 ms. A la derecha, 4 000 respuestas simuladas: uniformes entre 13 y 23 ms.]) <fig-new-automatas.4>

Lo que suele importar no es la media sino la #strong[dispersión], un ciclo entero: una cinta a 0,2 m/s que se para cuando una pieza llega a un detector recorre, desde la detección, una distancia que varía 2 mm de una pieza a otra con T#sub[c] = 10 ms (el problema #nr("prob-new-automatas.A") lo calcula entero). Si no se admite, se baja el ciclo, se lleva esa entrada a una interrupción o, lo más habitual, se pone un tope mecánico.

=== Pulsos más cortos que el ciclo

Un pulso más corto que T#sub[c] puede caer entero entre dos lecturas. Si llega sin relación con el ciclo, la probabilidad de verlo es t#sub[p]/T#sub[c]\; solo uno que dure al menos un ciclo (y más que el filtro) se ve siempre. En el simulador, con T#sub[c] = 10 ms y 4 000 pulsos de cada duración, se ven el 19 % de los de 2 ms, el 51 % de los de 5 ms, el 75 % de los de 7,5 ms y todos los de 10 ms o más. Es el error clásico al contar piezas en una cinta rápida, y para eso están los #strong[contadores rápidos], que cuentan por hardware, y las #strong[entradas de interrupción] (sección #nr("sec-38.4")).

=== Vigilancia del ciclo y tareas

Si una vuelta supera el tiempo máximo configurado, el perro guardián del ciclo (sección #nr("sec-38.7")) lleva el autómata a STOP, con las salidas a 0 o al valor configurado. Por eso en un autómata no se escriben bucles que esperan: el programa entero es el cuerpo de un bucle, y esperar es dejar pasar vueltas. Además de la tarea cíclica hay #strong[tareas periódicas], con su periodo y su prioridad, y tareas disparadas por eventos; un PID (sección #nr("sec-31.5")) va en una tarea periódica, porque su discretización supone un periodo de muestreo constante.

== Los Lenguajes de la Norma IEC 61131-3 <sec-new-automatas.5>

=== El modelo de software

La IEC 61131-3 (primera edición en 1993, tercera en 2013, cuarta en 2025) unificó la programación de los autómatas, que hasta entonces dependía de cada fabricante. Un autómata tiene una #strong[configuración] con #strong[recursos] (procesadores) que ejecutan #strong[tareas], y estas, #strong[unidades de organización de programa] (POU) de tres clases: #strong[funciones], sin memoria (una suma, una comparación); #strong[bloques de función] (FB), con memoria propia, que se declaran como instancias, como objetos (cada temporizador es una instancia); y #strong[programas], que llama la tarea. Las variables tienen tipo (BOOL, INT, REAL, TIME, que se escribe T\#1.5s) y las de E/S se asocian a los bornes con direcciones como %IX0.0 (entrada, bit 0 del módulo 0) o %QX0.1 (salida); los fabricantes usan además las suyas, como I0.0. La norma define cinco lenguajes.

=== Diagrama de contactos (LD)

El #strong[diagrama de contactos] (#emph[ladder]) es el esquema de mando girado noventa grados: dos barras verticales y, entre ellas, #strong[redes] con contactos a la izquierda y bobinas a la derecha (figura #nr("fig-new-automatas.5")). Contacto abierto `-| |-`: conduce si la variable vale 1; cerrado `-|/|-`: si vale 0; de flanco `-|P|-` y `-|N|-`: solo en la vuelta en que la variable sube o baja. Bobina `-( )-`, negada `-(/)-` y de memoria `-(S)-` y `-(R)-`, que ponen la variable a 1 o a 0 y la dejan. Se ejecuta red a red, de arriba abajo. Lo leen sin esfuerzo los electricistas que mantienen la máquina y permite ver en línea qué conduce; por eso sigue siendo el más usado. Su límite es el cálculo.

#importante[
  En LD, un «contacto abierto» no es un pulsador normalmente abierto: es «la entrada vale 1». El paro S0 se cablea cerrado, así que su entrada vale 1 mientras #strong[no] se pulsa, y se programa con un contacto #strong[abierto]: la autorretención en LD es S1 en paralelo con KM1, en serie con S0, todos abiertos. Escribirlo con un contacto cerrado, «para que se parezca al esquema», da una máquina que solo arranca con el paro pulsado. Es el error más frecuente al pasar de la lógica cableada al autómata.
]

Dos reglas más: una salida se escribe en #strong[una sola] bobina (si aparece en dos redes, gana la última; S y R son la excepción, pensadas para eso), y una memoria calculada en una red y usada en otra anterior llega con una vuelta de retraso.

=== Los bloques estándar

#tabla(none, columns: 2, align: (left, left,),
  [Bloque], [Qué hace],
  [TON], [Retardo a la conexión: Q pasa a 1 cuando IN lleva PT a 1; IN a 0 pone a 0 Q y el tiempo transcurrido ET],
  [TOF], [Retardo a la desconexión: Q sube con IN y se mantiene durante PT después de que IN baje],
  [TP], [Impulso: un flanco de IN da un pulso de duración PT, que no se alarga aunque IN vuelva a subir],
  [CTU, CTD, CTUD], [Contadores: CV cuenta los flancos de CU (o CD) y Q indica que se ha llegado a PV],
  [R\_TRIG, F\_TRIG], [Flanco de subida y de bajada: Q vale 1 durante una vuelta],
  [SR, RS], [Biestables: SR con prioridad de puesta a 1 (domina S1), RS con prioridad de puesta a 0 (domina R1)],
)

=== Bloques funcionales, texto estructurado y lista de instrucciones

El #strong[diagrama de bloques funcionales] (FBD) dibuja el programa como un circuito de puertas, bloques y cajas aritméticas: natural para quien piensa en lógica combinacional y para las señales analógicas, y el lenguaje habitual de los autómatas de seguridad, que solo admiten bloques certificados.

#figura("aut-ld-fbd.svg", 70%, [La autorretención con arranque retardado 2 s, en diagrama de contactos (arriba) y en bloques funcionales (abajo). El paro S0, cableado normalmente cerrado, se programa con un contacto abierto.]) <fig-new-automatas.5>

El #strong[texto estructurado] (ST) es un lenguaje de alto nivel de la familia del Pascal, con `:=`, IF, CASE y FOR: el de los cálculos y de las máquinas de estados grandes, y el que se impone en los programas nuevos. La figura #nr("fig-new-automatas.5") en ST:

#codigo[```st
VAR
    MARCHA : BOOL;                          (* self-hold memory *)
    T_ARR  : TON;                           (* start delay *)
END_VAR
MARCHA := (S1 OR MARCHA) AND S0 AND F2;     (* S0 and F2 wired NC *)
T_ARR(IN := MARCHA, PT := T#2s);
KM1 := T_ARR.Q;
```]

Un bloque de función se llama con sus entradas por nombre y sus salidas se leen de la instancia (T\_ARR.Q). Hay que llamarlo #strong[en cada vuelta]: un TON al que no se llama no se entera de que pasa el tiempo.

La #strong[lista de instrucciones] (IL) era un lenguaje de tipo ensamblador con un acumulador: `LD S1`, `OR MARCHA`, `AND S0`, `AND F2`, `ST MARCHA`. La tercera edición de la norma la declaró obsoleta y la cuarta la ha suprimido; se encuentra en programas antiguos, pero no conviene empezar nada nuevo en ella.

=== El diagrama funcional secuencial (SFC)

El #strong[SFC] no sirve para escribir operaciones sino para estructurar un programa secuencial en #strong[etapas] y #strong[transiciones], cuyas acciones y condiciones se escriben en los otros lenguajes. Deriva del GRAFCET y comparte su dibujo, no todas sus reglas: el GRAFCET es un lenguaje de #strong[especificación] y el SFC uno de #strong[programación]. Sus acciones llevan un calificador: N (mientras la etapa esté activa), S y R (memorizar y borrar), L (limitada en el tiempo), D (retardada), P (un impulso al activarse).

=== Un temporizador que no da el tiempo pedido

El ciclo se cuela en los tiempos. Un intermitente se suele programar con dos TON que se encienden uno a otro:

#codigo[```st
T1(IN := NOT T2.Q, PT := T#500ms);
T2(IN := T1.Q,     PT := T#500ms);
H1 := T1.Q;                                 (* 1 Hz blinker... almost *)
```]

Un TON solo se actualiza cuando se le llama, así que su retardo real es el primer múltiplo de T#sub[c] que no es menor que PT, y cada reinicio pierde una vuelta con la entrada a 0. En el simulador, el periodo sale de 1 020 ms con T#sub[c] = 10 ms, de 1 022 ms con 7 ms y de 1 002 ms con 1 ms:

#ec[$ T = 2 dot.op ⌈ (P T)/(T_("c")) ⌉ dot.op T_("c") + 2 dot.op T_("c") $]

Un 2 % no importa en una lámpara y sí en algo que mide tiempo: para eso están el reloj del sistema, las tareas periódicas y las marcas de reloj del autómata.

== GRAFCET (IEC 60848) <sec-new-automatas.6>

=== Etapas, transiciones y acciones

El GRAFCET (#emph[Graphe Fonctionnel de Commande Étape Transition], normalizado en la IEC 60848, cuya edición vigente es de 2013) describe un automatismo secuencial antes de programarlo: es la especificación que se discute con quien encarga la máquina. Sus elementos (figura #nr("fig-new-automatas.6")):

- #strong[Etapas], cuadrados numerados, activas o no; el estado de la etapa i es una variable X#sub[i]. Las #strong[iniciales], de cuadrado doble, son las activas al arrancar.
- #strong[Transiciones], trazos entre etapas, cada una con su #strong[receptividad]: una condición sobre las entradas, las etapas y el tiempo. «↑B1» es el flanco de subida de B1; «1,5 s/X3» se hace verdadera 1,5 s después de activarse la etapa 3.
- #strong[Uniones orientadas], de arriba abajo salvo que una flecha diga lo contrario.
- #strong[Acciones], a la derecha de cada etapa. Una #strong[continua] (KM1) vale 1 mientras la etapa está activa, y puede ser #strong[condicional]\; una #strong[memorizada] (C := C + 1, con ↑ si se ejecuta al activarse la etapa) cambia una variable y la deja.

Es una máquina de estados de tipo Moore (sección #nr("sec-29.5")) en la que pueden estar activas varias etapas a la vez.

=== Las cinco reglas de evolución

+ #strong[Situación inicial]: al empezar están activas las etapas iniciales, y solo ellas.
+ #strong[Franqueo de una transición]: está #strong[validada] cuando todas sus etapas anteriores están activas, y se #strong[franquea], obligatoriamente, cuando está validada y su receptividad es verdadera.
+ #strong[Evolución de las etapas]: franquearla activa todas sus etapas siguientes y desactiva todas las anteriores, a la vez.
+ #strong[Franqueos simultáneos]: varias transiciones franqueables a la vez se franquean a la vez.
+ #strong[Activación y desactivación simultáneas]: una etapa que debe activarse y desactivarse a la vez queda activa.

=== Divergencias y convergencias

- La #strong[divergencia en O] (selección): de una etapa salen varias transiciones bajo un trazo simple, y se sigue la rama cuya receptividad se cumpla. Si pudieran cumplirse dos, la regla 4 activaría las dos: las receptividades de una divergencia en O tienen que ser #strong[excluyentes], y garantizarlo es cosa de quien diseña (el SFC, en cambio, admite evaluarlas de izquierda a derecha y quedarse con la primera).
- La #strong[divergencia en Y] (secuencias simultáneas): una transición sobre un trazo doble activa varias ramas, que avanzan cada una por su cuenta. La #strong[convergencia en Y], bajo otro trazo doble, solo está validada cuando han terminado todas: es la sincronización.

#figura("aut-grafcet-elementos.svg", 70%, [Los elementos del GRAFCET. Etapa inicial (cuadrado doble), etapas, transiciones con su receptividad y acciones; a la izquierda, divergencia y convergencia en O, con receptividades excluyentes; a la derecha, en Y, con trazo doble, que sincroniza las dos ramas.]) <fig-new-automatas.6>

Un franqueo no dura nada. Si al activarse una etapa la receptividad siguiente ya es verdadera, se franquea en el mismo instante, y así hasta una #strong[situación estable], en la que ninguna transición es franqueable. Las etapas recorridas así tienen una actividad de duración nula, una #strong[evolución fugaz]: sus acciones continuas no se ejecutan (las memorizadas, sí). Con 0 → 1 → 2 y las dos receptividades verdaderas a la vez, el intérprete del simulador franquea las dos con la misma imagen y la situación estable es la etapa 2.

=== Del GRAFCET al programa

Un GRAFCET se traduce con un método fijo: una variable por etapa y, en cada vuelta, cuatro bloques #strong[en este orden]:

+ #strong[Inicialización]: en la primera vuelta (o tras una emergencia), las etapas iniciales a 1 y las demás a 0.
+ #strong[Transiciones]: cada una, la Y de sus etapas anteriores y su receptividad, con las etapas como estaban al empezar la vuelta. Calcularlas todas antes de tocar ninguna etapa respeta la regla 4.
+ #strong[Evolución]: primero todas las desactivaciones y después todas las activaciones, para respetar la regla 5.
+ #strong[Acciones]: cada salida una sola vez, como la O de las etapas en que actúa; los temporizadores y contadores, con las etapas ya actualizadas.

El problema #nr("prob-new-automatas.A") lo aplica entero. Esta traducción franquea #strong[una transición por vuelta]: una evolución fugaz dura un ciclo por etapa en lugar de cero, y sus acciones continuas aparecen durante ese ciclo. Casi nunca importa; si importa, los bloques 2 y 3 se repiten en un bucle hasta que no se franquee ninguna transición.

== Seguridad de Máquinas: la Parada de Emergencia <sec-new-automatas.7>

La seguridad de una máquina no se añade al final: empieza en la evaluación de riesgos (ISO 12100) y se resuelve, por este orden, con un diseño que elimine el peligro, con resguardos y dispositivos de protección y con información. Esta sección no sustituye a esas normas; recoge lo que quien diseña la electrónica de una máquina tiene que saber de la función que todos identifican con la seguridad y que es solo una medida complementaria.

=== La parada de emergencia y las categorías de parada

La parada de emergencia (ISO 13850) está para que quien ve un peligro pueda pararlo:

- Tiene #strong[prioridad] sobre cualquier otra función y modo de funcionamiento.
- Su accionador es una seta roja, sobre fondo amarillo si lo hay, al alcance desde cada puesto y con #strong[enclavamiento mecánico]: pulsada, se queda así hasta rearmarla a mano (los dispositivos, en la IEC 60947-5-5). Sus contactos son de #strong[maniobra positiva de apertura].
- #strong[Rearmarla no pone la máquina en marcha]: solo permite volver a arrancarla con la marcha normal.
- Para la máquina con una #strong[categoría de parada] 0 o 1.

Las categorías de parada son de la IEC 60204-1, la norma del equipo eléctrico de las máquinas: la #strong[0] corta de inmediato la energía de los accionadores (parada no controlada); la #strong[1] es una parada controlada con la energía mantenida hasta detenerse, y cortada después (un variador que frena con una rampa y luego desconecta); la #strong[2], una parada controlada sin corte de energía, que no sirve como parada de emergencia.

=== Por qué no la gestiona el autómata

Un autómata normal no es un equipo de seguridad: una CPU bloqueada con las salidas a 1, un transistor de salida en cortocircuito o un error de programa dejarían la emergencia sin efecto. Por eso la parada de emergencia actúa por #strong[hardware], cortando la alimentación de contactores y válvulas, y el autómata solo #strong[se entera] por una entrada, para volver a su estado inicial y avisar. El corte lo hace un #strong[relé de seguridad] (figura #nr("fig-new-automatas.7")), o un autómata de seguridad certificado si hay muchas funciones de este tipo. El relé lee la seta por #strong[dos canales] y detecta un cruce entre ellos o que uno no abra; sus salidas son relés redundantes de #strong[contactos guiados] (los abiertos y cerrados de un relé unidos mecánicamente, de modo que si uno se suelda los otros no cambian y el fallo se ve); y vigila los contactores por un #strong[bucle de realimentación] con sus auxiliares cerrados de tipo #strong[espejo] (IEC 60947-4-1, anexo F: no pueden estar cerrados mientras lo esté un contacto principal), en serie con el rearme. Si un contactor se ha soldado, el relé no rearma.

#figura("aut-parada-emergencia.svg", 70%, [Parada de emergencia de categoría 0 con un relé de seguridad (bornes habituales; cada fabricante tiene los suyos). La seta S5 abre dos canales (S11-S12 y S21-S22); las salidas 13-14 y 23-24 alimentan KM1 y KM2, dos contactores en serie en la fuerza; el bucle Y1-Y2 lleva sus contactos espejo y el rearme S6, y el contacto 41-42 informa al autómata.]) <fig-new-automatas.7>

=== Categorías y niveles de prestaciones

Lo fiable que tiene que ser una función de seguridad lo dice la ISO 13849-1 (cuarta edición, de 2023). De la evaluación de riesgos sale el #strong[nivel de prestaciones requerido] PL#sub[r], de a a e, según la gravedad de la lesión, la frecuencia de exposición y la posibilidad de evitarla, y el mando se diseña para alcanzarlo con una de cinco #strong[categorías] de arquitectura (que nada tienen que ver con las de parada): B y 1, de un canal, que pierden la función con un fallo (la 1, con componentes de eficacia probada); 2, de un canal con prueba periódica; 3, de dos canales, en la que un fallo no hace perder la función y algunos se detectan; y 4, en la que todo fallo se detecta a tiempo y su acumulación tampoco la hace perder. El PL alcanzado depende además de la fiabilidad de los componentes y de la cobertura del diagnóstico. El circuito de la figura #nr("fig-new-automatas.7") es la estructura típica de categoría 3 o 4. La IEC 62061 es la alternativa con niveles SIL. El marco legal en la Unión Europea es la Directiva de máquinas 2006/42/CE (en España, el Real Decreto 1644/2008), que el Reglamento (UE) 2023/1230 sustituye a partir del 20 de enero de 2027.

#precaucion[
  Un paro, por bien cableado que esté, no es una parada de emergencia, y la parada de emergencia no protege a quien no ve venir el peligro: para eso están los resguardos con enclavamiento y las barreras fotoeléctricas, que también son funciones de seguridad con su PL#sub[r]. Qué lleva una máquina lo decide su evaluación de riesgos. Sobre el trabajo con tensión, el apéndice #nr("ap-D") y la sección #nr("sec-47.7").
]

== Autómata o Microcontrolador <sec-new-automatas.8>

Un autómata compacto y un Arduino (capítulo #nr("cap-17")) hacen lo mismo en lo esencial: leer entradas, ejecutar un programa en bucle y escribir salidas. La diferencia está en todo lo demás:

#tabla(none, columns: 3, align: (left, left, left,),
  [], [Autómata], [Microcontrolador en placa propia],
  [Entorno], [Ensayado para el armario (IEC 61131-2), E/S de 24 V aisladas y protegidas], [Protecciones, aislamiento y ensayos son trabajo propio],
  [Programa], [IEC 61131-3, legible por el técnico de mantenimiento y modificable en marcha], [C o C++, legible por quien lo escribió],
  [Vida], [Repuestos y herramientas durante décadas], [Lo que dure el fabricante de la placa],
  [Tiempos], [Ciclo de milisegundos; tareas rápidas para lo urgente], [Microsegundos; control total del hardware],
  [Seguridad], [Autómatas y relés de seguridad certificados], [Certificar una función propia es un proyecto en sí],
  [Coste], [Alto por unidad, bajo en ingeniería], [Bajo por unidad, alto en ingeniería],
)

#strong[Autómata] para una máquina o una instalación, que se hacen por unidades, deben mantenerse veinte años y las tocará alguien que no las diseñó; #strong[microcontrolador] para un producto de serie, donde manda el coste por unidad, o donde hacen falta microsegundos o un consumo mínimo. Entre los dos están los #strong[autómatas por software], entornos IEC 61131-3 que corren en un ordenador industrial; hay entornos libres que los ejecutan en una Raspberry Pi (capítulo #nr("cap-18")), con los que se practican todos los ejemplos de este capítulo con unos pulsadores y unos LED.

#tarjeta[
  #formula($ I_("arr,Y") = (I_("arr,Δ"))/("3") quad quad I_("KM1") = I_("KM2") = (I_("n"))/(sqrt("3")) quad quad I_("KM3") = (I_("n"))/("3") $)

  #formula($ S_("a") <= "0,81" dot.op S_("n") dot.op k_("material") $)

  #formula($ R_("p") <= (V_("0,máx") dot.op R_("ent"))/(I_("res") dot.op R_("ent") - V_("0,máx")) $)

  #formula($ t_("e") + T_("c") + t_("s") <= t_("r") <= t_("e") + 2 dot.op T_("c") + t_("s") quad quad P_("detección") = (t_("p"))/(T_("c")) $)
]

== Problemas de Diseño <sec-new-automatas.9>

=== Problema #nr("prob-new-automatas.A") — Una estación de marcado, de la especificación al programa <prob-new-automatas.A>

#strong[Enunciado]

Una cinta movida por un motor trifásico (contactor KM1) lleva piezas de 40 mm a 0,2 m/s, separadas unos 250 mm. Cuando una pieza llega bajo el cilindro neumático 1A, la cinta se para, el cilindro baja, marca la pieza durante #strong[1,5 s] y sube, y la cinta vuelve a arrancar. El cilindro lo mueve una válvula 5/2 monoestable (bobina 1Y1) y tiene dos detectores magnéticos, 1B1 (arriba) y 1B2 (abajo); la pieza la detecta un fotoeléctrico difuso B1, PNP. Hay marcha S1 y paro S0, que termina el ciclo en curso. Cada marcha empieza un lote de #strong[50 piezas], tras el cual la estación se para y enciende H1. Hay parada de emergencia. El autómata tiene un ciclo de 10 ms, entradas con filtro de 3 ms y salidas de transistor; el contactor tarda 25 ms en cerrar y 15 ms en abrir.

#strong[Se pide:] la lista de E/S, el GRAFCET y el programa, y comprobar con una simulación el tiempo de ciclo, la producción y la dispersión de la posición de parada.

#strong[Verificación]

#strong[Entradas y salidas], en lógica positiva y con entradas de tipo 3 (los detectores del cilindro pueden ser de dos hilos): %IX0.0 S0 (paro, cerrado: vale 1 sin pulsar), %IX0.1 S1 (marcha), %IX0.2 B1 (pieza en posición), %IX0.3 1B1 (arriba), %IX0.4 1B2 (abajo), %IX0.5 SEG (contacto del relé de seguridad: 1 si la emergencia está rearmada); %QX0.0 KM1 (cinta), %QX0.1 1Y1 (válvula), %QX0.2 H1 (lote terminado).

#strong[El GRAFCET] (figura #nr("fig-new-automatas.8")). La etapa 0 espera la marcha con el cilindro arriba y la emergencia rearmada. La 1 mueve la cinta hasta ↑B1: el #strong[flanco] y no el nivel, porque al volver a la etapa 1 la pieza recién marcada sigue delante del detector. La 2 baja el cilindro hasta 1B2, la 3 lo mantiene 1,5 s y la 4 lo sube y cuenta la pieza. Tras la 4, una divergencia en O con receptividades excluyentes: a la 1 si el lote no ha terminado y no se ha pedido el paro, a la 0 si no. El paro se recuerda en un biestable RS (PARO), que pone a 1 la pulsación de S0 y borra la etapa 0. 1Y1 es continua en las etapas 2 y 3: la válvula monoestable sube el cilindro en cuanto la salida cae.

#strong[El programa], en ST, con el método de la sección #nr("sec-new-automatas.6") (FIRST\_SCAN es el bit de primera vuelta; B11 y B12 son 1B1 y 1B2):

#codigo[```st
IF FIRST_SCAN OR NOT SEG THEN                (* 1. initialisation *)
    X0 := TRUE; X1 := FALSE; X2 := FALSE; X3 := FALSE; X4 := FALSE;
END_IF;
FB1(CLK := B1);  PARO(S := NOT S0, R1 := X0);  FIN := C1.Q OR PARO.Q1;
T01 := X0 AND S1 AND B11 AND SEG;  T12 := X1 AND FB1.Q;   (* 2. transitions *)
T23 := X2 AND B12;  T34 := X3 AND T3.Q;
T41 := X4 AND B11 AND NOT FIN;  T40 := X4 AND B11 AND FIN;
IF T01 THEN X0 := FALSE; END_IF;  IF T12 THEN X1 := FALSE; END_IF;  (* 3. off... *)
IF T23 THEN X2 := FALSE; END_IF;  IF T34 THEN X3 := FALSE; END_IF;
IF T41 OR T40 THEN X4 := FALSE; END_IF;
IF T01 OR T41 THEN X1 := TRUE; END_IF;  IF T12 THEN X2 := TRUE; END_IF;  (* ...on *)
IF T23 THEN X3 := TRUE; END_IF;  IF T34 THEN X4 := TRUE; END_IF;
IF T40 THEN X0 := TRUE; END_IF;
T3(IN := X3, PT := T#1.5s);  C1(CU := X4, R := T01, PV := 50);   (* 4. actions *)
KM1 := X1;  Y1 := X2 OR X3;  H1 := X0 AND C1.Q;
```]

#strong[Simulación.] El programa se ha ejecutado en el simulador de ciclo de scan junto con un modelo de la máquina: la cinta avanza a 0,2 m/s mientras los contactos de KM1 están cerrados, el cilindro tarda 0,4 s en bajar y 0,3 s en subir, y las piezas llegan con una separación al azar de 230 a 270 mm, sin relación con el ciclo. El mismo GRAFCET se ha ejecutado también con un intérprete que aplica las cinco reglas literalmente:

#tabla(none, columns: 3, align: (left, right, right,),
  [Magnitud], [Cálculo], [Simulación],
  [Tiempo de ciclo por pieza], [3,45 s], [3,47 s],
  [Producción], [1 043 piezas/h], [1 036 piezas/h],
  [Piezas marcadas en el lote], [50], [50],
  [Recorrido de la pieza tras llegar a B1], [5,62 a 7,62 mm], [5,70 a 7,64 mm],
)

El cálculo del ciclo suma el transporte de 250 mm a 0,2 m/s (1,25 s), la bajada, el marcado y la subida; la simulación añade las lecturas de los tres detectores, el contactor y una vuelta del temporizador: 24 ms por pieza. El recorrido tras B1 es la velocidad de la cinta por la cadena de la ecuación 1 más el contactor, de 3 + 10 + 0,1 + 15 = 28,1 ms a 38,1 ms: B1 se monta 6,6 mm antes de la posición de marcado y la pieza se para a ±1,0 mm de ella, más la inercia de la cinta, que se mide y se compensa igual. Frente al intérprete, la traducción en ST solo difiere en que el marcado dura 10 ms más, porque T3 se actualiza en el bloque de acciones y su salida se usa en la vuelta siguiente; con 1,5 s es irrelevante.

#strong[La emergencia.] La seta corta, a través del relé de seguridad, las bobinas de KM1 y 1Y1 (categoría 0): la cinta se para y el cilindro sube por el muelle de la válvula. El autómata ve SEG a 0 y lleva el GRAFCET a la etapa 0, así que al rearmar no se mueve nada hasta pulsar marcha. Que el cilindro suba al cortar es aquí lo seguro, porque aleja la herramienta de la mano; con un cilindro que sostiene una carga sería lo contrario, y la válvula sería de centro cerrado. Lo decide la evaluación de riesgos, no el programa.

#strong[En el banco]

- #strong[Sin aire], con la válvula desconectada, forzar 1B1 y 1B2 y recorrer el GRAFCET etapa a etapa mirando X0 a X4 en línea.
- #strong[Soltar el cable de S0] con la estación en marcha: debe terminar la pieza y pararse arriba.
- #strong[Medir dónde se paran] veinte piezas: la dispersión debe estar cerca de 2 mm; si es mucho mayor, la cinta patina o el ciclo es más largo de lo que se cree.
- #strong[Pulsar la emergencia en cada etapa] y comprobar que, tras rearmar, la estación espera la marcha.

#strong[Resultado:] seis entradas y tres salidas en lógica positiva; un GRAFCET de cinco etapas con una divergencia en O; 1 036 piezas por hora (3,47 s por pieza) y 2 mm de dispersión en la parada, con B1 adelantado 6,6 mm; la emergencia, cableada fuera del autómata.

#figura("aut-problema.svg", 100%, [La estación de marcado del problema #nr("prob-new-automatas.A"). A la izquierda, su GRAFCET; a la derecha, las tres primeras piezas en el simulador de ciclo de scan: la marcha S1, la cinta KM1, el detector B1, la válvula 1Y1 y los detectores del cilindro 1B1 y 1B2.]) <fig-new-automatas.8>

#ejercicios[
  #ejercicio[
    Escribe la ecuación de un contactor KM1 con autorretención y prioridad de paro, y la de prioridad de marcha, con S0 y S1 valiendo 1 cuando se pulsan. ¿Qué hace cada una con los dos pulsados? Si el autómata recibe S0 de un pulsador cerrado en la entrada %IX0.0, ¿cómo queda la ecuación, y qué pasa si se rompe ese cable?
  ] <ej-new-automatas.1>

  #ejercicio[
    Un motor de 7,5 kW y 400/690 V tiene 14,5 A nominales en triángulo a 400 V y una corriente de arranque de 6,5 veces la nominal. Calcula la corriente de arranque en directo y en estrella, la fracción de par en estrella, las corrientes de los tres contactores y el ajuste del relé térmico montado tras KM1.
  ] <ej-new-automatas.2>

  #ejercicio[
    Un inductivo M12 no enrasado tiene S#sub[n] = 4 mm y se monta a 2 mm de la pieza. ¿Es seguro que detecte una pieza de acero inoxidable con factor 0,7? ¿Y una de latón con factor 0,4?
  ] <ej-new-automatas.3>

  #ejercicio[
    Una entrada de tipo 1 se comporta como 3,9 kΩ y se le conecta un detector de dos hilos con 1,5 mA de corriente residual y 7 V de caída. Calcula la tensión en reposo, la resistencia en paralelo máxima que la deja en la zona de 0 y un valor E12 con margen, con su potencia a 30 V. ¿Funciona con la fuente a 21 V?
  ] <ej-new-automatas.4>

  #ejercicio[
    Con un ciclo de 15 ms, un filtro de entrada de 6 ms y salidas de relé de 10 ms, una cinta a 0,5 m/s debe pararse cuando una pieza llega a un detector. Calcula el tiempo de respuesta mínimo y máximo, la distancia recorrida y su dispersión. ¿Y con una tarea de 2 ms con acceso directo a la periferia?
  ] <ej-new-automatas.5>

  #ejercicio[
    Se cuentan piezas de 20 mm que pasan ante un fotoeléctrico a 1,5 m/s, con un ciclo de 18 ms y una entrada normal. ¿Qué fracción se contará? ¿Qué ciclo haría falta para no perder ninguna, y hasta qué velocidad se contarían todas con 18 ms?
  ] <ej-new-automatas.6>

  #ejercicio[
    Un intermitente se programa con dos TON de 300 ms que se encienden uno a otro, con un ciclo constante de 8 ms. ¿Qué periodo y qué frecuencia tiene, y qué error comete? Propón una forma de programarlo que no dependa del ciclo.
  ] <ej-new-automatas.7>

  #ejercicio[
    En un GRAFCET, t0 (receptividad m) lleva de la etapa inicial 0 a una divergencia en Y hacia 1 y 3; t1 (a), de 1 a 2; t3 (b), de 3 a 4; y t5 (c), una convergencia en Y, de 2 y 4 a la 0. Las entradas pasan por: m = 1; m = 0; a = 1; a = 0 y c = 1; b = 1 con c = 1. ¿Qué etapas quedan activas tras cada combinación? Escribe las transiciones en ST. ¿Cuántas vueltas tarda la traducción de la sección #nr("sec-new-automatas.6") en estabilizarse tras la última?
  ] <ej-new-automatas.8>
]

#soluciones[
  #solucion("ej-new-automatas.1")[
    Prioridad de paro: KM1 = (S1 + KM1)·S0̅; de marcha: KM1 = S1 + KM1·S0̅. Con los dos pulsados, la primera da 0 y la segunda 1. Con S0 cerrado, %IX0.0 = S0̅ y KM1 = (S1 + KM1)·%IX0.0, con un contacto #strong[abierto] en LD. Si se rompe el cable, %IX0.0 = 0 y el motor se para: el fallo va al lado seguro; con un pulsador abierto, la máquina se quedaría sin paro sin que nadie lo notara.
  ]

  #solucion("ej-new-automatas.2")[
    En directo, 6,5 × 14,5 = 94,25 A; en estrella, la tercera parte, 31,42 A, con un tercio del par. KM1 y KM2 llevan la corriente de devanado, 14,5/√3 = 8,37 A (el 58 %, en AC-3), y KM3, 14,5/3 = 4,83 A. El relé térmico, tras KM1, se ajusta a 8,37 A. Cada devanado ve en estrella 400/√3 = 230,9 V.
  ]

  #solucion("ej-new-automatas.3")[
    Con acero, S#sub[a] = 0,81 × 4 = 3,24 mm. Con inoxidable, 3,24 × 0,7 = 2,27 mm: mayor que 2 mm, la detecta con poco margen pero seguro. Con latón, 3,24 × 0,4 = 1,30 mm: menor que 2 mm, unos ejemplares la detectarán y otros no; hay que acercarlo a 1 mm o usar un modelo mayor o uno de factor 1 para todos los metales.
  ]

  #solucion("ej-new-automatas.4")[
    En reposo, 1,5 mA × 3,9 kΩ = 5,85 V: zona de transición. R#sub[p] ≤ 5 × 3 900/(5,85 − 5) = 22,9 kΩ. Con 22 kΩ quedarían 4,97 V, sin margen; con 18 kΩ, 4,81 V (lo mismo da ngspice) y 30²/18 000 = 50 mW a 30 V. Conduciendo, la entrada recibe 17 V a 24 V, pero 14 V con la fuente a 21 V, menos de los 15 V del tipo 1: hace falta una entrada de tipo 3 o un detector de tres hilos.
  ]

  #solucion("ej-new-automatas.5")[
    Mínimo, 6 + 15 + 10 = 31 ms; máximo, 6 + 30 + 10 = 46 ms (el simulador da de 31,0 a 46,0 ms). A 0,5 m/s, la pieza recorre de 15,5 a 23,0 mm: 7,5 mm de dispersión, T#sub[c]·v. Con una tarea de 2 ms, la respuesta va de 18 a 20 ms y la dispersión baja a 1,0 mm; los 16 ms fijos del filtro y del relé se compensan colocando el detector.
  ]

  #solucion("ej-new-automatas.6")[
    El pulso dura 20 mm/1,5 m/s = 13,3 ms, menos que el ciclo: se ve con probabilidad 13,3/18 = 0,741, y se pierde una de cada cuatro piezas (el simulador cuenta el 74,6 % de 3 000). Para verlas todas, el ciclo debe ser menor que 13,3 ms; con 18 ms, la cinta no puede pasar de 0,020/0,018 = 1,11 m/s. Lo correcto es un contador rápido.
  ]

  #solucion("ej-new-automatas.7")[
    Cada TON tarda 38 vueltas (304 ms) y cada reinicio pierde una: T = 2 × 304 + 2 × 8 = 624 ms (igual en el simulador), 1,603 Hz en vez de 1,667 Hz, un 4 % de error. Sin depender del ciclo: encender la lámpara cuando el reloj del sistema módulo 600 ms sea menor que 300 ms, invertirla en una tarea periódica de 300 ms o usar la marca de reloj del autómata.
  ]

  #solucion("ej-new-automatas.8")[
    1 y 3; 1 y 3; 2 y 3; 2 y 3 (t5 no está validada sin la 4); y con b = 1 se franquea t3 y, con 2 y 4 activas y c verdadera, t5 en el mismo instante (evolución fugaz): la etapa 0. T0 := X0 AND m; T1 := X1 AND a; T3 := X3 AND b; T5 := X2 AND X4 AND c. La traducción tarda dos vueltas: en la primera activa la 4 y en la segunda franquea t5. El intérprete del simulador da lo mismo, con la última en una sola evaluación.
  ]
]
