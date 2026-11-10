// P02 — «Máquinas Eléctricas y Accionamientos»: a NEW CHAPTER for «Electrónica Práctica Avanzada».
// Provisional part id and file name: cap-new-maquinas (cap-new-maquinas.typ). All labels use that prefix and every
// cross-reference is a label (#nr), never a hand-written number, because the chapter renumbers the ones after it.
// Placement: tomo V, right after «Electrónica de Potencia y Conversión de Energía» (cap33.typ, printed 32). On its
// own the new chapter is 33 and 33-53 become 34-54 (with P03 in option A as well: 34, and 34-53 become 35-54).
// Colour A6552B («Electrónica de grado»). It absorbs the old section 32.13 «Ampliación: Máquinas Eléctricas y
// Accionamientos» (sec-33.13): see NOTAS.md for what to remove there and where its references go.
// Inverters, SVPWM and controlled rectifiers are NOT treated here: they are P04's <sec-new-33-inversor> and
// <sec-new-33-rectificadores>; three-phase basics are P01's <sec-new-24-trifasica>; contactor wiring and star-delta
// are P03's <sec-new-automatas.1>.
// Every number comes from scripts/calculos.py (machine models in scripts/maquinas.py) and the circuit checks from the
// ngspice runs in spice/ (scripts/spice_gen.py, spice_analisis.py).

#capitulo("A6552B")[Máquinas Eléctricas y Accionamientos] <cap-new-maquinas>

El puente en H de la sección #nr("sec-33.9") gobierna un motor, y el inversor de la sección #nr("sec-new-33-inversor") alimenta uno de inducción; este capítulo trata de lo que hay al otro lado del cable. Una máquina eléctrica convierte energía eléctrica en mecánica, o al revés, a través de un campo magnético, y las de todas las clases responden a dos leyes que ya han aparecido en el libro: la de Faraday (sección #nr("sec-4.1")) y la fuerza sobre una corriente en un campo. El capítulo empieza por el circuito magnético, sigue con el transformador trifásico, que es una máquina sin movimiento, y recorre las tres familias de motores: el de corriente continua, el de inducción y el síncrono con sus variantes de imanes. Termina con lo que pide un proyecto: el accionamiento que los gobierna, cómo se elige y se protege un motor, y un problema de diseño completo.

#nota[
  Los modelos de este capítulo son los de régimen permanente, por fase y sin saturación, que son los que permiten calcular a mano. Todas sus cifras salen de ellos, y los circuitos equivalentes se han comprobado con ngspice, el simulador de la app (capítulo #nr("cap-42")).
]

== El Circuito Magnético: de la Corriente al Par <sec-new-maquinas.1>

=== La ley de Ohm magnética

La sección #nr("sec-4.10") presentó la #strong[reluctancia], ℛ = l/(µ#sub[0]·µ#sub[r]·A), y la ley de Ohm magnética: las espiras por la corriente, N·I, la #strong[fuerza magnetomotriz], hacen circular un flujo Φ por un camino de reluctancia ℛ, y Φ = N·I/ℛ. En una máquina ese camino es casi todo hierro, más uno o dos entrehierros que no se pueden evitar porque una parte gira. La figura #nr("fig-new-maquinas.1") muestra el caso más simple: un núcleo de chapa con un entrehierro g, una bobina y su circuito equivalente, dos reluctancias en serie.

#figura("maq-circuito-magnetico.svg", 70%, [(a) Núcleo de chapa con una bobina de N espiras y un entrehierro g; el flujo Φ recorre el hierro y cruza el aire. (b) Su circuito equivalente: la fuerza magnetomotriz N·I y las reluctancias del hierro y del entrehierro en serie, con los valores del ejemplo.]) <fig-new-maquinas.1>

#ejemplo[
  El núcleo tiene 30 cm de longitud media en chapa de µ#sub[r] = 4 000, 10 cm² de sección y un entrehierro de 1 mm, y se quiere 1 T en el aire. La reluctancia del hierro es 0,30/(4π·10#super[−7] × 4 000 × 10#super[−3]) = 59,7·10³ A/Wb, y la del entrehierro, 10#super[−3]/(4π·10#super[−7] × 10#super[−3]) = 795,8·10³ A/Wb: 13,3 veces más con una longitud trescientas veces menor. Para un flujo de 1 mWb hacen falta 855 amperios-vuelta, 4,28 A con 200 espiras, y el 93 % de ellos se gastan en cruzar el milímetro de aire. La inductancia de la bobina es N²/ℛ = 46,8 mH.
]

Por eso los entrehierros de las máquinas son tan pequeños como permite la mecánica (de unas décimas de milímetro a unos pocos milímetros) y la corriente que magnetiza una máquina depende sobre todo de ellos. El cálculo ignora dos cosas: el flujo que se abomba en los bordes del entrehierro, que aumenta su sección efectiva, y la saturación, que hace que µ#sub[r] caiga muy deprisa por encima de 1,5 T en la chapa de silicio (sección #nr("sec-4.10")). Las pérdidas del hierro, por histéresis y por corrientes de Foucault, son las de la sección #nr("sec-4.9"), y por eso todas las máquinas de alterna se hacen de chapa.

=== Dónde está la energía y de dónde sale la fuerza

La energía de un circuito magnético se reparte como la de unas resistencias en serie con la misma corriente: ½·Φ²·ℛ en cada tramo. En el ejemplo, 0,398 J en el entrehierro y 0,030 J en el hierro: la energía está en el aire. Y la fuerza sale de ella. Si el entrehierro se cierra un poco con el flujo constante, su reluctancia y su energía bajan, y la diferencia es el trabajo de la fuerza que atrae las dos caras. Por unidad de longitud, la energía del aire es B²·A/(2·µ#sub[0]), y esa es la fuerza:

#ec[$ F = (B^("2") dot.op A)/("2" dot.op µ_("0")) $]

Con 1 T sobre 10 cm² son 398 N, el peso de 40,6 kg, en cada cara: es la fuerza de un electroimán, de un relé o de un contactor. Un rotor de hierro con salientes, libre de girar, tiende por la misma razón a ponerse donde la reluctancia es mínima; es el #strong[par de reluctancia], que mueven el motor paso a paso y el de reluctancia conmutada.

=== El conductor en el campo: par y fuerza electromotriz

La otra manera de sacar una fuerza de un campo es la de casi todos los motores. Un conductor de longitud l que lleva una corriente I a través de un campo B perpendicular a él sufre una fuerza B·l·I; y si se mueve a velocidad v cortando el campo, entre sus extremos aparece una fuerza electromotriz B·l·v. En un rotor de radio r que gira a ω, v = ω·r, y cada conductor aporta un par B·l·r·I. Con un campo radial (el que crean unos polos alrededor del rotor) y una bobina de N espiras cuyos dos lados están siempre bajo polos opuestos:

#deduccion[La misma constante para el par y para la tensión][
  #eclabel[#strong[Ec. 1 — Par y fuerza electromotriz]]
  #ec[$ T = k dot.op I quad quad E = k dot.op ω quad quad k = "2" dot.op N dot.op B dot.op l dot.op r $]

  #strong[Origen.] Cada lado de cada espira recibe una fuerza B·l·I a la distancia r del eje; son 2·N lados, todos empujando en el mismo sentido, y el par es 2·N·B·l·r·I. Cada lado se mueve a ω·r y genera B·l·ω·r; en serie, los 2·N suman 2·N·B·l·r·ω.

  #strong[Por qué es la misma k.] Multiplicando, E·I = k·ω·I = T·ω: la potencia eléctrica que absorbe la fuerza electromotriz es exactamente la potencia mecánica del eje. No es una coincidencia de esta geometría, sino la conservación de la energía, y vale para cualquier máquina en unidades SI (V·s/rad para k en la tensión, N·m/A en el par, que son la misma unidad).

  #strong[Dominio de validez.] Campo uniforme y radial bajo los polos, y lados que cambian de sentido de corriente al pasar de un polo al otro: es lo que hace el colector del motor de continua (sección #nr("sec-new-maquinas.3")) o la electrónica de un BLDC (sección #nr("sec-new-maquinas.5")).
]

Con 100 espiras, lados de 4 cm a 12,5 mm del eje y 0,5 T, k = 2 × 100 × 0,5 × 0,04 × 0,0125 = 0,05 V·s/rad: con 5 A da 0,25 N·m, y girando a 480 rad/s genera 24 V. Son las cifras del motor de continua que se usa en la sección #nr("sec-new-maquinas.3").

== El Transformador Trifásico <sec-new-maquinas.2>

=== Tres columnas y un grupo de conexión

El transformador monofásico y su modelo están en las secciones #nr("sec-4.6") y #nr("sec-24.9"). Para la red trifásica (sección #nr("sec-new-24-trifasica")) podrían usarse tres monofásicos, y en las potencias muy grandes se hace; lo normal es un núcleo de #strong[tres columnas], una por fase, con el primario y el secundario de cada fase bobinados en la misma. Como los tres flujos suman cero en cada instante, igual que las tres corrientes de un sistema equilibrado, no hace falta una cuarta columna de retorno, y se ahorra hierro.

Los devanados de cada lado se conectan en estrella o en triángulo, y la combinación se escribe con una letra mayúscula para el lado de alta (Y, D o Z, la conexión en zigzag), una minúscula para el de baja, una n si se saca el neutro y el #strong[índice horario]: el desfase entre la tensión de fase del lado de baja y la del de alta en múltiplos de 30°, leído como las horas de un reloj cuyas 12 marca la de alta. El de los centros de transformación de distribución es casi siempre #strong[Dyn11] (figura #nr("fig-new-maquinas.2")): alta en triángulo, baja en estrella con neutro, y la baja adelantada 30°.

#figura("maq-dyn11.svg", 70%, [El grupo Dyn11. (a) El primario en triángulo; el devanado de la columna U está entre 1U y 1V. (b) El secundario en estrella con neutro. Las bobinas de la misma columna tienen tensiones paralelas: la de 2u apunta a las 11 si la tensión de fase equivalente de 1U apunta a las 12.]) <fig-new-maquinas.2>

Cada letra de Dyn11 tiene un motivo. El neutro en estrella da las dos tensiones de la red, 400 V entre fases y 230 V a neutro. El triángulo del primario deja circular dentro de él las corrientes de tercer armónico de las cargas monofásicas (sección #nr("sec-new-24-trifasica")), que así no salen a la red de alta. Y una carga monofásica en el secundario, que solo carga una columna, se ve en el primario como corriente entre dos líneas, sin necesidad de neutro en alta. El índice importa para conectar dos transformadores en paralelo: tienen que tener el mismo índice, la misma relación de tensiones y tensiones de cortocircuito parecidas, o circula corriente entre ellos sin carga.

Con el primario en triángulo y el secundario en estrella, la relación de espiras no es la de las tensiones de línea. Un transformador de 20 000/400 V Dyn11 tiene en cada devanado de alta los 20 000 V de línea y en cada uno de baja 400/√3 = 230,9 V: N#sub[1]/N#sub[2] = 86,6, mientras que las tensiones de línea están en relación 50.

=== Los ensayos de vacío y de cortocircuito

El modelo por fase de la sección #nr("sec-4.6"), referido al lado de baja y con las fases en estrella equivalente, tiene una rama en paralelo (R#sub[Fe] por las pérdidas del hierro, X#sub[m] por la corriente magnetizante) y una impedancia en serie, R#sub[cc] + jX#sub[cc], que reúne el cobre y la dispersión de los dos devanados. Sus cuatro valores se miden con dos ensayos que no necesitan cargar el transformador con su potencia:

- #strong[Vacío]: se alimenta un lado a su tensión nominal (normalmente el de baja) con el otro abierto. La corriente es pequeña y la caída en serie, despreciable: el vatímetro mide las pérdidas del hierro P#sub[0], y con la corriente I#sub[0] salen R#sub[Fe] y X#sub[m].
- #strong[Cortocircuito]: con el otro lado en cortocircuito, se sube la tensión desde cero hasta que circula la corriente nominal. Hace falta solo un pequeño porcentaje de la tensión nominal, la #strong[tensión de cortocircuito] ε#sub[cc]\; con tan poca tensión el hierro apenas pierde, y el vatímetro mide las pérdidas del cobre a plena carga, P#sub[cc].

#ejemplo[
  Un transformador de 100 kVA, 20 000/400 V, Dyn11, tiene P#sub[0] = 210 W con I#sub[0] = 1,5 % y P#sub[cc] = 1 750 W con ε#sub[cc] = 4 % (valores típicos de esta potencia). Las corrientes nominales son 2,89 A en alta y 144,3 A en baja, y la impedancia base del lado de baja, 400²/100 000 = 1,6 Ω. \
  #strong[Rama serie]: Z#sub[cc] = 0,04 × 1,6 = 64 mΩ; R#sub[cc] = 1 750/(3 × 144,3²) = 28,0 mΩ (el 1,75 %), y X#sub[cc] = √(64² − 28²) = 57,5 mΩ (el 3,60 %). El ensayo se hizo con 800 V entre fases en el lado de alta. \
  #strong[Rama paralelo]: I#sub[0] = 2,17 A con cos φ#sub[0] = 210/(√3 × 400 × 2,17) = 0,14; R#sub[Fe] = 230,9²/70 = 762 Ω y X#sub[m] = 107,7 Ω. \
  #strong[Corriente de cortocircuito]: con la red de alta como fuente ideal, un cortocircuito en bornes de baja deja pasar I#sub[n]/ε#sub[cc] = 3,61 kA. Es el dato con que se eligen el poder de corte de las protecciones de baja (sección #nr("sec-10.3")) y los esfuerzos que deben soportar los embarrados.
]

=== Caída de tensión y rendimiento

Con carga, la tensión del secundario baja. Para una carga c veces la nominal con factor de potencia cos φ, la aproximación de Kapp da la caída en tanto por uno:

#ec[$ ε approx c dot.op ( ε_("R") dot.op cos φ + ε_("X") dot.op sin φ ) $]

A plena carga con cos φ = 0,8 inductivo, ε = 1,75 × 0,8 + 3,60 × 0,6 = 3,56 %, y el secundario da 385,8 V (el cálculo con fasores da 385,7 V); con cos φ = 1, la caída es solo la resistiva, 1,75 %. Por eso los transformadores de distribución tienen tomas que suben un 2,5 o un 5 % la tensión del secundario.

El rendimiento sale de las dos pérdidas: P#sub[0] no depende de la carga y P#sub[cc] crece con su cuadrado. A plena carga con cos φ = 0,8, 80 kW de salida y 1 960 W de pérdidas dan el 97,61 %. Como en la sección #nr("sec-4.6"), el máximo está donde las dos se igualan, c = √(P#sub[0]/P#sub[cc]) = 34,6 %, con el 98,51 %; y al 25 % de carga el rendimiento aún es del 98,43 %. Un transformador de distribución pasa la mayor parte del año con poca carga, y sus pérdidas del hierro están ahí las 8 760 horas: 1 840 kWh al año en este, frente a 2 453 kWh de cobre si trabajase todo el año al 40 % de carga. Es la razón de que se diseñen con P#sub[0] bajas y de que la chapa de grano orientado y los núcleos amorfos se paguen.

#comprobacion[
  El modelo por fase en ngspice: el ensayo de vacío a 230,9 V da 2,165 A y 210 W; el de cortocircuito al 4 %, 144,3 A y 1 750 W. Con una carga de impedancia constante que a 400 V tomaría la corriente nominal con cos φ = 0,8 (1,6 Ω a 36,9°), el secundario queda a 386,2 V con 139,4 A; la fórmula de Kapp con esa corriente (c = 0,965) da 386,3 V.
]

#strong[En el banco.] Los dos ensayos son la manera de caracterizar un transformador desconocido sin cargarlo. En uno de laboratorio, el de cortocircuito se hace con un autotransformador variable subiendo desde cero, y el de vacío informa también del estado del núcleo: una I#sub[0] o una P#sub[0] mucho mayores que las de su placa indican espiras en cortocircuito o chapas dañadas.

== La Máquina de Corriente Continua <sec-new-maquinas.3>

=== Cómo está hecha

El #strong[inductor], en el estátor, crea un campo fijo con imanes permanentes (los motores pequeños y medianos de hoy) o con un devanado de excitación. El #strong[inducido], en el rotor, lleva las bobinas, cuyos extremos van a las delgas de un #strong[colector] sobre el que rozan unas escobillas de grafito. El colector es un conmutador mecánico: invierte la corriente de cada bobina cuando pasa de un polo al otro, y así se cumple la condición de la Ec. 1, todos los conductores bajo un polo con la corriente en el mismo sentido. Es también el punto débil de la máquina: se desgasta, chispea (y emite interferencias, capítulo #nr("cap-32")) y limita la velocidad.

=== Las ecuaciones y la recta par-velocidad

El inducido es una resistencia R y una inductancia L en serie con la fuerza electromotriz E = k·ω (figura #nr("fig-new-maquinas.3")a), y el eje sigue la segunda ley de Newton para la rotación, con J el momento de inercia de todo lo que gira:

#ec[$ V = E + I dot.op R + L dot.op (d I)/(d t) quad quad E = k dot.op ω quad quad T = k dot.op I quad quad J dot.op (d ω)/(d t) = T - T_("carga") $]

En régimen permanente, con el par T = k·I que pide la carga, la velocidad es una recta descendente:

#ec[$ ω = V/k - (R)/(k^("2")) dot.op T $]

Corta el eje de velocidades en la #strong[velocidad en vacío], ω#sub[0] = V/k, y el de pares en el #strong[par de arranque] o de bloqueo, T#sub[b] = k·V/R. Con el motor de 24 V, R = 0,5 Ω y k = 0,05 V·s/rad, ω#sub[0] = 480 rad/s (4 584 rpm) y T#sub[b] = 2,4 N·m, con 48 A. Cada newton-metro de carga le quita 1 910 rpm:

#tabla(none, columns: 5, align: (left, right, right, right, right,),
  [Corriente], [Par], [Velocidad], [Potencia en el eje], [Rendimiento],
  [0 A (vacío)], [0 N·m], [4 584 rpm], [0 W], [—],
  [2 A], [0,100 N·m], [4 393 rpm], [46,0 W], [95,8 %],
  [5 A], [0,250 N·m], [4 106 rpm], [107,5 W], [89,6 %],
  [24 A], [1,2 N·m], [2 292 rpm], [288 W], [50 %],
)

El rendimiento es E/V, porque la única pérdida del modelo es la del cobre. La potencia mecánica es máxima a media velocidad y medio par, V²/(4·R) = 288 W, pero con un rendimiento del 50 % y doce veces la corriente de la fila de 2 A: es un punto que el motor no aguanta más que unos instantes. La zona de trabajo continuo es la de arriba, cerca de la velocidad en vacío, y su límite lo pone el calor del cobre: la corriente nominal. Como el par es proporcional a la corriente, limitar la corriente es limitar el par. Las hojas de datos de los motores pequeños dan el par en mN·m o en kg·cm (1 kg·cm = 0,098 N·m) y distinguen el nominal, que el motor da de forma continua, del de arranque o de bloqueo.

#figura("maq-cc.svg", 70%, [El motor de continua. (a) El circuito del inducido: la fuerza electromotriz E = k·ω es una fuente que depende de la velocidad. (b) Sus rectas par-velocidad para cuatro tensiones del inducido: bajar V desplaza la recta sin cambiar su pendiente; los puntos son los de 2 y 5 A de la tabla.]) <fig-new-maquinas.3>

=== El arranque y las dos constantes de tiempo

Con el rotor parado, E = 0 y la corriente solo la limita R: 48 A, veinticuatro veces la de 2 A. Las ecuaciones tienen dos constantes de tiempo, la eléctrica τ#sub[e] = L/R y la #strong[electromecánica] τ#sub[m] = J·R/k²: con L = 50 µH y J = 10#super[−4] kg·m², 0,1 ms y 20 ms. La eléctrica es tan corta que la corriente llega casi a su valor de bloqueo antes de que el rotor se mueva, y luego cae con la constante mecánica a medida que crece E (figura #nr("fig-new-maquinas.4")a). De ahí que un motor de continua no se conecte a pelo a la fuente: hace falta limitar la corriente, con el lazo de corriente de una fuente como la del capítulo #nr("cap-50") o con una rampa de tensión hecha con PWM. Con una rampa de 0 a 24 V en 0,2 s el rotor sigue a la tensión con una aceleración de 480/0,2 = 2 400 rad/s², que pide J·α = 0,24 N·m: 4,8 A durante toda la rampa (figura #nr("fig-new-maquinas.4")b).

#figura("maq-cc-arranque.svg", 70%, [Arranque del motor de 24 V en vacío, simulado con ngspice (L = 50 µH, J = 10#super[−4] kg·m²). (a) En directo: 47,0 A de pico y la velocidad sube con τ#sub[m] = 20 ms. (b) Con una rampa de tensión de 0,2 s: la corriente no pasa de 4,8 A.]) <fig-new-maquinas.4>

#comprobacion[
  En ngspice, con el modelo electromecánico del motor (la velocidad es la tensión de un nodo y la inercia, un condensador de J faradios): en directo, 46,96 A de pico, el 63 % de la velocidad final a los 20,0 ms y 479,7 rad/s al final; con la rampa, 4,80 A como máximo. Con escalones de carga de 0,100 y 0,250 N·m, 4 392,7 y 4 106,2 rpm con 2,00 y 5,00 A, las cifras de la tabla.
]

=== Control por el inducido, por el campo y el frenado

La recta muestra las dos maneras de cambiar la velocidad. Bajando V, con PWM y un puente en H (sección #nr("sec-33.9")), la recta se desplaza paralela a sí misma (figura #nr("fig-new-maquinas.3")b): para 2 000 rpm con 0,25 N·m hacen falta 13,0 V, un ciclo de trabajo del 54,0 %. Es el #strong[control por el inducido], con par disponible constante en toda la gama porque el par lo da la corriente. Si el inductor es un devanado, puede además bajarse el flujo: k disminuye y ω#sub[0] = V/k sube por encima de la velocidad nominal, a cambio de menos par por amperio. Es el #strong[debilitamiento de campo], con potencia constante en vez de par constante; con imanes no es posible.

Los motores con el devanado de excitación en #strong[serie] con el inducido tienen el par proporcional al cuadrado de la corriente, un par de arranque enorme y una velocidad que se dispara en vacío: son los de tracción clásica y, alimentados en alterna (el par no cambia de signo si la corriente se invierte en los dos devanados), el #strong[motor universal] de taladros y aspiradoras. En derivación o con imanes, la velocidad varía poco con la carga.

Si la tensión aplicada baja por debajo de E, la corriente se invierte y el motor frena devolviendo energía: es el funcionamiento como generador de los cuadrantes II y IV de la sección #nr("sec-33.9"). Con el motor en vacío a 480 rad/s (E = 24 V), bajar el puente a 12 V da al instante −24 A y −1,2 N·m de par de frenado. Hasta 240 rad/s el rotor suelta ½·J·(480² − 240²) = 8,64 J; la fuente recibe 5,76 J y el resto, 2,88 J, se queda en R. Si la fuente es un rectificador que no puede absorberlos y el bus tiene 1 000 µF, esos 5,76 J lo llevan de 24 a 110 V: por eso los accionamientos llevan resistencia de frenado (sección #nr("sec-new-maquinas.6")).

Los motores de continua grandes se alimentan con rectificadores controlados (sección #nr("sec-new-33-rectificadores")), y el control de velocidad casi siempre se hace con dos lazos en cascada: uno interno de corriente, rápido, que limita el par y protege el puente, y uno externo de velocidad que le da la consigna de corriente, cada uno con un PI (sección #nr("sec-31.2")).

== El Motor de Inducción <sec-new-maquinas.4>

=== El campo giratorio y el deslizamiento

Tres bobinas separadas 120° en el estátor y alimentadas con corrientes trifásicas crean un campo de amplitud constante que gira (sección #nr("sec-new-24-trifasica")). Con p polos (dos por cada juego de tres bobinas), gira a la #strong[velocidad síncrona]:

#ec[$ n_("s") = ("120" dot.op f)/(p) quad lr([ "rpm" ]) $]

3 000 rpm con 2 polos a 50 Hz, 1 500 con 4, 1 000 con 6 (a 60 Hz, 3 600, 1 800 y 1 200). (Muchos textos usan p para los pares de polos y escriben n#sub[s] = 60·f/p; es la misma fórmula.) Invertir dos fases invierte el sentido de giro del campo y del motor.

El rotor de #strong[jaula de ardilla] son barras de aluminio o de cobre cortocircuitadas por dos anillos, sin ninguna conexión exterior. Si gira más despacio que el campo, las barras cortan sus líneas, se induce en ellas una tensión, circula corriente y aparece par; a la velocidad síncrona no habría movimiento relativo ni par. El rotor siempre se queda un poco atrás, y ese retraso relativo es el #strong[deslizamiento]:

#ec[$ s = (n_("s") - n)/(n_("s")) $]

Las corrientes del rotor tienen frecuencia s·f, unos pocos hercios a plena carga. Hay también rotores bobinados, con anillos rozantes para conectar resistencias exteriores, hoy casi limitados a potencias grandes.

=== El circuito equivalente

Visto desde el estátor, el motor es un transformador cuyo secundario gira: la misma rama paralelo (R#sub[Fe], X#sub[m]), las impedancias del estátor (R#sub[1], X#sub[1]) y las del rotor referidas a él (R#sub[2]′, X#sub[2]′). La diferencia es que en el rotor la tensión inducida y la frecuencia son s veces las de parado, y al dividir su ecuación por s la resistencia del rotor aparece como R#sub[2]′/s (figura #nr("fig-new-maquinas.5")). Ese término se separa en dos: R#sub[2]′, la pérdida real del cobre del rotor, y R#sub[2]′·(1 − s)/s, una resistencia ficticia cuya potencia es la mecánica.

#figura("maq-induccion-circuito.svg", 70%, [Circuito equivalente por fase del motor de inducción, en estrella equivalente y referido al estátor. La potencia que entra en R#sub[2]′/s es la que cruza el entrehierro; la parte de R#sub[2]′·(1 − s)/s es la que sale al eje.]) <fig-new-maquinas.5>

#deduccion[El par del motor de inducción][
  #eclabel[#strong[Ec. 2 — Balance de potencias y par]]
  #ec[$ P_("ent") = "3" dot.op I_("2")^(′ "2") dot.op (R_("2")^′)/(s) quad quad P_("Cu2") = s dot.op P_("ent") quad quad P_("mec") = ( "1" - s ) dot.op P_("ent") quad quad T = (P_("ent"))/(ω_("s")) $]

  #strong[Origen.] P#sub[ent], la potencia que cruza el entrehierro, es la que entra en R#sub[2]′/s en las tres fases. Partiendo R#sub[2]′/s en R#sub[2]′ + R#sub[2]′·(1 − s)/s, la primera parte es s·P#sub[ent] y la segunda (1 − s)·P#sub[ent]. Esa segunda es T·ω, con ω = (1 − s)·ω#sub[s]\; despejando, T = P#sub[ent]/ω#sub[s].

  #strong[Consecuencia.] La pérdida del cobre del rotor es el deslizamiento por la potencia que cruza el entrehierro: un motor que trabaja con mucho deslizamiento, sea por la carga o porque se le frena bajando la tensión, calienta el rotor en proporción. Por eso el rendimiento de un motor de inducción no puede pasar de 1 − s.

  #strong[Par máximo.] Con el estátor y la rama paralelo reducidos a su equivalente de Thévenin (V#sub[th], R#sub[th] + jX#sub[th]), el par es máximo cuando R#sub[2]′/s iguala el módulo de la impedancia que ve: s#sub[máx] = R#sub[2]′/√(R#sub[th]² + (X#sub[th] + X#sub[2]′)²), y el valor de ese máximo no depende de R#sub[2]′.
]

=== Un motor de 4 kW, con números

Un motor de 4 kW, 400 V, 50 Hz y 4 polos se modela con R#sub[1] = 1,4 Ω, R#sub[2]′ = 1,1 Ω, X#sub[1] = X#sub[2]′ = 2,0 Ω, X#sub[m] = 55 Ω y R#sub[Fe] = 2 500 Ω por fase en estrella equivalente, y 39 W de rozamiento y ventilación: valores elegidos para que su punto nominal se parezca al de un motor de catálogo. Da los 4 kW a 1 449 rpm (s = 3,39 %, 1,70 Hz en el rotor) con 7,89 A, cos φ = 0,823 y un rendimiento del 89,0 %. Su par nominal es 4 000/(2π × 1 449/60) = 26,4 N·m. El reparto de la potencia:

#tabla(none, columns: 3, align: (left, right, left,),
  [Concepto], [Potencia], [De dónde sale],
  [Absorbida de la red], [4 496 W], [√3·V#sub[L]·I·cos φ],
  [Cobre del estátor], [261 W], [3·I#sub[1]²·R#sub[1]],
  [Hierro], [54 W], [3·E²/R#sub[Fe]],
  [Cruza el entrehierro], [4 180 W], [3·I#sub[2]′²·R#sub[2]′/s],
  [Cobre del rotor], [142 W], [s·P#sub[ent]],
  [Mecánica interna], [4 039 W], [(1 − s)·P#sub[ent]],
  [Rozamiento y ventilación], [39 W], [—],
  [Útil en el eje], [4 000 W], [—],
)

La curva par-velocidad de la figura #nr("fig-new-maquinas.6") se lee de derecha a izquierda. Cerca de la velocidad síncrona es casi una recta empinada: entre vacío y plena carga la velocidad solo baja 50 rpm, y el motor de inducción es, en la práctica, de velocidad casi constante. El par crece al cargarlo hasta el #strong[par máximo], 86,5 N·m (3,28 veces el nominal) a 1 104 rpm; si la carga pide más, la velocidad se hunde y el motor se para. A la izquierda del máximo está la zona del arranque, que solo se recorre al arrancar: con el rotor parado, 48,5 N·m (1,84 veces el nominal) y 49,8 A, 6,32 veces la corriente nominal, con cos φ = 0,52.

#figura("maq-induccion-curvas.svg", 70%, [Par (continuo) y corriente de línea (trazos) del motor de 4 kW en función de la velocidad, a 400 V y 50 Hz. Las curvas de dos cargas típicas: par constante al 60 % del nominal (una cinta) y par cuadrático (un ventilador o una bomba centrífuga). Cada una corta la del motor en su punto de trabajo.]) <fig-new-maquinas.6>

#comprobacion[
  El circuito por fase en ngspice, con un análisis de alterna a 50 Hz para cada deslizamiento: con s = 1, 49,84 A y 48,54 N·m; con s = 0,264, 86,51 N·m; con el deslizamiento nominal, 7,887 A y 26,61 N·m de par electromagnético (los 26,4 del eje más el rozamiento). Coinciden con el cálculo con fasores en las cuatro cifras.
]

Los motores reales arrancan con más par que este modelo, de 2 a 2,5 veces el nominal en un motor de este tamaño, porque sus barras son profundas o la jaula es doble: a la frecuencia del rotor parado la corriente se concentra en la parte exterior de la barra (el efecto pelicular de la sección #nr("sec-33.14")) y la resistencia del rotor es mayor al arrancar que en marcha. El circuito de jaula simple no lo recoge; para el punto nominal y el par máximo es suficiente.

=== Arrancarlo

La punta de arranque es el problema. En directo, el motor de 4 kW toma 49,8 A, y en motores mayores esa corriente provoca una caída de tensión en la instalación que se nota en las demás cargas. Las alternativas reducen la tensión durante el arranque, y como la corriente es proporcional a la tensión y el par a su cuadrado, todas pagan en par:

- #strong[Estrella-triángulo] (sección #nr("sec-new-automatas.1")): un tercio de la corriente y un tercio del par. En este motor, 16,6 A y 16,2 N·m, el 61 % del nominal: arranca un ventilador, pero no una cinta cargada al 60 %.
- #strong[Arrancador suave]: tiristores en antiparalelo en cada fase (sección #nr("sec-10.1")) que suben la tensión eficaz con una rampa. Con la mitad de la tensión, 24,9 A y 12,1 N·m.
- #strong[Variador de frecuencia]: arranca a frecuencia baja, donde la corriente nominal da el par nominal (sección #nr("sec-new-maquinas.6")). Es el único de los tres que no pierde par.

== La Máquina Síncrona y los Motores de Imanes Permanentes <sec-new-maquinas.5>

=== La máquina síncrona

Si el rotor lleva su propio campo, con un devanado alimentado en continua o con imanes, se engancha al campo giratorio y gira exactamente a n#sub[s], sin deslizamiento. Es la #strong[máquina síncrona]: todos los alternadores de las centrales lo son, y como motor se usa donde hace falta una velocidad exacta o un factor de potencia ajustable. Por fase es una fuerza electromotriz E, proporcional a la excitación y a la velocidad, detrás de una reactancia síncrona X#sub[s], y la potencia depende del #strong[ángulo de carga] δ entre E y la tensión de la red V:

#ec[$ P = ("3" dot.op V dot.op E)/(X_("s")) dot.op sin δ $]

Con V = 230,9 V por fase, E = 250 V y X#sub[s] = 10 Ω, la potencia máxima, con δ = 90°, es 17,3 kW (110,3 N·m a 1 500 rpm); para dar 10 kW trabaja con δ = 35,3°, 14,7 A y cos φ = 0,983. Si la carga pide más que el máximo, el rotor #strong[pierde el sincronismo] y se descuelga, con corrientes y pares que oscilan violentamente. Cambiando la excitación cambia E y, con la misma potencia, la potencia reactiva: sobreexcitada, la máquina entrega reactiva a la red como un condensador (sección #nr("sec-24.8")). Un motor síncrono conectado a la red no arranca solo, porque el campo gira demasiado deprisa para que el rotor lo alcance; lleva una jaula de arranque o se arranca con un variador que sube la frecuencia desde cero.

=== PMSM y BLDC

Con imanes en el rotor y un inversor que genera el campo giratorio a la velocidad del rotor, el arranque deja de ser un problema y se tiene el motor más eficiente y compacto que se fabrica: no hay corrientes en el rotor ni pérdidas en él, ni colector, ni escobillas. Hay dos variantes, según la forma de su fuerza electromotriz:

- El #strong[PMSM] (#emph[permanent magnet synchronous motor]) la tiene senoidal y se alimenta con corrientes senoidales en las tres fases, con control vectorial (sección #nr("sec-new-maquinas.6")) y un sensor de posición fino (encoder o resolver) o un observador que la estima. Da un par sin rizado: servos, vehículos eléctricos, compresores.
- El #strong[BLDC] (#emph[brushless DC]) la tiene trapezoidal y se alimenta en #strong[seis pasos]: en cada sexto de vuelta eléctrica conducen dos fases, una hacia el positivo y otra hacia el negativo, y la tercera queda al aire. La posición la dan tres sensores Hall (sección #nr("sec-35.5")) cuyo código de tres bits cambia cada 60°, o, sin sensores, el paso por cero de la fuerza electromotriz que se mide en la fase al aire, 30° antes de la siguiente conmutación. Como esa tensión es nula con el motor parado, los BLDC sin sensores arrancan en lazo abierto.

#tabla(none, columns: 4, align: (left, left, left, left,),
  [Hall H1 H2 H3], [Fase a +], [Fase a −], [Al aire],
  [1 0 1], [A], [B], [C],
  [1 0 0], [A], [C], [B],
  [1 1 0], [B], [C], [A],
  [0 1 0], [B], [A], [C],
  [0 1 1], [C], [A], [B],
  [0 0 1], [C], [B], [A],
)

La tabla es la secuencia de un sentido; el orden de los códigos y la asignación de fases depende de cómo estén montados los sensores, y la da el fabricante del motor. Un BLDC visto desde su alimentación de continua es un motor de continua con el colector hecho de transistores, y cumple las ecuaciones de la sección #nr("sec-new-maquinas.3") con E la tensión entre las dos fases que conducen. Los de modelismo se venden por su #strong[K#sub[V]], en rpm por voltio: un motor de 920 K#sub[V] tiene k = 60/(2π × 920) = 0,01038 V·s/rad (1,087 V por cada 1 000 rpm). Con una batería de 11,1 V giraría en vacío, idealmente, a 10 212 rpm, y con 10 A da 0,104 N·m. Lo que el K#sub[V] no dice es la resistencia: con 0,1 Ω, esos 10 A ya le quitan 1 V.

=== El motor paso a paso

Es un motor síncrono de muchos polos que se mueve de paso en paso: cada vez que la electrónica cambia la corriente de sus fases, el rotor avanza a la siguiente posición de equilibrio. El híbrido habitual tiene 200 pasos por vuelta (1,8°), y el #strong[micropaso] reparte la corriente entre las dos fases en escalones de una senoide para dividir cada paso en 8, 16 o más. Se gobierna en lazo abierto, sin sensor, y esa es su ventaja y su límite: si el par que pide la carga, o la aceleración, supera el que puede dar, #strong[pierde pasos sin avisar] y el controlador cree que está donde no está. Con el motor parado y alimentado mantiene la posición con su #strong[par de retención]\; su par cae deprisa con la velocidad, porque la inductancia de las fases impide que la corriente llegue a su valor en pasos cada vez más cortos, y por eso los controladores trabajan con tensiones mucho mayores que la nominal del bobinado y regulan la corriente con PWM.

== Accionamientos: el Variador y su Control <sec-new-maquinas.6>

=== El variador de frecuencia

Un #strong[variador de frecuencia] para motores de inducción tiene tres bloques que ya están en el libro: un rectificador de seis pulsos que saca de la red de 400 V un bus de unos 540 V (sección #nr("sec-new-33-rectificadores")), el condensador del bus y un inversor trifásico de IGBT con modulación senoidal o vectorial (sección #nr("sec-new-33-inversor")). Lo que este capítulo añade es qué tensión y qué frecuencia debe pedirle el control al inversor para que el motor dé par.

La tensión inducida en el estátor es 4,44·f·N·Φ (sección #nr("sec-4.6")), así que el flujo, que fija el par por amperio, es proporcional a V/f. Para cambiar la velocidad sin cambiar el flujo hay que cambiar la tensión con la frecuencia: es el #strong[control escalar V/f], con una pendiente de 400/50 = 8 V/Hz para el motor de 4 kW. A 25 Hz recibe 200 V. Con el flujo constante, la curva par-velocidad se desplaza casi sin deformarse (figura #nr("fig-new-maquinas.7")): a 25 Hz el motor necesita 55 rpm de deslizamiento para dar su par nominal, frente a 50 rpm a 50 Hz, y gira a 695 rpm.

#figura("maq-vf.svg", 70%, [(a) Ley V/f del motor de 4 kW: 8 V/Hz hasta 50 Hz, con y sin un refuerzo de 16,5 V a frecuencia cero, y 400 V por encima. (b) Sus curvas par-velocidad a 5, 25, 50 y 75 Hz con refuerzo, y a 5 Hz sin él (trazos).]) <fig-new-maquinas.7>

Casi sin deformarse, pero no del todo. A frecuencia baja, la tensión es pequeña y la caída en R#sub[1], que no depende de la frecuencia, se come una parte cada vez mayor: con V/f puro el par máximo cae al 73,6 % del de 50 Hz a 25 Hz, al 37,5 % a 10 Hz y al 19,6 % a 5 Hz, donde no llega ni a 17 N·m. El remedio es el #strong[refuerzo] (#emph[boost]): sumar a la ley una tensión fija que compense esa caída. Con 16,5 V (el 4,1 % de la nominal, el valor que mantiene el flujo nominal a 5 Hz con el par nominal), el par máximo a 5 Hz sube a 31,9 N·m. Demasiado refuerzo satura el motor en vacío; los variadores lo ajustan solos midiendo R#sub[1] en una autocalibración. Un segundo ajuste habitual es la #strong[compensación de deslizamiento]: el variador estima el par por la corriente y sube la frecuencia lo que el motor va a deslizar, para que la velocidad no baje con la carga.

Por encima de 50 Hz el variador ya no puede subir la tensión: el flujo baja como 1/f y el par máximo, aproximadamente, como 1/f². A 75 Hz el motor da 42,9 N·m de par máximo, el 49,6 % (la regla diría el 44,4 %). Es el #strong[debilitamiento de campo], la misma zona de potencia constante que en el motor de continua. Y hay un límite que no está en las curvas: un motor autoventilado gira su ventilador con el eje, y a velocidad baja se refrigera peor; para trabajar mucho tiempo despacio con par nominal hace falta ventilación forzada o un motor mayor, según la curva del fabricante.

=== Nociones de control vectorial

El control V/f fija la tensión y deja que la corriente sea la que salga: responde despacio y no controla el par en los transitorios. El #strong[control vectorial] (o por orientación de campo, FOC) controla directamente la corriente, y para eso hace con el motor de alterna lo que el colector hace en el de continua. Mide dos corrientes de fase y las transforma en dos componentes: la transformación de #strong[Clarke] pasa de las tres fases a un vector del plano (sección #nr("sec-new-33-inversor")), y la de #strong[Park] lo gira con el ángulo θ del flujo del rotor, de modo que en esos ejes giratorios las corrientes senoidales se ven como continuas. La componente i#sub[d], alineada con el flujo, lo controla; la i#sub[q], perpendicular, da el par. Cada una tiene su lazo PI, y la salida vuelve a ejes fijos y al modulador (figura #nr("fig-new-maquinas.8")).

#figura("maq-vectorial.svg", 70%, [Control vectorial: el lazo de velocidad da la consigna de i#sub[q] (par) y la de i#sub[d] fija el flujo; dos PI de corriente en ejes giratorios, la transformación inversa y la modulación vectorial. El ángulo θ lo da el encoder o un observador.]) <fig-new-maquinas.8>

En un PMSM el flujo lo ponen los imanes, i#sub[d] se deja en cero y el par es proporcional a i#sub[q]: el motor se controla exactamente como uno de continua, con la estructura de lazos en cascada de la sección #nr("sec-new-maquinas.3"). En un motor de inducción el ángulo del flujo del rotor no se mide: se calcula con un modelo del motor a partir de la velocidad y de las corrientes, y por eso el variador necesita sus parámetros (los mide él mismo en la autocalibración). Con un observador que estima también la velocidad, se tiene el control vectorial #strong[sin sensor] que llevan casi todos los variadores actuales. Los cálculos corren a la frecuencia de la PWM, decenas de microsegundos, en microcontroladores con temporizadores para control de motores (sección #nr("sec-38.5")).

=== Frenado y cuatro cuadrantes

Al bajar la frecuencia más deprisa de lo que la carga se para sola, o al bajar una carga, la velocidad del motor supera la síncrona, el deslizamiento se hace negativo y la máquina genera: es la misma situación del motor de continua con V < E. La energía vuelve por los diodos del inversor al bus, y el rectificador de diodos no puede devolverla a la red. Las opciones:

- Dejar que la carga se pare sola o alargar la rampa, si el proceso lo admite.
- Un #strong[chopper de frenado]: un IGBT que conecta una resistencia al bus cuando su tensión pasa de un umbral (en los variadores de 400 V, unos 750 a 800 V; cada fabricante da el suyo) y disipa el exceso.
- Un #strong[rectificador activo] (sección #nr("sec-new-33-rectificadores")) que devuelve la energía a la red: compensa en ascensores, grúas y bancos de ensayo.
- El #strong[frenado por inyección de continua]: el variador aplica continua al estátor, el campo deja de girar y la jaula frena disipando la energía en el rotor. Sirve para detener, no para retener.

Un accionamiento que solo puede acelerar en un sentido trabaja en un cuadrante; con chopper o rectificador activo y las dos secuencias de fase, en los cuatro de la sección #nr("sec-33.9").

== Elegir y Proteger un Motor: la Placa de Características <sec-new-maquinas.7>

=== Lo que dice la placa

La placa es el resumen de la hoja de datos, y cada cifra se refiere al punto nominal. La del motor de 4 kW de la sección #nr("sec-new-maquinas.4") diría:

#tabla(none, columns: 2, align: (left, left,),
  [Dato de la placa], [Qué significa],
  [3\~ Mot. IEC 60034], [Motor trifásico según la serie de normas IEC 60034],
  [4,0 kW], [Potencia #strong[mecánica] en el eje, no la eléctrica],
  [400 V Δ / 690 V Y], [Cada devanado es de 400 V: en la red de 400 V, en triángulo],
  [7,9 A / 4,6 A], [Corriente de línea en cada conexión],
  [cos φ 0,82], [Factor de potencia a plena carga],
  [1 449 min⁻¹, 50 Hz], [Velocidad a plena carga: 4 polos, s = 3,4 %],
  [IE3 89,0 %], [Clase y rendimiento según la IEC 60034-30-1],
  [S1], [Servicio continuo (la IEC 60034-1 define de S1 a S10)],
  [IP55], [Protección contra polvo y chorros de agua (IEC 60034-5)],
  [Isol. cl. F], [Aislamiento para 155 °C],
)

De la placa salen las demás cifras: la potencia absorbida, √3 × 400 × 7,9 × 0,82 = 4 488 W, y el rendimiento, 4 000/4 488 = 89,1 % (la placa redondea); el par nominal, 4 000/(2π × 1 449/60) = 26,4 N·m; los polos, por la velocidad síncrona más próxima. Un motor 230/400 V se conecta en estrella a la red de 400 V; uno 400/690 V, en triángulo, y es el que admite arranque estrella-triángulo. Desde julio de 2021, el Reglamento (UE) 2019/1781 exige la clase IE3 como mínimo a los motores de inducción de 0,75 a 1 000 kW que se ponen en el mercado (con algunas excepciones), y desde 2023 la IE4 a los de 75 a 200 kW.

=== Elegir el motor

Se elige por el par y la velocidad que pide la carga, no por la potencia a secas: se calcula el par en el eje del motor (con la reductora, si la hay), se comprueba que el motor lo da en régimen continuo y que el par de aceleración, más el de la carga, cabe en lo que dan el motor y el variador durante el arranque. Sobredimensionar «por si acaso» tiene un coste que no se ve en la compra: el motor de 4 kW a media carga mantiene el rendimiento (89,2 %), pero su factor de potencia cae a 0,62, porque la corriente magnetizante es la misma con cualquier carga; en vacío toma 4,05 A, la mitad de la nominal, casi toda reactiva.

=== Protegerlo

- #strong[Cortocircuito]: fusibles o un interruptor automático de curva adecuada a la punta de arranque (sección #nr("sec-10.3")), o un guardamotor, que reúne magnético y térmico.
- #strong[Sobrecarga]: un relé térmico ajustado a la corriente de placa (7,9 A en triángulo), que imita el calentamiento del bobinado. Con variador, la protección térmica la hace el variador a partir de la corriente que mide, configurada con los datos de la placa; para el motor que trabaja despacio, mejor sondas PTC en el bobinado, que miden la temperatura de verdad.
- #strong[Falta de fase]: un motor que pierde una fase sigue girando con la corriente muy aumentada en las otras dos; los guardamotores y los variadores la detectan.
- #strong[Personas]: el diferencial (sección #nr("sec-47.7")). Detrás de un variador trifásico, una fuga a tierra puede tener componente continua, que ciega a los diferenciales corrientes; se usan los de #strong[tipo B] o los que indique el fabricante del variador.

#precaucion[
  El condensador del bus de un variador sigue cargado a más de 500 V minutos después de desconectarlo de la red: hay que esperar el tiempo que indica su placa y comprobar la tensión del bus antes de tocar nada. Y un motor de imanes que gira arrastrado por la carga genera tensión en sus bornes aunque el variador esté apagado.
]

#strong[En el banco.] Los flancos de la PWM, de miles de voltios por microsegundo, viajan por el cable hasta el motor y se reflejan en él: con cables de decenas de metros la tensión en bornes puede llegar a casi el doble de la del bus y desgastar el aislamiento, y la tensión de modo común hace circular corriente por los rodamientos. El cable del motor debe ser apantallado con la pantalla conectada a 360° en los dos extremos (sección #nr("sec-32.7")), corto, y con filtro de salida si hace falta. Para medir la tensión que da un variador hace falta un multímetro con filtro paso bajo (la posición «VFD» de algunos): sin él, el multímetro lee los armónicos de la PWM.

#tarjeta[
  #formula($ F = (B^("2") dot.op A)/("2" dot.op µ_("0")) quad quad T = k dot.op I quad quad E = k dot.op ω $)

  #formula($ ε approx c dot.op ( ε_("R") dot.op cos φ + ε_("X") dot.op sin φ ) quad quad c_("η máx") = sqrt(P_("0")/P_("cc")) $)

  #formula($ ω = V/k - (R)/(k^("2")) dot.op T quad quad τ_("m") = (J dot.op R)/(k^("2")) $)

  #formula($ n_("s") = ("120" dot.op f)/(p) quad quad s = (n_("s") - n)/(n_("s")) $)

  #formula($ P_("Cu2") = s dot.op P_("ent") quad quad T = (P_("ent"))/(ω_("s")) $)

  #formula($ P = ("3" dot.op V dot.op E)/(X_("s")) dot.op sin δ quad quad (V)/(f) = "constante" $)
]

== Problemas de Diseño <sec-new-maquinas.8>

=== Problema #nr("prob-new-maquinas.A") — El accionamiento de un polipasto <prob-new-maquinas.A>

#strong[Enunciado]

Un polipasto debe subir y bajar 500 kg (carga y gancho) a 0,6 m/s con un tambor de 0,30 m de diámetro, a través de una reductora de rendimiento 0,90, con rampas de 1 s. Se usará un motor de inducción de 4 polos con variador. Las cargas bajan 10 m una vez cada dos minutos.

#strong[Se pide:] la potencia y el motor, la relación de la reductora, el par en el arranque, la velocidad real al subir y al bajar, y la resistencia de frenado, comprobados con una simulación del accionamiento.

#strong[Potencia y motor.] La carga pide m·g·v = 500 × 9,81 × 0,6 = 2 943 W, y el motor, con la reductora, 2 943/0,90 = 3 270 W: el de 4 kW, el de la sección #nr("sec-new-maquinas.4"). (El de 3 kW no basta, y se elige por la potencia continua porque subir es servicio continuo mientras dura.)

#strong[Reductora.] El tambor gira a v/r = 0,6/0,15 = 4 rad/s (38,2 rpm). A 50 Hz el motor gira a unos 1 449 rpm (151,8 rad/s): i = 151,8/4 = 37,9, y se toma i = 38.

#strong[Pares en el eje del motor.] Al subir, el motor mueve la carga a través de la reductora, que divide: m·g·r/(i·η) = 500 × 9,81 × 0,15/(38 × 0,90) = 21,5 N·m, el 81,6 % del nominal. Al bajar, la carga mueve el motor y la reductora multiplica: m·g·r·η/i = 17,4 N·m, que el motor tiene que retener como generador.

#strong[Inercia y aceleración.] La masa se ve en el eje del motor como m·r²/i² = 500 × 0,15²/38² = 0,00779 kg·m², el tambor de 0,6 kg·m² como 0,6/38² = 0,000416 kg·m², y el rotor tiene 0,013 kg·m² (dato de catálogo para este tamaño): J = 0,0212 kg·m². Para llegar a 1 500 rpm en 1 s (157 rad/s²) hacen falta J·α = 3,33 N·m más, 24,8 N·m en total, el 94,3 % del nominal: el motor acelera sin pasar de su par nominal, y el variador no necesita su sobrecarga.

#strong[El freno y el arranque.] Un polipasto lleva un freno mecánico de muelle que se abre eléctricamente, y el variador solo debe abrirlo cuando el motor ya da par para sostener la carga. Con la ley V/f de la sección #nr("sec-new-maquinas.6") (refuerzo de 16,5 V), a 2 Hz el motor parado da 25,1 N·m con 8,03 A, más que los 21,5 N·m de la carga: se abre el freno a 2 Hz y se arranca la rampa desde ahí.

#strong[Simulación.] El motor (con el modelo de la sección #nr("sec-new-maquinas.4"), cuyo par se recalcula en cada instante con la tensión y la frecuencia del variador) y la mecánica, J·dω/dt = T − T#sub[carga], se han integrado con un paso de 1 ms para una subida y una bajada (figura #nr("fig-new-maquinas.9")):

#tabla(none, columns: 3, align: (left, right, right,),
  [Magnitud], [Subida], [Bajada],
  [Velocidad a 50 Hz], [1 460 rpm], [1 529 rpm],
  [Velocidad del gancho], [0,603 m/s], [0,632 m/s],
  [Par del motor a 50 Hz], [21,5 N·m], [17,4 N·m],
  [Corriente a 50 Hz], [6,76 A], [5,80 A],
  [Par máximo en la rampa], [25,9 N·m], [—],
  [Potencia eléctrica a 50 Hz], [absorbe 3,63 kW], [devuelve 2,53 kW],
)

Con la misma frecuencia, la carga baja un 4,75 % más deprisa de lo que sube: al subir el motor desliza por debajo de 1 500 rpm y al bajar por encima, como generador. Si importa, la compensación de deslizamiento del variador lo corrige.

#strong[Resistencia de frenado.] Al bajar a velocidad constante el motor devuelve 2,53 kW, que llegan al bus como 2,46 kW (inversor del 97 %), y en la rampa de parada, cuando además se frena la inercia, la potencia llega a 2,87 kW. Con el chopper actuando a 780 V, la resistencia no puede pasar de 780²/2 870 = 212 Ω; se toma 180 Ω, que absorbe hasta 3,38 kW con 4,33 A, y debe quedar por encima de la resistencia mínima que admite el chopper del variador (dato de su manual). La potencia media es otra cosa: bajar 10 m dura 16,7 s y deja 41,0 kJ en la resistencia; una vez cada 120 s son 341 W de media. Se elige una resistencia de unos 400 W continuos que admita los 3,4 kW durante 17 s, con su protección térmica.

#strong[En el banco]

Antes de colgar carga: autocalibración del variador con los datos de placa, sentido de giro con el gancho libre (subir debe ser subir) y prueba del freno. Con carga, la corriente a 50 Hz debe salir cerca de los 6,76 A subiendo, y la tensión del bus no debe pasar del umbral del chopper en la bajada; si el variador da error de sobretensión del bus, la resistencia no está actuando o la rampa de parada es demasiado corta.

#precaucion[
  El variador no sustituye al freno mecánico ni es una función de seguridad: si falla, la carga cae. La retención de cargas suspendidas, los finales de carrera y la parada de emergencia de un aparato de elevación tienen normas propias, y su diseño no es el de este problema.
]

#strong[Resultado:] motor de 4 kW y 4 polos con variador de su potencia, reductora i = 38, apertura del freno a 2 Hz, 0,603 m/s subiendo y 0,632 m/s bajando a 50 Hz, y resistencia de frenado de 180 Ω y unos 400 W.

#figura("maq-problema.svg", 70%, [El polipasto simulado. Velocidad del motor (con la síncrona en trazos), par y potencia eléctrica en la red durante una subida (a) y una bajada (b) a 50 Hz con rampas de 1 s. Al bajar, la potencia es negativa: el motor genera.]) <fig-new-maquinas.9>

#ejercicios[
  #ejercicio[
    Un núcleo de chapa de 20 cm de longitud media, 4 cm² de sección y µ#sub[r] = 3 000 tiene un entrehierro de 0,4 mm y una bobina de 500 espiras. ¿Qué corriente hace falta para tener 1,2 T en el entrehierro? ¿Qué parte de los amperios-vuelta se gasta en el aire, qué inductancia tiene la bobina y con qué fuerza se atraen las caras del entrehierro? ¿Qué corriente bastaría sin entrehierro?
  ] <ej-new-maquinas.1>

  #ejercicio[
    Un transformador de 250 kVA, 20 000/400 V, Dyn11, tiene P#sub[0] = 425 W, P#sub[cc] = 3 250 W y ε#sub[cc] = 4 %. Calcula sus corrientes nominales, R#sub[cc] y X#sub[cc] por fase referidas a baja, la tensión del secundario a plena carga con cos φ = 0,8, el rendimiento en ese punto, la carga de rendimiento máximo y la corriente de cortocircuito en bornes de baja. ¿Qué desfase hay entre las tensiones de alta y de baja?
  ] <ej-new-maquinas.2>

  #ejercicio[
    Un motor de continua de imanes tiene en su placa 180 V, 10 A y 1 500 rpm, y su inducido mide 1,2 Ω. Calcula k, el par nominal, la velocidad en vacío y la corriente y el par de arranque en directo. ¿Qué tensión necesita para girar a 1 000 rpm con el par nominal, y con qué ángulo de disparo la daría un puente monofásico de tiristores conectado a 230 V con la corriente alisada (sección #nr("sec-new-33-rectificadores"))?
  ] <ej-new-maquinas.3>

  #ejercicio[
    El motor de 24 V de la sección #nr("sec-new-maquinas.3") gira en vacío a 480 rad/s cuando el puente baja bruscamente su tensión a 12 V. Calcula la corriente y el par en ese instante, y, hasta que llega a 240 rad/s, la energía que suelta el rotor, la que llega a la fuente y la que se pierde en R. Si la fuente no puede absorber energía y el bus tiene 1 000 µF a 24 V, ¿hasta qué tensión sube? ¿Qué capacidad haría falta para que no pasase de 30 V?
  ] <ej-new-maquinas.4>

  #ejercicio[
    Un motor de 4 polos a 50 Hz gira a 1 455 rpm y por su entrehierro cruzan 8 kW. Calcula el deslizamiento, la frecuencia de las corrientes del rotor, las pérdidas del cobre del rotor, la potencia mecánica interna y el par electromagnético. ¿A qué velocidad síncrona giraría uno de 6 polos a 60 Hz?
  ] <ej-new-maquinas.5>

  #ejercicio[
    Una cinta pide un par constante del 60 % del nominal desde parada. Con el motor de 4 kW de la sección #nr("sec-new-maquinas.4"), ¿arranca en directo? ¿Y en estrella-triángulo? ¿Y con un arrancador suave que limite la corriente a tres veces la nominal? ¿Qué solución propones?
  ] <ej-new-maquinas.6>

  #ejercicio[
    El motor de 4 kW se alimenta con un variador V/f de 8 V/Hz. ¿Qué tensión recibe a 30 Hz y a qué velocidad gira con el par nominal, suponiendo los mismos 50 rpm de deslizamiento que a 50 Hz? A 70 Hz, con 400 V, ¿qué par máximo cabe esperar según la regla de 1/f²? ¿Puede dar ahí su par nominal de forma continua?
  ] <ej-new-maquinas.7>

  #ejercicio[
    Un BLDC de 1 000 K#sub[V] con 0,08 Ω entre fases se alimenta de una batería de 14,8 V. Su hélice pide 0,12 N·m a 12 000 rpm. Calcula k, la velocidad en vacío ideal, la corriente, la tensión media que debe aplicar el controlador y su ciclo de trabajo, la potencia mecánica y el rendimiento si solo se cuentan las pérdidas del cobre.
  ] <ej-new-maquinas.8>

  #ejercicio[
    Una cinta horizontal mueve 2 000 kg (material y banda) a 1,2 m/s con un coeficiente de resistencia a la rodadura de 0,03, un tambor de 0,4 m y una reductora de rendimiento 0,92, con un motor de 4 polos que gira a 1 430 rpm. Calcula la fuerza y la potencia en régimen, la relación de la reductora y el par en el motor. ¿Basta un motor de 1,1 kW si la cinta debe acelerar en 3 s y el variador admite el 150 % del par nominal? ¿Y en 5 s?
  ] <ej-new-maquinas.9>
]

#soluciones[
  #solucion("ej-new-maquinas.1")[
    ℛ#sub[Fe] = 0,20/(4π·10#super[−7] × 3 000 × 4·10#super[−4]) = 132,6·10³ A/Wb; ℛ#sub[g] = 0,4·10#super[−3]/(4π·10#super[−7] × 4·10#super[−4]) = 795,8·10³ A/Wb. Φ = 1,2 × 4·10#super[−4] = 0,48 mWb y N·I = 0,48·10#super[−3] × 928,4·10³ = 445,6 A·v: I = 0,891 A, el 85,7 % en el aire. L = 500²/928,4·10³ = 269 mH. F = 1,2² × 4·10#super[−4]/(2µ#sub[0]) = 229 N. Sin entrehierro bastarían 0,127 A, siete veces menos.
  ]

  #solucion("ej-new-maquinas.2")[
    I#sub[1n] = 250 000/(√3 × 20 000) = 7,22 A; I#sub[2n] = 360,8 A. Z#sub[base] = 400²/250 000 = 640 mΩ y Z#sub[cc] = 25,6 mΩ; R#sub[cc] = 3 250/(3 × 360,8²) = 8,32 mΩ (1,30 %) y X#sub[cc] = 24,2 mΩ (3,78 %). Caída: 1,30 × 0,8 + 3,78 × 0,6 = 3,31 %, 386,8 V. Rendimiento: 200 kW/(200 kW + 425 W + 3 250 W) = 98,20 %. Máximo con c = √(425/3 250) = 36,2 %, con el 98,84 %. I#sub[cc] = 360,8/0,04 = 9,02 kA. Dyn11: la baja adelanta 30° a la alta.
  ]

  #solucion("ej-new-maquinas.3")[
    ω = 157,1 rad/s; k = (180 − 1,2 × 10)/157,1 = 1,070 V·s/rad. T#sub[n] = 10,70 N·m. En vacío, ω = 180/1,070 = 168,3 rad/s, 1 607 rpm. En directo, 180/1,2 = 150 A y 160 N·m: quince veces la nominal. A 1 000 rpm con 10 A, V = 1,070 × 104,7 + 12 = 124,0 V. Con V#sub[d] = 0,900 × 230 × cos α, cos α = 124,0/207 = 0,599 y α = 53,2°.
  ]

  #solucion("ej-new-maquinas.4")[
    I = (12 − 24)/0,5 = −24 A y T = −1,2 N·m (frena). El rotor suelta ½ × 10#super[−4] × (480² − 240²) = 8,64 J. La carga que vuelve a la fuente es J·Δω/k = 0,48 C, y a 12 V son 5,76 J; en R quedan 2,88 J. En el bus: √(24² + 2 × 5,76/10#super[−3]) = 110 V. Para no pasar de 30 V, C = 2 × 5,76/(30² − 24²) = 35,6 mF: más práctico es una resistencia de frenado.
  ]

  #solucion("ej-new-maquinas.5")[
    s = (1 500 − 1 455)/1 500 = 3 %; f#sub[r] = 0,03 × 50 = 1,5 Hz. P#sub[Cu2] = 0,03 × 8 000 = 240 W; P#sub[mec] = 7 760 W; T = 8 000/157,1 = 50,9 N·m. Con 6 polos a 60 Hz, 120 × 60/6 = 1 200 rpm.
  ]

  #solucion("ej-new-maquinas.6")[
    En directo da 1,84 veces el nominal: arranca, con 49,8 A. En estrella, 1,84/3 = 0,614: solo un 2,3 % por encima del 60 %; acelera con un par sobrante mínimo, tardísimo y calentándose, si llega a hacerlo: no es aceptable. Limitar a 3 × 7,89 = 23,7 A es bajar la tensión al 47,5 %, y el par al 0,475² × 1,84 = 0,415 del nominal: no arranca. La solución es un variador (o el arranque directo, si la red lo admite).
  ]

  #solucion("ej-new-maquinas.7")[
    A 30 Hz, 240 V y n#sub[s] = 900 rpm: con 50 rpm de deslizamiento, unos 850 rpm (el modelo da 846,5 rpm). A 70 Hz, el par máximo baja a (50/70)² = 0,51 veces el de 50 Hz: 0,51 × 3,28 = 1,68 veces el nominal (el modelo da 1,84). Pero dar el par nominal a 2 100 rpm serían 5,8 kW, y el modelo pide para ello 10,2 A, el 130 % de la corriente nominal: en continuo solo puede dar su potencia, 18,8 N·m, con 7,36 A.
  ]

  #solucion("ej-new-maquinas.8")[
    k = 60/(2π × 1 000) = 9,55 mV·s/rad. En vacío, 14 800 rpm. I = 0,12/0,00955 = 12,6 A; E = 0,00955 × 1 256,6 = 12,0 V; V = 12,0 + 0,08 × 12,6 = 13,0 V, un ciclo del 87,9 %. P#sub[mec] = 0,12 × 1 256,6 = 150,8 W; P#sub[el] = 13,0 × 12,6 = 163,4 W; rendimiento 92,3 %.
  ]

  #solucion("ej-new-maquinas.9")[
    F = 0,03 × 2 000 × 9,81 = 588,6 N; P = 706 W en el tambor y 768 W en el motor. El tambor gira a 6 rad/s (57,3 rpm): i = 149,7/6 = 25,0. Par en régimen: 588,6 × 0,2/(25 × 0,92) = 5,12 N·m, que el de 1,1 kW (7,35 N·m) da de sobra. Acelerar en 3 s pide 800 N más: (588,6 + 800) × 0,2/23 = 12,07 N·m, 1,64 veces el nominal del de 1,1 kW: no basta; el de 1,5 kW (9,95 N·m) quedaría en 1,21. En 5 s, 480 N: 9,29 N·m, 1,26 veces: basta. La inercia del rotor añade unos 0,17 N·m. Es la rampa, no la potencia en régimen, la que decide el motor.
  ]
]
