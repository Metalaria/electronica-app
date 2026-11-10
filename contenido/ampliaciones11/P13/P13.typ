// P13 — «Comunicaciones industriales»: two new sections of chapter 43 (cap44.typ), «Buses y Protocolos de
// Comunicación», for «Electrónica Práctica Avanzada». Four parts, each to be pasted in its own place (see NOTAS.md):
//   PARTE 1  the sections 43.6 «Modbus: Registros sobre RS-485 y sobre Ethernet» and 43.7 «Buses de Campo,
//            Ethernet Industrial y Supervisión»: after the end of 43.5 «CAN: Robustez para Entornos Hostiles»
//            (after its figure <fig-44.8>) and before «== USB: Universal pero Complejo <sec-44.6>», which becomes 43.8.
//   PARTE 2  «Problema 43.D — Un nodo Modbus RTU con un microcontrolador»: in «Problemas de Diseño» <sec-44.13>
//            (now 43.15), after the end of Problema 43.C.
//   PARTE 3  nine exercises: inside the chapter's #ejercicios[…], after the exercise labelled <ej-44.5>.
//   PARTE 4  their solutions: inside #soluciones[…], after #solucion("ej-44.5")[…].
// Numbers: sections 43.6 and 43.7 (43.6-43.13 become 43.8-43.15); figures 43.9-43.11 (the old 43.9-43.15 become
// 43.12-43.18) and the problem's figure, 43.19; exercises 43.6-43.14.
// Every number comes from scripts/calculos.py; the RS-485 and PROFIBUS idle voltages also from ngspice
// (spice/, spice_comprobar.py), and the frames of the problem from the C node run on the PC (prueba_nodo.py).

// ============================================================================================ PARTE 1
== Modbus: Registros sobre RS-485 y sobre Ethernet <sec-new-44-modbus>

Hasta aquí, cada bus unía chips o placas que diseña la misma persona. En una fábrica, un autómata de un fabricante tiene que leer la temperatura de un regulador de otro, mandar una consigna a un variador de un tercero y entregarlo todo a un ordenador de supervisión que no conoce a ninguno. Para eso no basta un nivel físico robusto: hace falta un protocolo que todos entiendan. Esta sección presenta el más extendido, Modbus, y la siguiente los buses de campo y la Ethernet industrial.

=== De la placa a la fábrica: la pirámide de la automatización

Un sistema de automatización se describe por niveles (figura #nr("fig-new-44-piramide")). En el #strong[campo] están los sensores, los actuadores y los variadores: unos pocos bytes por equipo, cada pocos milisegundos o menos. En el #strong[control], los autómatas programables leen esas entradas, ejecutan su programa y escriben las salidas en ciclos de 1 a 100 ms. En la #strong[supervisión], un SCADA y los paneles de operador (HMI) muestran el proceso, guardan su histórico y avisan de las alarmas, con refrescos de segundos.

Al subir crecen los datos y se relaja la prisa; al bajar, lo que se exige al bus deja de ser caudal y pasa a ser #strong[determinismo]: saber cuánto tardará, como mucho, cada dato. Hoy la pirámide se aplana, y la Ethernet llega hasta el sensor; pero para quien diseña un equipo de campo la consecuencia práctica sigue siendo la misma: su producto tendrá que hablar al menos uno de estos protocolos y, casi siempre, Modbus.

#figura("industrial-piramide.svg", 71%, [La pirámide de la automatización. Hacia arriba crece la cantidad de datos y se relajan los tiempos; hacia abajo el ciclo se acorta y lo que importa es acotar el retardo. A la derecha, los buses y protocolos típicos de cada nivel.]) <fig-new-44-piramide>

=== El modelo: un cliente que pregunta y cuatro tablas

Modbus lo publicó Modicon en 1979 para sus autómatas, y su especificación es abierta y gratuita. Hay un #strong[cliente] (el maestro, en la terminología antigua, que se sigue usando en RS-485) y uno o varios #strong[servidores] (los esclavos). Solo el cliente inicia: envía una petición y el servidor responde; un servidor nunca habla por su cuenta. Los datos de cada servidor se organizan en cuatro tablas de hasta 65 536 elementos: #strong[bobinas] (bits de lectura y escritura, como la orden de un relé), #strong[entradas discretas] (bits de solo lectura), #strong[registros de entrada] (palabras de 16 bits de solo lectura, como una medida) y #strong[registros de retención] (palabras de lectura y escritura, como una consigna). Una #strong[función] dice qué se hace con qué tabla, y ocho cubren casi todo:

#tabla(none, columns: 4, align: (left, left, left, right,),
  [Código], [Función], [Tabla], [Máximo por petición],
  [01], [Leer bobinas], [bobinas], [2 000 bits],
  [02], [Leer entradas discretas], [entradas discretas], [2 000 bits],
  [03], [Leer registros de retención], [retención], [125 registros],
  [04], [Leer registros de entrada], [entrada], [125 registros],
  [05], [Escribir una bobina], [bobinas], [1 bit],
  [06], [Escribir un registro], [retención], [1 registro],
  [15 (0F#sub[16])], [Escribir varias bobinas], [bobinas], [1 968 bits],
  [16 (10#sub[16])], [Escribir varios registros], [retención], [123 registros],
)

Si el servidor no puede atender una petición, responde con una #strong[excepción]: el código de función con el bit más alto a 1 (03 pasa a 83#sub[16]) y un byte con el motivo: 01, función no admitida; 02, dirección inexistente; 03, valor no válido; 04, fallo del equipo. Una excepción es una respuesta correcta; el silencio significa que la petición no llegó, llegó mal o era para otro.

#strong[La trampa de las direcciones.] En la trama, el primer elemento de cada tabla tiene la dirección 0, pero muchos manuales numeran desde 1 con un prefijo de tabla: «40001» es el primer registro de retención, «30001» el primer registro de entrada, «10001» la primera entrada discreta y «00001» la primera bobina. El registro «40108» se lee con la función 03 y la dirección 107. Leer el registro de al lado por esa unidad es el error más común al poner en marcha un enlace, y no da ninguna excepción: el dato llega, pero es otro.

#strong[Los tipos.] Un registro lleva 16 bits con el byte alto primero, y su significado lo decide el fabricante; lo más habitual es un entero con signo en décimas (235 para 23,5 °C). Un real de 32 bits ocupa dos registros, y el orden de las dos mitades no está normalizado: leído al revés, 23,5 se convierte en un número absurdo. La hoja de datos tiene que decirlo; si no, se prueba con un valor conocido.

=== La trama RTU y su CRC

En una línea serie, Modbus va en modo #strong[RTU] (hay un modo ASCII, el doble de largo, que apenas se usa). La trama (figura #nr("fig-new-44-trama")) tiene la dirección del servidor (de 1 a 247; el 0 es la difusión, que todos ejecutan y nadie contesta), la función, los datos y un CRC de 16 bits; función y datos forman la #strong[PDU], la parte que no depende del medio, y la trama completa no pasa de 256 bytes. La petición para leer diez registros de retención del servidor 1, desde la dirección 0, es

#centrado[`01 03 00 00 00 0A C5 CD`]

y la respuesta trae dirección, función, el número de bytes que siguen (20), los diez registros y su CRC: 25 bytes.

El CRC es el de la sección #nr("sec-19.6") en su forma concreta: polinomio 8005#sub[16] con los bits invertidos (A001#sub[16]), registro inicial FFFF#sub[16], sin inversión final, y se envía #strong[el byte bajo primero]: en el ejemplo vale CDC5#sub[16] y viaja como `C5 CD`. El receptor no necesita compararlo: calcula el CRC de la trama entera, incluido el que recibe, y si el resto es cero la trama está bien. En software son seis líneas (problema #nr("prob-44.D")).

#comprobacion[
  Una implementación del CRC se comprueba con la cadena ASCII «123456789»: debe dar 4B37#sub[16]. Si sale 374B#sub[16], el cálculo está bien y el orden de los bytes al enviarlo, mal. Y la petición del ejemplo, con sus dos bytes de CRC, debe dar resto cero.
]

#figura("modbus-trama.svg", 100%, [La misma petición, leer diez registros de retención del servidor 1, en Modbus RTU y en Modbus TCP. La PDU es idéntica; en RTU la rodean la dirección, el CRC y los silencios que la delimitan, y en TCP una cabecera de siete bytes. Abajo, un carácter de 11 bits y la duración de la transacción completa a 19 200 bit/s.]) <fig-new-44-trama>

=== Los silencios que delimitan la trama

La trama RTU no tiene byte de inicio ni de fin: la delimita el silencio, el tercero de los métodos de la sección #nr("sec-19.6"). Cada carácter ocupa 11 bits: inicio, 8 de datos, paridad (par, por defecto) y parada; sin paridad se ponen dos bits de parada. A una velocidad v#sub[b]:

#ec[$ t_("car") = 11 / v_("b") quad quad t_("3,5") = "3,5" dot.op t_("car") quad quad t_("1,5") = "1,5" dot.op t_("car") $]

Entre tramas debe haber al menos t#sub[3,5] de silencio, y el receptor que lleva ese tiempo sin recibir nada da la trama por terminada; dentro de una trama no puede haber huecos de más de t#sub[1,5], o se descarta. A 9 600 bit/s, un carácter dura 1,146 ms, t#sub[1,5] = 1,719 ms y t#sub[3,5] = 4,010 ms; a 19 200 bit/s, 0,573, 0,859 y 2,005 ms. Por encima de 19 200 bit/s la especificación los fija en 0,750 y 1,750 ms. La configuración por defecto es 19 200 bit/s con paridad par (8E1); hay equipos a 8N1, fuera de norma, y ante un nodo mudo lo primero es comprobar velocidad y formato en los dos extremos.

#ejemplo[
  Un autómata lee diez registros de retención de un servidor a 19 200 bit/s y 8E1. \ La petición, 8 bytes, dura 8 × 0,573 = 4,58 ms; el servidor espera t#sub[3,5] = 2,005 ms para saber que ha terminado, la procesa (0,5 ms) y responde con 25 bytes, 14,32 ms; el autómata deja otros 2,005 ms antes de la petición siguiente. Total: 23,4 ms por transacción. \ Con diez servidores, 234 ms por vuelta: cada dato se refresca unas 4,3 veces por segundo, y de los 33 bytes que viajan solo 20 son datos (61 %). A 115 200 bit/s la transacción baja a 7,15 ms, y los silencios fijos pesan ya más que los datos.
]

Suficiente para temperaturas, niveles, contadores de energía o consignas de un variador; insuficiente para cerrar un lazo de posición, que pide refrescos de un milisegundo o menos.

=== RS-485 para Modbus: cargas, polarización y terminación

El nivel físico habitual es RS-485 a dos hilos (sección #nr("sec-44.10")) más un conductor común. Modbus llama #strong[D1] y #strong[D0] a los hilos (D1 es positivo respecto a D0 en reposo, el «1»), y al diseñar un nodo cuentan tres cosas:

- #strong[Cargas.] Cada receptor es una o varias #strong[cargas unidad]: 12 kΩ desde cada hilo hasta su tensión interna. Un transmisor debe dar al menos 1,5 V diferenciales con 32 cargas unidad y las dos terminaciones; el receptor decide con ±200 mV, en un modo común de −7 a +12 V. Los transceptores de 1/4 o 1/8 de carga admiten 128 o 256 nodos, aunque Modbus no direcciona más de 247.
- #strong[Polarización.] Sin transmisor activo el par flota, y el receptor puede leer ruido como un bit de inicio. Se fija el reposo con una resistencia de D1 a 5 V y otra de D0 a masa, de 450 a 650 Ω según la especificación, #strong[en un solo punto del bus], normalmente el maestro. Muchos transceptores modernos tienen además un umbral desplazado que lee 0 V como reposo.
- #strong[Terminación]: la de la sección #nr("sec-44.10"), en los dos extremos y con ramales cortos. Modbus admite 1 000 m a 9 600 bit/s, y a esas velocidades los transceptores de flancos lentos toleran mejor los ramales.

Polarización y cargas tiran en sentidos contrarios, y el cálculo del problema #nr("prob-44.B") hay que completarlo con los receptores. En modo diferencial, n cargas unidad equivalen a 2 × 12 kΩ/n entre los hilos:

#ec[$ V_("BA") = V_("CC") dot.op Z_("d") / (2 R_("p") + Z_("d")) quad quad Z_("d") = (R_("T") / 2) parallel (2 dot.op "12 kΩ") / n $]

con R#sub[p] cada resistencia de polarización y R#sub[T] cada terminación. Con 680 Ω, 5 V y dos terminaciones de 120 Ω, el bus vacío del problema #nr("prob-44.B") tiene 211 mV; con 32 cargas unidad (750 Ω diferenciales) baja a 196 mV, por debajo del umbral. La simulación en ngspice da lo mismo, 196,2 mV, sea cual sea la tensión interna de los receptores.

#precaucion[
  Los fabricantes no se ponen de acuerdo en qué hilo se llama A y cuál B. Si un nodo no contesta y todo lo demás parece correcto, se cruzan los dos hilos del par: no se rompe nada, y resuelve más casos de los que debería.
]

=== Modbus TCP

Sobre Ethernet, Modbus conserva la PDU y cambia el envoltorio (figura #nr("fig-new-44-trama")). Sobran el CRC y los silencios, porque Ethernet y TCP ya protegen y delimitan los datos; en su lugar va la cabecera #strong[MBAP], de siete bytes: un identificador de transacción que el servidor devuelve tal cual, un identificador de protocolo que vale 0, la longitud de lo que sigue y un identificador de unidad. La petición del ejemplo, al puerto TCP 502, es

#centrado[`00 01 00 00 00 06 01 03 00 00 00 0A`]

El identificador de unidad es lo que permite las #strong[pasarelas]: un equipo que recibe peticiones TCP y las reenvía como tramas RTU al servidor de esa dirección en su bus RS-485, la manera habitual de llevar a la red de planta los equipos serie existentes. Modbus TCP no es determinista (un conmutador cargado o una retransmisión retrasan la respuesta decenas de milisegundos): para supervisión no importa; para control rápido, sí.

Y un aviso para todo Modbus: no tiene autenticación, y cualquiera que llegue al puerto 502 puede escribir una bobina. Hay una variante con TLS (Modbus/TCP Security, puerto 802), pero la defensa habitual es no exponer nunca un equipo Modbus fuera de su red de planta y separar esa red del resto, como pide la serie IEC 62443 de ciberseguridad industrial (sección #nr("sec-49.13")).

=== En el banco

- #strong[Un cliente en el ordenador]: un conversor USB-RS-485 y una biblioteca libre como pymodbus leen y escriben cualquier registro sin el autómata.
- #strong[El analizador lógico] en TX, RX y la habilitación del transmisor (DE), con decodificador de Modbus RTU, muestra tramas, silencios y si el transmisor se suelta a tiempo.
- #strong[Con el bus apagado], 60 Ω entre D1 y D0; encendido y en reposo, la tensión de polarización; transmitiendo, más de 1,5 V en el extremo lejano.

== Buses de Campo, Ethernet Industrial y Supervisión <sec-new-44-campo>

Modbus resuelve bien el «leer y escribir registros», pero no el «leer las entradas de doscientos equipos cada milisegundo, siempre a la vez». Para eso están los buses de campo y la Ethernet industrial, y para ver la planta entera, los protocolos de supervisión. Quien diseña un equipo de campo no programará un maestro de PROFINET, pero sí tiene que saber qué le pedirán.

=== Lo que el control exige: determinismo

Un autómata trabaja en ciclos: lee las entradas, ejecuta el programa y escribe las salidas. Si el ciclo es de 1 ms, el bus tiene que mover todas las entradas y salidas en una fracción de ese milisegundo y, sobre todo, #strong[siempre en el mismo tiempo]: en un lazo de posición, la variación del retardo (el #emph[jitter] de la sección #nr("sec-41.5")) es un error de posición. La Ethernet de oficina no lo garantiza: un conmutador almacena cada trama antes de reenviarla, y una trama máxima de 1 518 bytes ocupa la línea 123 µs a 100 Mbit/s; diez conmutadores en línea suman, en el peor caso, 1,23 ms de incertidumbre, más que el ciclo entero. Hay tres salidas (figura #nr("fig-new-44-ethernet")): un maestro que reparte los turnos en un bus (PROFIBUS), prioridad y reserva de tiempo en los conmutadores (PROFINET) o una trama única que recorre todos los equipos (EtherCAT).

=== PROFIBUS DP

PROFIBUS, de finales de los ochenta, es el bus de campo clásico de los autómatas europeos, y su variante DP (periferia descentralizada) sigue en miles de plantas. Su nivel físico es un RS-485 con reglas propias: cable de 150 Ω (el «tipo A»), conector D-sub de nueve contactos (B en el 3, A en el 8, masa en el 5 y 5 V en el 6), 32 estaciones por segmento y hasta 126 con repetidores, y velocidades de 9,6 kbit/s a 12 Mbit/s, con una longitud por segmento de 1 200 m hasta 93,75 kbit/s, 1 000 m a 187,5 kbit/s, 400 m a 500 kbit/s, 200 m a 1,5 Mbit/s y 100 m de 3 a 12 Mbit/s.

La terminación es #strong[activa]: en cada extremo, 390 Ω de B a 5 V, 220 Ω entre B y A y 390 Ω de A a masa, de modo que terminación y polarización van juntas. En reposo, 5 × 220/1 000 = 1,1 V, y 0,99 V con 32 cargas unidad (ngspice: 987 mV). A cambio, la terminación toma los 5 V de la estación del extremo: donde esa estación pueda apagarse, se usan terminaciones con alimentación propia. Los maestros se pasan un testigo, y el que lo tiene interroga a sus esclavos uno tras otro; cada equipo se describe con un fichero GSD. Para la industria de proceso existe PROFIBUS PA, con datos y alimentación por el mismo par a 31,25 kbit/s, apto para atmósferas explosivas.

=== PROFINET: Ethernet con una vía rápida

PROFINET, de la misma organización, es su sucesor sobre Ethernet de 100 Mbit/s con conmutadores. Usa TCP/IP solo para configuración y diagnóstico; los datos cíclicos van en #strong[tiempo real (RT)], en tramas Ethernet directas sin IP (tipo 8892#sub[16]) y con prioridad en los conmutadores, con ciclos del orden del milisegundo. Para control de movimiento está el modo #strong[isócrono (IRT)]: conmutadores específicos reservan en cada ciclo una franja en la que solo pasan las tramas planificadas, con ciclos desde 31,25 µs y jitter por debajo de 1 µs. Los equipos suelen llevar un conmutador de dos puertos integrado, así que la red puede ser una línea, una estrella o un anillo redundante (protocolo MRP, que se reconfigura en menos de 200 ms si se corta un cable); cada uno se describe con un fichero GSDML.

=== EtherCAT: una trama para todos

EtherCAT parte de otra idea. El maestro, un ordenador con una tarjeta Ethernet normal, envía una sola trama que recorre todos los esclavos en línea; cada esclavo lee los datos que le corresponden y escribe los suyos #strong[mientras la trama pasa], sin almacenarla, y el último la devuelve por el otro par del mismo cable. Unos relojes distribuidos, que el maestro sincroniza midiendo el retardo hasta cada esclavo, permiten que todos actúen en el mismo instante con un error muy por debajo del microsegundo. Admite línea, árbol y estrella con módulos de derivación, pero no conmutadores normales entre esclavos.

#ejemplo[
  Cuarenta servoaccionamientos con 10 bytes de órdenes y 10 de estado cada uno. \ Con EtherCAT, los 800 bytes van en una trama de 852 bytes contando cabeceras, preámbulo y separación: 68,2 µs a 100 Mbit/s. Con medio microsegundo de paso por esclavo, la vuelta dura unos 88 µs (108 µs con 1 µs): cabe en un ciclo de 125 µs, y el 94 % de lo transmitido son datos. \ Con una trama Ethernet de 64 bytes por equipo y sentido, el aprovechamiento cae al 12 % y las 80 tramas suman 538 µs de línea. Con Modbus RTU a 115 200 bit/s, una lectura y una escritura por accionamiento: 487 ms.
]

Conviene conocer también de nombre EtherNet/IP, muy extendido en América, y CANopen, que lleva un modelo de datos parecido sobre el CAN de la sección #nr("sec-44.5").

#figura("ethernet-industrial.svg", 100%, [Tres maneras de dar acceso a muchos equipos. Con un maestro en un bus, cada dato cuesta una pregunta y una respuesta. Con Ethernet conmutada, cada dispositivo envía sus propias tramas y el determinismo depende de los conmutadores. Con el procesado al vuelo de EtherCAT, una sola trama recoge y entrega los datos de todos en una vuelta.]) <fig-new-44-ethernet>

#tabla(none, columns: 4, align: (left, left, left, left,),
  [Sistema], [Nivel físico], [Topología y acceso], [Ciclo típico],
  [Modbus RTU], [RS-485, 9,6–115,2 kbit/s], [bus; maestro que pregunta], [decenas a cientos de ms],
  [Modbus TCP], [Ethernet], [estrella; cliente y servidor], [no determinista],
  [PROFIBUS DP], [RS-485, hasta 12 Mbit/s], [bus; testigo y maestro], [milisegundos],
  [PROFINET RT], [Ethernet 100 Mbit/s], [línea, estrella, anillo], [del orden de 1 ms],
  [PROFINET IRT], [Ethernet 100 Mbit/s], [línea, anillo; franja reservada], [desde 31,25 µs],
  [EtherCAT], [Ethernet 100 Mbit/s], [línea, árbol; trama al vuelo], [decenas a cientos de µs],
  [IO-Link], [24 V, punto a punto], [estrella desde el maestro], [décimas a decenas de ms],
)

=== IO-Link: el último metro hasta el sensor

Un detector de proximidad clásico tiene tres hilos: 24 V, masa y una salida que conmuta. IO-Link (IEC 61131-9) aprovecha ese mismo cable, sin apantallar, de hasta 20 m y con su conector M12, para convertir la salida en una línea de comunicación #strong[punto a punto] con un puerto de un maestro IO-Link, conectado a su vez al bus de campo. No es un bus: cada sensor tiene su puerto, sin direcciones ni terminaciones. Usa caracteres UART de 11 bits con niveles de 24 V a 4,8, 38,4 o 230,4 kbit/s (COM1, COM2 y COM3); un ciclo con dos bytes de datos de proceso ocupa cinco caracteres, 1,43 ms en COM2 y 0,24 ms en COM3, más el tiempo de respuesta del dispositivo. Si el maestro no sabe IO-Link, el sensor se comporta como uno clásico.

Lo que aporta es información: además de los #strong[datos de proceso] (la distancia medida, no solo «hay pieza»), el maestro lee y escribe #strong[parámetros] y recibe #strong[eventos] (lente sucia, temperatura excesiva). Un fichero IODD lo describe todo, y el maestro guarda los parámetros: un sensor de repuesto recibe la configuración del anterior sin intervención. Es la manera de que un sensor inteligente (sección #nr("sec-35.11")) encaje en una máquina sin cables nuevos.

=== Supervisión: SCADA, HMI y OPC UA

Un #strong[HMI] es el panel junto a la máquina; un #strong[SCADA], el programa que supervisa la planta: interroga a autómatas y equipos (a menudo por Modbus TCP, cada segundo), registra el histórico, dibuja tendencias y gestiona alarmas. No cierra lazos rápidos; los cierra el autómata, y el SCADA le cambia consignas.

El problema es que Modbus no se describe a sí mismo: qué significa un registro lo dice un PDF del fabricante, y alguien lo teclea en el SCADA. #strong[OPC UA] (IEC 62541), sucesor independiente de la plataforma del OPC clásico de Windows, resuelve eso con un #strong[modelo de información]: el servidor expone un árbol de nodos (variables con su tipo, unidades y rango, objetos y métodos), y un cliente puede recorrerlo y descubrir qué ofrece el equipo. Las especificaciones complementarias fijan modelos comunes por sector, para que equipos de fabricantes distintos expongan lo mismo con los mismos nombres. La seguridad viene incluida (certificados X.509 por aplicación, mensajes firmados o cifrados, usuarios autenticados); el transporte habitual es binario sobre TCP, puerto 4840, y hay un modo de publicación y suscripción sobre UDP o MQTT (sección #nr("sec-49.11")). Su coste es la complejidad: un servidor OPC UA necesita un microcontrolador con red y bastante memoria; uno Modbus RTU cabe en el más pequeño.

=== Lo que el diseñador del equipo de campo debe dar

Sea cual sea el protocolo, el sistema de arriba espera lo mismo:

- #strong[Un mapa de datos documentado y estable]: dirección, tipo, unidades, escala, acceso y rango, sin cambios entre versiones del firmware; un registro que se mueve rompe en silencio todos los SCADA que lo leían.
- #strong[El estado junto al valor]: un sensor roto no debe dar 0, que es una medida posible. Es la idea del bucle de 4–20 mA (problema #nr("prob-20.C")), donde la recomendación NAMUR NE 43 reserva las corrientes por debajo de 3,6 mA y por encima de 21 mA para indicar avería.
- #strong[Diagnóstico y protección]: contadores de tramas y de errores, versión del firmware, y excepciones ante escrituras fuera de rango en lugar de recortes silenciosos.

#precaucion[
  Un SCADA suele escribir las consignas cíclicamente, por ejemplo cada segundo, aunque no cambien. Si el firmware guarda cada escritura en una EEPROM de unos 100 000 ciclos (sección #nr("sec-29.6")), la gasta en 27,8 horas. Hay que guardar solo cuando el valor cambia.
]

=== En el banco

- #strong[Wireshark] decodifica Modbus TCP, PROFINET y EtherCAT; para ver el tráfico de un autómata hace falta un conmutador con puerto espejo o una derivación pasiva en el cable.
- #strong[En PROFIBUS], con el bus alimentado y en reposo, unos 1,1 V entre B y A; si es cero, la estación que alimenta la terminación está apagada o el interruptor de terminación del conector está mal puesto.

// ============================================================================================ PARTE 2
=== Problema #nr("prob-44.D") — Un nodo Modbus RTU con un microcontrolador <prob-44.D>

#strong[Enunciado]

Un equipo de medida de temperatura con un relé de alarma se va a conectar a un bus RS-485 existente de 600 m, con un autómata como maestro y 25 nodos de una carga unidad, a #strong[19 200 bit/s y 8E1], polarizado con 680 Ω a 5 V. El autómata lee cuatro registros de entrada de cada nodo y quiere refrescar todos los datos cada #strong[500 ms].

#strong[Se pide:] definir el mapa de registros; diseñar la interfaz con el bus; escribir el núcleo del firmware; comprobar los tiempos del ciclo; y preparar las pruebas del nodo.

#strong[Verificación]

#strong[El mapa de registros:]

#tabla(none, columns: 3, align: (left, left, left,),
  [Dato (dirección)], [Contenido], [Tipo y escala],
  [Entrada 0 (30001)], [temperatura], [entero con signo, 0,1 °C],
  [Entrada 1 (30002)], [estado del sensor], [0 correcto, 1 abierto, 2 en corto],
  [Entrada 2 (30003)], [tramas con CRC erróneo], [contador],
  [Entrada 3 (30004)], [versión del firmware], [0102#sub[16] = 1.2],
  [Retención 0 (40001)], [consigna de alarma], [entero con signo, 0,1 °C],
  [Retención 1 (40002)], [histéresis], [0,1 °C],
  [Retención 2 (40003)], [dirección del nodo], [1 a 247],
  [Bobina 0 (00001)], [relé], [1 = activado],
)

La consigna y la dirección se guardan en memoria no volátil solo si cambian.

#strong[La interfaz] (figura #nr("fig-new-44-nodo")): un transceptor de 3,3 V y 1/8 de carga unidad, con DE y RE#sub[n] unidos a una salida del microcontrolador, diodos supresores (TVS) en los dos hilos y la terminación de 120 Ω con un puente, que solo se cierra si el nodo queda en un extremo. El nodo no polariza. Si su masa puede estar lejos de la del autómata, se aísla entre el microcontrolador y el transceptor (sección #nr("sec-44.9")). Los 600 m a 19 200 bit/s están muy por dentro del límite de la sección #nr("sec-44.10"), unos 167 kbit/s para esa longitud.

#strong[La polarización existente.] Con el nuevo nodo hay 26 cargas unidad (los 25 nodos y el autómata) más 1/8: Z#sub[d] = 60 Ω ∥ 919 Ω = 56,3 Ω, y con 680 Ω quedan 198,8 mV en reposo, justo por debajo de los 200 mV: el bus funciona por el margen de los receptores reales, no por diseño. Con 470 Ω en el maestro sube a 282,6 mV (ngspice: 198,83 y 282,65 mV).

#strong[El firmware.] La interrupción de recepción de la UART (sección #nr("sec-38.4")) guarda cada byte con su instante, y un temporizador (sección #nr("sec-38.5")) da la trama por terminada tras t#sub[3,5] = 2,005 ms de silencio:

#codigo[```c
/* CRC-16/MODBUS: reflected polynomial 0xA001, initial value 0xFFFF;
   the CRC is sent low byte first. */
uint16_t mb_crc16(const uint8_t *p, int n)
{
    uint16_t crc = 0xFFFF;
    while (n--) {
        crc ^= *p++;
        for (int i = 0; i < 8; i++)
            crc = (crc & 1) ? (crc >> 1) ^ 0xA001 : crc >> 1;
    }
    return crc;
}

void mb_rx_byte(uint8_t b, uint32_t t_us)     /* UART receive interrupt */
{
    if (frame_ready) return;                /* previous frame still pending */
    if (rx_n > 0 && t_us - t_last > T15_US) rx_bad = 1;
    if (rx_n < (int)sizeof rx) rx[rx_n++] = b; else rx_bad = 1;
    t_last = t_us;
}

void mb_tick(uint32_t t_us)                   /* periodic timer */
{
    if (rx_n > 0 && !frame_ready && t_us - t_last >= T35_US) frame_ready = 1;
}
```]

El bucle principal descarta la trama si tuvo un hueco de más de t#sub[1,5] (0,859 ms), si su CRC completo no da cero (y cuenta el error) o si la dirección no es la suya ni la de difusión; si no, la ejecuta y, salvo en difusión, responde. Para responder activa DE, envía (mejor con DMA, sección #nr("sec-38.8")) y #strong[desactiva DE en la interrupción de transmisión completa], cuando ha salido el bit de parada del último byte, no en la de registro vacío, que llega un carácter antes: soltar el bus ahí corta el final del CRC, y el autómata ve de vez en cuando una respuesta errónea.

#strong[Los tiempos.] Petición de 8 bytes, 4,58 ms; respuesta de 13 bytes, 7,45 ms; con los silencios y 0,2 ms de proceso, 16,2 ms por nodo y 422 ms por vuelta con 26 nodos: cabe en los 500 ms. Pero el ciclo lo fija el caso malo: si un nodo no contesta y el autómata espera 100 ms, la vuelta sube a 511 ms. A 38 400 bit/s, con 50 ms de espera, sería de 253 ms, y de 295 ms con un nodo caído.

#strong[Las pruebas.] En el banco, con un conversor USB-RS-485 y un cliente que envíe tramas preparadas y compare las respuestas byte a byte (nodo 10 = 0A#sub[16]):

#tabla(none, columns: 3, align: (left, left, left,),
  [Prueba], [Petición], [Respuesta esperada],
  [Leer los 4 registros de entrada], [`0A 04 00 00 00 04 F0 B2`], [`0A 04 08 00 EB 00 00 00 00 01 02 DA 76`],
  [La misma, con el CRC alterado], [`0A 04 00 00 00 04 F0 B3`], [ninguna; el contador pasa a 1],
  [Registro inexistente], [`0A 04 00 10 00 01 31 74`], [`0A 84 02 B3 03` (excepción 02)],
  [Relé activado], [`0A 05 00 00 FF 00 8D 41`], [la misma trama (eco)],
  [Función no admitida (2B#sub[16])], [`0A 2B 0E 01 00 D5 B6`], [`0A AB 01 EF 32` (excepción 01)],
  [Consigna de 25,0 °C a todos (difusión)], [`00 06 00 00 00 FA 08 58`], [ninguna; la consigna cambia],
  [Trama para el nodo 11], [`0B 04 00 00 00 04 F1 63`], [ninguna],
  [Lectura con un hueco de 1,2 ms], [la primera, partida tras el 3.#super[er] byte], [ninguna (hueco mayor que t#sub[1,5])],
)

En la primera respuesta, `00 EB` son 235 décimas: 23,5 °C. Este plan se ha ejecutado con el núcleo del firmware compilado en un ordenador, alimentando los bytes con sus tiempos, y da exactamente estas respuestas. Después, con el osciloscopio en DE y en el par, se comprueba que DE baja justo tras el último bit de parada y que la respuesta empieza unos 2 ms después del final de la petición.

#strong[Resultado:] mapa de cuatro registros de entrada, tres de retención y una bobina; transceptor de 1/8 de carga con TVS y terminación con puente; polarización del maestro de 680 a 470 Ω (282,6 mV); trama delimitada por temporizador y DE liberado con la transmisión completa; 422 ms por vuelta a 19 200 bit/s, con el consejo de subir a 38 400 bit/s para tener margen con un nodo caído.

#figura("nodo-modbus.svg", 71%, [La interfaz del nodo del problema #nr("prob-44.D") con el bus. Una sola salida del microcontrolador gobierna DE y RE#sub[n]\; la terminación solo se cierra en un extremo del bus y la polarización está en el maestro.]) <fig-new-44-nodo>

// ============================================================================================ PARTE 3
#ejercicios[
  #ejercicio[
    Un autómata envía la trama Modbus RTU `05 06 00 01 03 E8 D9 30`. ¿A qué servidor va, qué hace y con qué valor? ¿Cómo aparece ese registro en la documentación del equipo? ¿Cuánto dura la trama a 9 600 bit/s con 8E1, y cuánto silencio debe haber después? ¿Y a 115 200 bit/s?
  ] <ej-44.6>

  #ejercicio[
    El manual de un contador de energía da sus datos como 40108, 30001, 00017 y 10001. Para cada uno, di de qué tabla es, con qué función se lee y qué dirección va en la trama.
  ] <ej-44.7>

  #ejercicio[
    Un analizador lógico captura la petición `11 03 00 6B 00 03 76 87` y la respuesta `11 03 06 02 2B 00 00 00 64 C8 BA`. Interpreta las dos tramas y da los valores leídos. ¿Cómo comprueba el autómata que la respuesta llegó bien? ¿Qué respondería el servidor si el último de los registros pedidos no existiera?
  ] <ej-44.8>

  #ejercicio[
    Un sensor de presión entrega 1 013,25 hPa como real de 32 bits (IEEE 754) en dos registros, con la palabra alta primero. ¿Qué dos registros envía? ¿Qué valor obtiene un cliente que supone el orden contrario? Repite con 23,5 °C. ¿Qué prueba harías para descubrir el orden de un equipo mal documentado?
  ] <ej-44.9>

  #ejercicio[
    Un autómata lee seis registros de entrada de cada uno de 12 nodos, con 8E1 y 0,5 ms de proceso en cada nodo. Calcula la duración de una transacción y de una vuelta completa a 9 600 y a 19 200 bit/s. ¿Cuánto dura la vuelta si un nodo está desconectado y el tiempo de espera es de 200 ms?
  ] <ej-44.10>

  #ejercicio[
    ¿Cuántos transceptores de 1/4 de carga unidad admite un bus RS-485? Un bus tiene 63 de ellos, un maestro de una carga unidad, 120 Ω en cada extremo y polarización de 560 Ω a 5 V. Calcula la tensión de reposo entre D1 y D0. ¿Cuál es la mayor resistencia de polarización que mantiene 200 mV?
  ] <ej-44.11>

  #ejercicio[
    Una máquina tiene 120 módulos EtherCAT de entradas y salidas con 4 bytes de salida y 4 de entrada cada uno, intercambiados en un único datagrama. Calcula el tamaño de la trama, su duración a 100 Mbit/s y el ciclo mínimo con 0,5 µs de paso por esclavo. Compáralo con una trama Ethernet mínima por módulo y sentido.
  ] <ej-44.12>

  #ejercicio[
    Un SCADA escribe, con Modbus TCP, los valores 10, 300 y −100 en tres registros de retención a partir de la dirección 0100#sub[16] del equipo con unidad 0A#sub[16], con el identificador de transacción 1234#sub[16]. Escribe la trama TCP completa y el valor del campo de longitud. Una pasarela la reenvía al bus RTU a 19 200 bit/s: escribe la trama RTU y la respuesta, y calcula cuánto tarda la transacción en el bus con 0,5 ms de proceso.
  ] <ej-44.13>

  #ejercicio[
    Un segmento de PROFIBUS DP de 350 m con cable de tipo A trabaja a 1,5 Mbit/s y da errores. ¿Qué velocidad elegirías? Calcula la tensión de reposo del bus con las dos terminaciones activas y 32 cargas unidad. Repite el cálculo si se apaga la estación de un extremo y el contacto de 5 V de su terminación queda a 0 V. ¿Qué pasaría si se apagaran las dos?
  ] <ej-44.14>
]

// ============================================================================================ PARTE 4
#soluciones[
  #solucion("ej-44.6")[
    Va al servidor 5 con la función 06, escribir un registro: el de dirección 1, con el valor 03E8#sub[16] = 1 000. En la documentación es el registro 40002. La trama tiene 8 bytes de 11 bits: 88 bits, que a 9 600 bit/s duran 9,17 ms. Después deben seguir al menos 3,5 caracteres de silencio, 3,5 × 11/9 600 = 4,01 ms. A 115 200 bit/s la fórmula daría 0,334 ms, pero por encima de 19 200 bit/s la especificación fija t#sub[3,5] en 1,75 ms. Como es una escritura de un registro, la respuesta del servidor es el eco de la petición.
  ]

  #solucion("ej-44.7")[
    40108: registro de retención, función 03 (o 06 y 16 para escribirlo), dirección 107 (006B#sub[16]). 30001: registro de entrada, función 04, dirección 0. 00017: bobina, función 01 (05 y 15 para escribirla), dirección 16 (0010#sub[16]). 10001: entrada discreta, función 02, dirección 0. En todos, la dirección de la trama es el número de la documentación sin el prefijo de tabla y menos uno.
  ]

  #solucion("ej-44.8")[
    La petición pide al servidor 17 (11#sub[16]) tres registros de retención (función 03) desde la dirección 107 (006B#sub[16]): los registros 40108 a 40110. La respuesta trae 6 bytes, tres registros: 022B#sub[16] = 555, 0000#sub[16] = 0 y 0064#sub[16] = 100. El autómata calcula el CRC de los 11 bytes recibidos, incluidos los dos últimos: si la trama está bien, el resultado es cero. Si el registro 40110 no existiera, el servidor no devolvería los otros dos, sino la excepción 02: `11 83 02 C1 34`.
  ]

  #solucion("ej-44.9")[
    1 013,25 en IEEE 754 es 447D5000#sub[16]: se envían los registros 447D#sub[16] y 5000#sub[16]. Con el orden contrario, el cliente interpreta 5000447D#sub[16] = 8,61 × 10#super[9]. Para 23,5 °C, 41BC0000#sub[16]: registros 41BC#sub[16] y 0000#sub[16], y con el orden contrario 000041BC#sub[16] = 2,36 × 10#super[−41], un número tan pequeño que se ve como cero. Por eso un error de orden puede pasar inadvertido con unos valores y no con otros. La prueba: leer los dos registros como enteros y compararlos con un valor conocido que tenga las dos mitades distintas de cero, como 1 013,25.
  ]

  #solucion("ej-44.10")[
    La petición tiene 8 bytes y la respuesta 5 + 12 = 17. A 9 600 bit/s (1,146 ms por carácter): 9,17 + 4,01 + 0,5 + 19,48 + 4,01 = 37,2 ms por transacción y 446 ms por vuelta. A 19 200 bit/s: 18,8 ms y 226 ms. Con un nodo desconectado, su transacción se reduce a la petición más los 200 ms de espera: 618 ms por vuelta a 9 600 bit/s y 412 ms a 19 200 bit/s. A 19 200 bit/s, el nodo caído pesa casi tanto como todos los demás juntos: el tiempo de espera debe ser el mínimo que admitan los equipos.
  ]

  #solucion("ej-44.11")[
    32 cargas unidad equivalen a 128 transceptores de 1/4. Con 63 de ellos y el maestro, n = 63/4 + 1 = 16,75 cargas unidad, que en modo diferencial son 2 × 12 kΩ/16,75 = 1 433 Ω, en paralelo con 60 Ω: Z#sub[d] = 57,6 Ω. La tensión de reposo es 5 × 57,6/(2 × 560 + 57,6) = 244,5 mV (ngspice: 244,52 mV), por encima de 200 mV. La mayor resistencia de polarización sale de 200 mV = 5 × 57,6/(2R#sub[p] + 57,6): R#sub[p] = 691 Ω. Las cargas reducidas, además de admitir más nodos, dejan más margen a la polarización.
  ]

  #solucion("ej-44.12")[
    Los datos son 120 × 8 = 960 bytes. La trama suma 14 bytes de cabecera Ethernet, 2 de cabecera EtherCAT, 10 de cabecera del datagrama, los 960 de datos, 2 del contador de trabajo y 4 del CRC: 992 bytes, que con el preámbulo y la separación (20 bytes más) ocupan 1 012 × 80 ns = 81,0 µs. Con 120 esclavos a 0,5 µs, el ciclo mínimo es de unos 141 µs. Con una trama Ethernet mínima (64 bytes, 84 con preámbulo y separación) por módulo y sentido, 240 tramas ocupan 1 613 µs, más de once veces más, aunque cada una lleve solo 4 bytes útiles.
  ]

  #solucion("ej-44.13")[
    La PDU de la función 16 es `10 01 00 00 03 06 00 0A 01 2C FF 9C` (dirección, cantidad, número de bytes y los tres valores; −100 es FF9C#sub[16] en complemento a dos). El campo de longitud cuenta la unidad y la PDU: 1 + 12 = 13 (000D#sub[16]). Trama TCP, 19 bytes: `12 34 00 00 00 0D 0A 10 01 00 00 03 06 00 0A 01 2C FF 9C`. En el bus, la pasarela pone la unidad como dirección y añade el CRC: `0A 10 01 00 00 03 06 00 0A 01 2C FF 9C E1 5A`, 15 bytes. La respuesta repite dirección y cantidad: `0A 10 01 00 00 03 80 8F`, 8 bytes. A 19 200 bit/s: 15 × 0,573 + 2,005 + 0,5 + 8 × 0,573 + 2,005 = 17,7 ms. La pasarela devuelve al SCADA la misma respuesta con la cabecera MBAP (longitud 6).
  ]

  #solucion("ej-44.14")[
    A 1,5 Mbit/s el segmento admite 200 m; con 350 m hay que bajar a 500 kbit/s, que admite 400 m (a 187,5 kbit/s se llegaría a 1 000 m). Las dos terminaciones activas en paralelo equivalen a 195 Ω a 5 V, 110 Ω entre B y A y 195 Ω a masa; las 32 cargas unidad añaden 750 Ω diferenciales, y en paralelo con los 110 Ω dan 95,9 Ω. La tensión de reposo es 5 × 95,9/(390 + 95,9) = 0,99 V (ngspice: 987 mV), cinco veces el umbral. Con un extremo a 0 V, cada terminación es, en modo diferencial, una fuente de 1,1 V o de 0 V con 171,6 Ω (220 Ω en paralelo con 390 + 390 Ω); juntas, 0,55 V con 85,8 Ω, y con las cargas, 0,55 × 750/(85,8 + 750) = 0,49 V (ngspice: 493,5 mV). La impedancia de la terminación no cambia y la polarización se reduce a la mitad, pero sigue por encima de 200 mV: el bus funciona. Si se apagaran las dos estaciones de los extremos, la tensión de reposo sería cero y el reposo quedaría indefinido; por eso, donde puede ocurrir, se usan terminaciones con alimentación propia.
  ]
]
