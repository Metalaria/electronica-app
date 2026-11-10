// P01 — «Sistemas trifásicos»: new section 23.10 of chapter 23 (cap24.typ), for «Electrónica Práctica Avanzada».
// Four parts, each to be pasted in its own place (see NOTAS.md):
//   PARTE 1  the section: after the end of 23.9 «Inductancia Mutua y el Transformador en Alterna» (after its figure
//            <fig-24.15>) and before «== Resumen del Capítulo <sec-24.10>», which becomes 23.11.
//   PARTE 2  eight exercises: inside the chapter's #ejercicios[…], after the exercise labelled <ej-24.8>.
//   PARTE 3  their solutions: inside #soluciones[…], after #solucion("ej-24.8")[…].
//   PARTE 4  (optional) additions to the summary, which becomes 23.11.
// Numbers: section 23.10; figures 23.17–23.22 (none of the existing ones moves); exercises 23.9–23.16.
// Every number comes from scripts/calculos.py and the circuits from the ngspice runs (scripts/spice_comprobar.py).

// ============================================================================================ PARTE 1
== Sistemas Trifásicos <sec-new-24-trifasica>

La sección #nr("sec-24.5") dejó una consecuencia incómoda: en monofásica la potencia instantánea pulsa al doble de la frecuencia de red, y un enchufe entrega la energía a golpes, cien veces por segundo. La red pública no funciona así. Sale de los alternadores como tres tensiones senoidales iguales, desfasadas un tercio de periodo, y los 230 V de un enchufe doméstico son solo una de ellas, tomada entre una fase y el neutro. Esta sección explica por qué la red es trifásica, cómo se conectan las cargas a ella, cómo se calcula y se mide su potencia y qué llega exactamente a un taller. No hace falta ninguna herramienta nueva: todo es régimen senoidal permanente con fasores (sección #nr("sec-24.4")), aplicado tres veces con un desfase de 120°.

=== Por qué tres fases

Un sistema trifásico equilibrado está formado por tres tensiones de la misma amplitud y la misma frecuencia, desfasadas 120° entre sí:

#ec[$ v_1 &= sqrt(2) dot.op V_"f" dot.op cos(ω t) \
  v_2 &= sqrt(2) dot.op V_"f" dot.op cos(ω t - 120°) \
  v_3 &= sqrt(2) dot.op V_"f" dot.op cos(ω t + 120°) $]

donde V#sub[f] es el valor eficaz de cada una. La razón de complicar así la red se resume en dos ventajas, y las dos salen de una misma propiedad: tres senoides iguales desfasadas 120° suman cero en todo instante.

#strong[La potencia total es constante.] Si cada fase alimenta la misma carga, con corriente eficaz I y ángulo φ, cada una aporta la potencia pulsante de la sección #nr("sec-24.5"): un término constante V#sub[f]·I·cos φ y otro que oscila a 2ω. Los tres términos oscilantes quedan desfasados 2 × 120° = 240° entre sí, que vuelve a ser un tercio de vuelta, y se anulan al sumarlos. Con 230 V, 10 A y φ = 30° por fase, cada fase oscila entre −308 W y 4 292 W alrededor de su media de 1 992 W, y la suma de las tres es una recta en 5 976 W (figura #nr("fig-new-24-potencia")); en la simulación con ngspice, su variación de pico a pico es 4 × 10⁻⁹ veces su valor, es decir, nula salvo redondeo. Un motor trifásico recibe así la energía a ritmo constante y da un par sin la pulsación a 100 Hz de un motor monofásico, y el alternador de la central ve un par resistente constante.

#strong[Ahorra conductor.] Para transportar la misma potencia, con las mismas pérdidas y la misma tensión entre conductores, una línea trifásica de tres hilos necesita el 75 % del cobre de una monofásica de dos. Si lo que se fija es la tensión en las cargas, los 230 V de siempre, la ventaja es mayor: cuatro hilos (tres fases y neutro) con un tercio del cobre. La razón de fondo es que las corrientes de retorno de las tres fases se cancelan, y el conductor de vuelta, que en monofásica lleva toda la corriente, en trifásica equilibrada no lleva nada.

#deduccion[Potencia constante y ahorro de conductor][
  #eclabel[#strong[Ec. 1 — Tres senoides a 120° suman cero]]
  #ec[$ cos α + cos(α - 120°) + cos(α + 120°) = 0 $]

  #strong[Origen.] Con la identidad del producto de cosenos de la sección #nr("sec-0.3"), cos(α − 120°) + cos(α + 120°) = 2·cos α·cos 120° = −cos α, que cancela el primer término. Con fasores es aún más directo: los tres fasores unitarios 1∠0°, 1∠−120° y 1∠+120° son los lados de un triángulo equilátero recorrido en orden, y un polígono cerrado suma cero.

  #eclabel[#strong[Ec. 2 — Potencia instantánea trifásica]]
  #ec[$ p(t) = p_1 + p_2 + p_3 = 3 dot.op V_"f" dot.op I dot.op cos φ $]

  #strong[Origen.] Por la sección #nr("sec-24.5"), la fase k aporta V#sub[f]·I·cos φ + V#sub[f]·I·cos(2ωt − φ − 2·(k − 1)·120°). Los ángulos de los términos oscilantes son 0°, −240° y −480°, que equivalen a 0°, +120° y −120°: otra terna a 120°, que por la Ec. 1 suma cero. Solo quedan los tres términos constantes.

  #strong[Dominio de validez.] Exige carga equilibrada y tensiones senoidales. Con carga desequilibrada los términos oscilantes ya no tienen la misma amplitud y reaparece una pulsación a 100 Hz, proporcional al desequilibrio.

  #eclabel[#strong[Ec. 3 — El cobre de una línea trifásica]]
  #ec[$ ("cobre trifásico")/("cobre monofásico") = (3 dot.op A \/ 2)/(2 dot.op A) = "0,75" $]

  #strong[Origen.] Misma potencia P, mismo cos φ, mismas pérdidas y misma tensión V entre conductores. En monofásica, I = P/(V·cos φ) recorre dos hilos de resistencia R₁: pérdidas 2·I²·R₁ = 2·P²·R₁/(V·cos φ)². En trifásica, I = P/(√3·V·cos φ) recorre tres hilos de resistencia R₃: pérdidas 3·I²·R₃ = P²·R₃/(V·cos φ)². Igualando, R₃ = 2·R₁: cada hilo trifásico tiene la mitad de sección, y tres medias secciones son el 75 % de dos enteras.

  #strong[Con 230 V en las cargas] (estrella con neutro, V#sub[f] = V): I = P/(3·V·cos φ) por fase, pérdidas P²·R₃/(3·V²·cos² φ), e igualando con las de la monofásica, R₃ = 6·R₁. Cuatro hilos de un sexto de sección frente a dos enteros: 4/6 entre 2, un tercio del cobre (un cuarto si no se contara el neutro).
]

=== Secuencia de fases, tensiones de fase y de línea

Las tres tensiones se representan con tres fasores del mismo módulo separados 120°: V₁ = V#sub[f]∠0°, V₂ = V#sub[f]∠−120° y V₃ = V#sub[f]∠+120°. El orden en que pasan por su máximo, 1-2-3, es la #strong[secuencia de fases] (directa; la inversa sería 1-3-2). Los conductores se llaman L1, L2 y L3 (R, S y T en textos antiguos), y el punto común de los tres devanados del transformador que los alimenta es el #strong[neutro], N. El Reglamento electrotécnico para baja tensión (ITC-BT-19) fija sus colores: marrón, negro y gris para las fases, azul claro para el neutro y verde-amarillo para el conductor de protección.

Entre una fase y el neutro se mide la #strong[tensión de fase], V#sub[f]\; entre dos fases, la #strong[tensión de línea], V#sub[LL]. En electrotecnia y en las normas IEC se escriben U#sub[f] y U#sub[L]\; aquí se mantiene la V del resto del libro, con LL (entre dos líneas) porque en este capítulo V#sub[L] es la tensión de la bobina. La segunda es la diferencia de dos fasores de la primera, y con ella aparece el factor que acompaña a toda la trifásica:

#ec[$ V_12 = V_1 - V_2 = sqrt(3) dot.op V_"f" ∠ 30° quad quad V_"LL" = sqrt(3) dot.op V_"f" $]

El √3 es pura geometría: V₁ y V₂ forman un triángulo isósceles con 120° en el vértice, y su base mide 2·V#sub[f]·cos 30° = √3·V#sub[f]. Las tres tensiones de línea, V₁₂, V₂₃ y V₃₁, forman otra terna equilibrada, adelantada 30° respecto a la de fase (figura #nr("fig-new-24-tensiones")).

La red europea es de #strong[400/230 V] (IEC 60038): 230 V de fase y 400 V de línea. Las dos cifras no encajan del todo, porque 230·√3 = 398 V y 400/√3 = 230,9 V; la norma redondea, y en esta sección se toma V#sub[LL] = 400 V y V#sub[f] = 230,9 V. La tensión de suministro puede alejarse un 10 % de la nominal, y conviene tener presentes los picos, que reaparecerán en el banco: 326,6 V entre fase y neutro y 565,7 V entre fases, que con un 10 % de más llegan a 359 V y 622 V.

#figura("trifasica-tensiones.svg", 100%, [Las tres tensiones de fase de la red de 400/230 V y la de línea u#sub[12] = v#sub[1] − v#sub[2], con sus picos; a la derecha, los fasores: las tensiones de línea unen los extremos de las de fase, miden √3 veces más y van adelantadas 30°.]) <fig-new-24-tensiones>

#figura("trifasica-potencia.svg", 69%, [Potencia instantánea de cada fase y de las tres juntas con una carga equilibrada de 230 V, 10 A y φ = 30° por fase, simulada con ngspice: cada fase pulsa a 100 Hz y la suma es constante.]) <fig-new-24-potencia>

La secuencia no es un detalle de nomenclatura. Tres bobinas separadas 120° en el espacio y recorridas por corrientes desfasadas 120° en el tiempo producen un campo magnético de amplitud constante, 1,5 veces el pico del de una sola bobina, que en una máquina de dos polos gira a la frecuencia de red: es el campo giratorio que arrastra al motor de inducción y que fija su velocidad síncrona (sección #nr("sec-33.13")). Si se intercambian dos fases cualesquiera, la secuencia pasa a ser inversa y el campo, y con él el motor, gira al revés. Por eso, antes de conectar una bomba o un compresor, se comprueba la secuencia con un secuencímetro, y por eso un motor que arranca al revés se corrige intercambiando dos fases, nunca las tres.

=== Estrella y triángulo

Tres cargas pueden conectarse a la red de dos maneras (figura #nr("fig-new-24-conexiones")):

- #strong[En estrella (Y)]: cada impedancia va de una fase a un punto común, el punto de estrella, que puede unirse al neutro. Cada una soporta la tensión de fase, y la corriente de línea es la suya: V#sub[LL] = √3·V#sub[f] e I#sub[L] = I#sub[f].
- #strong[En triángulo (Δ)]: cada impedancia va entre dos fases. Soporta la tensión de línea, y por cada fase sale la diferencia de las corrientes de dos ramas, I₁ = I₁₂ − I₃₁, que en carga equilibrada es √3 veces la de rama: V#sub[f] = V#sub[LL] e I#sub[L] = √3·I#sub[f]. En triángulo no hay punto de estrella, y por tanto no hay neutro que conectar.

Las dos conexiones se pasan de una a otra con la transformación estrella-triángulo de la sección #nr("sec-1.9"), que vale igual con impedancias complejas. Con tres impedancias iguales queda una regla muy simple: un triángulo de Z equivale a una estrella de Z/3. Dicho al revés, #strong[las mismas tres impedancias consumen el triple en triángulo que en estrella].

#ejemplo[
  Tres resistencias de 53,3 Ω sobre la red de 400/230 V. \
  En estrella, cada una recibe 230,9 V: I = 230,9/53,3 = 4,33 A, 1 000 W por resistencia y 3 000 W en total. La corriente de línea es la misma, 4,33 A. \
  En triángulo, cada una recibe 400 V: I#sub[f] = 400/53,3 = 7,50 A, 3 000 W por resistencia y 9 000 W en total. La corriente de línea es √3 × 7,50 = 12,99 A. \
  La potencia y la corriente de línea se multiplican exactamente por tres. La simulación con ngspice de los dos montajes da 4,330 A y 12,99 A.
]

Esa regla del factor tres tiene dos aplicaciones cotidianas. La primera es la placa de los motores: un motor marcado 230/400 V Δ/Y tiene devanados para 230 V, y en la red de 400/230 V se conecta en estrella, que es lo que pone a cada devanado sus 230 V; conectarlo en triángulo le daría 400 V por devanado. La segunda es el #strong[arranque estrella-triángulo]: un motor con devanados para 400 V (placa 400/690 V) se arranca en estrella, con 230 V por devanado y un tercio de la corriente y del par de arranque, y se pasa a triángulo cuando ha cogido velocidad.

#figura("trifasica-conexiones.svg", 100%, [Las dos conexiones de una carga trifásica. En estrella cada impedancia soporta la tensión de fase y el punto de estrella puede unirse al neutro; en triángulo cada impedancia soporta la tensión de línea y la corriente de línea es la diferencia de las de dos ramas.]) <fig-new-24-conexiones>

Y un método que ahorra mucho trabajo: un circuito trifásico #strong[equilibrado] se resuelve con una sola fase. Se pasan a estrella todas las cargas en triángulo (Z/3), se toma la fase 1 con su tensión V₁ y su impedancia en estrella, y se calcula como un circuito monofásico de los de la sección #nr("sec-24.4")\; las corrientes de las fases 2 y 3 son la misma, retrasada 120° y 240°. Es el #strong[equivalente monofásico], y es como se calculan en la práctica las líneas, los motores y los transformadores.

=== El neutro y las cargas desequilibradas

En una estrella equilibrada, la corriente que vuelve por el neutro es la suma de tres corrientes iguales a 120°, y por la Ec. 1 vale cero. El neutro sobra, y de hecho las líneas de transporte de alta tensión tienen solo tres conductores. En la distribución de baja tensión, en cambio, el neutro es imprescindible, porque las cargas monofásicas se conectan entre una fase y el neutro, y nunca quedan exactamente repartidas. Mientras el neutro está conectado fija el punto de estrella, y cada carga recibe sus 230 V hagan lo que hagan las demás. Lo que lleva el neutro es la suma fasorial de las corrientes de fase:

#ec[$ I_"N" = I_1 + I_2 + I_3 $]

Con una estufa de 2 kW en L1, un radiador de 1 kW en L2 y nada en L3, las corrientes son 8,66 A y 4,33 A, y el neutro no lleva su suma aritmética, 12,99 A, sino |8,66 + 4,33∠−120°| = 7,50 A. Con una sola fase cargada, el neutro lleva lo mismo que esa fase; con las tres iguales, nada. Con cargas resistivas, el neutro nunca lleva más que la mayor de las fases, y por eso en una vivienda o en un pequeño local se le da la misma sección que a las fases.

#precaucion[
  #strong[El neutro cortado.] Si el neutro se interrumpe aguas arriba de las cargas (un borne flojo en el cuadro o en la acometida es la causa típica), el punto de estrella queda flotando y las tensiones se reparten según las cargas. Con la estufa de 2 kW, el radiador de 1 kW y unas lámparas de 200 W, una por fase (26,45 Ω, 52,9 Ω y 264,5 Ω), el teorema de Millman (sección #nr("sec-23.12")) sitúa el punto de estrella a 112,7 V del neutro, y las cargas reciben #strong[139 V, 263 V y 331 V] (figura #nr("fig-new-24-neutro")); ngspice da las mismas cifras. La fase menos cargada recibe la tensión más alta, que se acerca a los 400 V cuanto más desequilibrio hay: las lámparas disipan 414 W, el doble de lo previsto, y cualquier equipo de esa fase con un varistor de entrada de 275 V eficaces (sección #nr("sec-10.4")) lo verá conducir y destruirse. Por eso el neutro no lleva nunca fusible, y los interruptores que lo cortan lo hacen a la vez que las fases.
]

#figura("trifasica-neutro.svg", 100%, [Neutro cortado con tres cargas desiguales: el punto de estrella se desplaza de N a N′, a 112,7 V del neutro, y cada carga recibe la tensión que va de N′ a su fase. La carga más pequeña, en L3, recibe 331 V, un 43 % más que la nominal.]) <fig-new-24-neutro>

Con cargas no lineales la regla de que el neutro lleva poco deja de valer, y es aquí donde la electrónica entra en la trifásica. Un rectificador con condensador toma la corriente en pulsos estrechos (sección #nr("sec-24.5")), ricos en tercer armónico. El tercer armónico de cada fase está desfasado 3 × 120° = 360° respecto al de la siguiente, es decir, en fase con él, y en el neutro los tres se suman en lugar de cancelarse; lo mismo ocurre con el 9.º, el 15.º y el resto de los múltiplos de tres. Con tres rectificadores iguales de unos 310 W, uno por fase, la simulación da 2,45 A eficaces en cada fase y #strong[4,25 A por el neutro], 1,73 veces más (figura #nr("fig-new-24-armonicos")). Esos 4,25 A son casi todo 150 Hz: la componente de 50 Hz del neutro se anula, como en la carga lineal, y la de 150 Hz es exactamente el triple de la de cada fase. El 1,73 tampoco es casual: los pulsos de las tres fases no se solapan, el neutro los lleva todos uno tras otro, su valor cuadrático medio se triplica y su valor eficaz se multiplica por √3.

#figura("trifasica-armonicos.svg", 100%, [Tres rectificadores con condensador de unos 310 W, uno en cada fase, simulados con ngspice. Cada fase toma un pulso por semiciclo; el neutro los recoge todos, un pulso cada 3,33 ms, y lleva 1,73 veces la corriente eficaz de una fase.]) <fig-new-24-armonicos>

#importante[
  En un edificio de oficinas, con cientos de fuentes conmutadas monofásicas repartidas entre las fases, #strong[el neutro puede ser el conductor más cargado de la instalación], y un neutro de la misma sección que las fases se calienta sin que ninguna protección de fase lo vea. Es la otra cara de las normas de armónicos y de la corrección activa del factor de potencia (sección #nr("sec-33.8")). En triángulo, los terceros armónicos circulan por dentro del propio triángulo y no salen a la línea, y esa es una de las razones de que el primario de los transformadores de distribución vaya en triángulo.
]

=== Potencia en trifásica y su corrección

La potencia de un sistema trifásico es la suma de la de sus tres fases, con las definiciones de la sección #nr("sec-24.5"). En carga equilibrada las tres son iguales, y conviene escribirlas con las magnitudes de línea, que son las que se miden:

#ec[$ P = 3 dot.op V_"f" dot.op I_"f" dot.op cos φ = sqrt(3) dot.op V_"LL" dot.op I_"L" dot.op cos φ $]

#ec[$ Q = sqrt(3) dot.op V_"LL" dot.op I_"L" dot.op op("sen") φ quad quad S = sqrt(3) dot.op V_"LL" dot.op I_"L" $]

Las fórmulas valen igual en estrella y en triángulo (en triángulo, 3·V#sub[LL]·I#sub[L]/√3 = √3·V#sub[LL]·I#sub[L]), y el ángulo φ es #strong[el de la impedancia de cada fase]: el que forman la tensión y la corriente de una misma carga, no el que forman V#sub[LL] e I#sub[L].

Un motor de 11 kW en el eje, con un rendimiento de 0,90 y cos φ = 0,85, toma de la red P = 11 000/0,90 = 12,22 kW, y su corriente de línea a 400 V es:

#ec[$ I_"L" = P/(sqrt(3) dot.op V_"LL" dot.op cos φ) = "12 222"/(sqrt(3) dot.op 400 dot.op "0,85") = "20,75 A" $]

con S = 14,38 kVA y Q = 7,57 kVAr (φ = 31,8°). La trampa del ángulo se ve con estos números: entre V₁₂ e I₁ hay 61,8°, que son φ + 30°, y quien use ese ángulo en la fórmula obtendrá 6 797 W, un 44 % menos de lo que el motor consume de verdad.

Con carga desequilibrada se suman las potencias de cada fase, P = P₁ + P₂ + P₃ y Q = Q₁ + Q₂ + Q₃. La potencia aparente tiene en ese caso más de una definición, y los analizadores de redes indican cuál usan; la más corriente es S = √(P² + Q²).

La #strong[corrección del factor de potencia] sigue la deducción de la sección #nr("sec-24.8"): la batería de condensadores debe aportar Q#sub[C] = P·(tan φ₁ − tan φ₂), repartida entre tres condensadores. La única novedad es la tensión que soporta cada uno, que depende de cómo se conecten:

#ec[$ C_Δ = Q_"C"/(3 dot.op ω dot.op V_"LL"^2) quad quad C_"Y" = Q_"C"/(3 dot.op ω dot.op V_"f"^2) = 3 dot.op C_Δ $]

Para llevar el motor del ejemplo a cos φ = 0,95 hacen falta Q#sub[C] = 12 222 × (0,620 − 0,329) = 3 557 VAr: tres condensadores de #strong[23,6 µF] para 400 V en triángulo, o de 70,8 µF para 230 V en estrella. En triángulo la capacidad es tres veces menor, y por eso las baterías de baja tensión suelen conectarse así. Con la batería, la corriente de línea baja de 20,75 A a 18,57 A, un 10,5 % menos para la misma potencia útil; la simulación del motor como estrella R-L equivalente, con la batería en triángulo, da 18,57 A y cos φ = 0,950. Las razones para no pasar de 0,95 son las mismas de la sección #nr("sec-24.8").

=== Medir la potencia: uno, tres o dos vatímetros

Un vatímetro tiene una bobina de corriente, que se intercala en el conductor, y una de tensión, que se conecta entre dos puntos, y mide el valor medio del producto de las dos magnitudes, es decir, V·I·cos del ángulo entre ellas. Los analizadores digitales hacen lo mismo muestreando las dos señales y promediando el producto. Cuántos hacen falta en trifásica depende de que haya neutro y de que la carga esté equilibrada:

- #strong[Con neutro y carga equilibrada], uno solo, con la corriente de L1 y la tensión entre L1 y N: la potencia total es tres veces su lectura.
- #strong[Con neutro y carga cualquiera], tres, uno por fase y todos con la tensión referida al neutro; la potencia total es la suma de las tres lecturas. Es lo que hace un contador trifásico de cuatro hilos.
- #strong[Sin neutro], basta con dos, cualquiera que sea la carga: es el #strong[método de los dos vatímetros], o de Aron. En general, un sistema de n hilos necesita n − 1 vatímetros (teorema de Blondel), y en el de cuatro hilos esos tres son los del caso anterior.

En la conexión de Aron (figura #nr("fig-new-24-aron")), las bobinas de corriente van en L1 y L2, y las de tensión, entre cada una de esas fases y L3. La demostración es corta y no necesita ninguna hipótesis sobre la carga. La potencia instantánea que entra en una carga sin neutro es p = v₁·i₁ + v₂·i₂ + v₃·i₃, con las tensiones medidas desde cualquier punto común; como no hay neutro, i₃ = −i₁ − i₂, y sustituyendo:

#ec[$ p = (v_1 - v_3) dot.op i_1 + (v_2 - v_3) dot.op i_2 = v_13 dot.op i_1 + v_23 dot.op i_2 $]

Cada producto es lo que promedia uno de los vatímetros, así que P = W₁ + W₂. La igualdad vale instante a instante: con carga desequilibrada, con formas de onda no senoidales y sin que haga falta saber dónde está el punto de estrella de la carga.

#comprobacion[
  Una carga en estrella sin neutro y muy desequilibrada: 20 Ω en L1, 10 Ω con 50 mH en L2 y 30 Ω con 100 µF en L3, sobre la red de 400 V. Su punto de estrella queda a 60,9 V del neutro. Simulada en transitorio con ngspice y promediando los dos últimos ciclos, W₁ = 4 928 W y W₂ = 1 174 W, que suman 6 102 W, la potencia que disipan las tres resistencias. Instante a instante, v₁₃·i₁ + v₂₃·i₂ coincide con la potencia de las tres cargas con una diferencia máxima de 2 × 10⁻⁹ W.
]

En carga equilibrada, con secuencia directa y las bobinas de tensión a L3, las dos lecturas tienen una forma sencilla, y de ellas sale también la potencia reactiva:

#ec[$ W_1 = V_"LL" dot.op I_"L" dot.op cos(φ - 30°) quad quad W_2 = V_"LL" dot.op I_"L" dot.op cos(φ + 30°) $]

#ec[$ P = W_1 + W_2 quad quad Q = sqrt(3) dot.op (W_1 - W_2) quad quad tan φ = sqrt(3) dot.op (W_1 - W_2)/(W_1 + W_2) $]

Con el motor del ejemplo, W₁ = 8 298 W y W₂ = 3 925 W: suman 12 222 W, y √3 × (8 298 − 3 925) = 7 575 VAr, la reactiva calculada antes. La fórmula de Q solo vale con carga equilibrada; la de P vale siempre.

#tabla(none, columns: 5, align: (left, right, right, right, right),
  [cos φ (φ)], [W#sub[1]], [W#sub[2]], [W#sub[1] + W#sub[2]], [√3·V#sub[LL]·I#sub[L]·cos φ],
  [1 (0°)], [3 464 W], [3 464 W], [6 928 W], [6 928 W],
  [0,85 (31,8°)], [3 998 W], [1 891 W], [5 889 W], [5 889 W],
  [0,5 (60°)], [3 464 W], [0 W], [3 464 W], [3 464 W],
  [0,3 (72,5°)], [2 947 W], [−869 W], [2 078 W], [2 078 W],
)

La tabla, para una carga equilibrada de 400 V y 10 A, muestra el comportamiento que desconcierta la primera vez: con cos φ = 1 los dos vatímetros leen lo mismo, con cos φ = 0,5 uno de ellos lee cero, y #strong[por debajo de 0,5 su lectura es negativa]. No hay ningún error: es lo normal en un motor en vacío. Un vatímetro analógico tiraría la aguja contra el tope, y hay que invertir su bobina de tensión y restar su lectura; uno digital muestra el signo directamente.

#figura("trifasica-aron.svg", 100%, [El método de los dos vatímetros: bobinas de corriente en L1 y L2 y de tensión referidas a L3. A la derecha, sus lecturas con una carga equilibrada de 400 V y 10 A en función del ángulo de la carga; por encima de 60° (cos φ < 0,5), W#sub[2] es negativa.]) <fig-new-24-aron>

=== La red de 400/230 V que llega a un taller

La red de baja tensión nace en el centro de transformación del barrio, donde un transformador baja la media tensión a 400/230 V. Su secundario está en estrella, y del punto de estrella sale el neutro, que se une a tierra en el propio centro (en España, la red pública usa el esquema TT, en el que las masas de cada instalación tienen además su propia toma de tierra); su primario suele ir en triángulo. De cada transformador salen varias líneas de cuatro conductores, L1, L2, L3 y N. Una vivienda suele tomar una fase y el neutro, y sus 230 V son una tensión de fase; un taller, un local o un edificio entero toman las cuatro.

La potencia que se contrata en trifásica es la de una carga resistiva equilibrada que llevara a su corriente máxima el interruptor de control: P = √3·400·I. Con 20 A salen 13,856 kW; con 25 A, 17,321 kW; con 32 A, 22,170 kW. De ahí las cifras con tres decimales de los contratos.

Un taller de electrónica con algo de mecánica, con una potencia contratada de 17,321 kW (25 A por fase), podría tener estas cargas funcionando a la vez:

#tabla(none, columns: 5, align: (left, left, right, right, right),
  [Carga], [Conexión], [P (kW)], [Q (kVAr)], [I (A)],
  [Compresor: 4 kW en el eje, η = 0,85, cos φ = 0,82], [trifásica], [4,71], [3,28], [8,28],
  [Torno: 2,2 kW en el eje, η = 0,82, cos φ = 0,78], [trifásica], [2,68], [2,15], [4,96],
  [Alumbrado (0,8 kW) y horno de refusión (1,5 kW)], [L1–N], [2,30], [0], [9,96],
  [Puestos de trabajo: ordenadores, fuentes y soldadores], [L2–N], [1,80], [0], [7,79],
  [Calefactor], [L3–N], [2,00], [0], [8,66],
  [#strong[Total]], [—], [#strong[13,49]], [#strong[5,44]], [—],
)

Cada fase lleva la corriente de los dos motores más la de su carga monofásica, sumadas como fasores, porque las de los motores van retrasadas y las de las cargas resistivas no. Resultan #strong[22,1 A en L1, 20,1 A en L2 y 20,9 A en L3]\; la suma aritmética de L1 habría dado 23,2 A. Las tres caben en los 25 A del contrato, con poco margen en L1. La instalación toma S = 14,54 kVA con un factor de potencia de 0,93, y el neutro, que solo ve las cargas monofásicas, lleva 1,89 A de 50 Hz, porque están bien repartidas. A esa cifra hay que sumar los 150 Hz de las fuentes conmutadas de los puestos de trabajo, que el cálculo con fasores no ve y una pinza de verdadero valor eficaz sí.

De este ejemplo salen las reglas de reparto de cualquier instalación pequeña. Las máquinas grandes, trifásicas, porque son equilibradas por construcción. Las cargas monofásicas grandes, en fases distintas. Los circuitos de enchufes y de alumbrado, repartidos para que ninguna fase se acerque a su límite antes que las demás; y la comprobación final, con la pinza en las tres fases y en el neutro.

#precaucion[
  En un local con enchufes conectados a fases distintas, #strong[entre los vivos de dos bases puede haber 400 V]. Unir con un cable equipos alimentados de bases distintas, o tocar a la vez dos de ellos con un defecto de aislamiento, expone a la tensión de línea, no a la de fase. Y un equipo monofásico conectado por error entre dos fases recibe 400 V.
]

=== En el banco

#strong[El FNIRSI no sirve para medir la red trifásica], y conviene saber exactamente por qué, porque no es una cuestión de precisión sino de seguridad:

- #strong[Los picos.] La entrada del osciloscopio admite ±400 V. El pico de la tensión de fase, 326,6 V (359 V con un 10 % de sobretensión), deja muy poco margen, y el de la tensión de línea, 565,7 V (622 V), lo supera. La sonda en ×10 llega a 600 V, pero en CAT II.
- #strong[La categoría.] CAT II es la de los aparatos enchufados a una base. Un cuadro eléctrico es instalación fija, CAT III, y la acometida, CAT IV (sección #nr("sec-47.10")): los transitorios que pueden aparecer allí son mucho mayores, y el manual del 2C53T no declara ninguna categoría de medida (sección #nr("sec-21.2")).
- #strong[La masa común.] Los dos canales comparten la pinza de masa (sección #nr("sec-21.21")). Para ver dos fases habría que referir ambas al neutro, y el instrumento entero, que funciona con batería y está flotante, queda al potencial de esa pinza: si por error va a una fase, la carcasa y los mandos están a 230 V.
- #strong[La corriente.] El método del shunt (sección #nr("sec-53.17")) exige intercalar una resistencia en el conductor, inaceptable en una línea de 400 V, y la entrada de 10 A del multímetro está limitada a 250 V.

Lo que hace falta es otro instrumental, y de categoría adecuada:

- #strong[Tensiones]: un multímetro CAT III o CAT IV, como el Brymen BM869s (CAT IV 1000 V). Se miden las tres tensiones de fase (unos 230 V), las tres de línea (unos 400 V) y la tensión entre neutro y tierra, que debe ser de muy pocos voltios; si es mayor, el neutro está sobrecargado o tiene una mala conexión.
- #strong[Corrientes]: una pinza amperimétrica de verdadero valor eficaz, abrazando cada conductor por separado, neutro incluido. La lectura del neutro es el diagnóstico más rápido de desequilibrio y de armónicos. Abrazando las tres fases y el neutro a la vez debe leer casi cero; lo que lea es corriente de fuga a tierra, la misma diferencia que vigila el diferencial (sección #nr("sec-47.7")).
- #strong[Potencia y calidad de red]: un analizador de redes trifásico, con cuatro entradas de tensión y cuatro pinzas (a menudo bobinas de Rogowski flexibles). Muestrea tensiones y corrientes y aplica el método de los tres vatímetros, y da P, Q, S y factor de potencia por fase y totales, los armónicos, el desequilibrio y la secuencia.
- #strong[Formas de onda]: un osciloscopio con sondas diferenciales de alta tensión de la categoría del punto de medida, o con canales aislados entre sí.
- #strong[Secuencia]: un secuencímetro, antes de conectar cualquier motor.

Y una advertencia que no es técnica: medir dentro de un cuadro en tensión es un trabajo en proximidad de partes activas, y en España el Real Decreto 614/2001 lo reserva a trabajadores autorizados o cualificados. Para un taller de electrónica, lo razonable es que esas medidas las haga el instalador.

Lo que sí puede hacerse en el banco, sin ningún riesgo, es simular. Todos los circuitos de esta sección se han comprobado con ngspice, el mismo motor del simulador de la app (capítulo #nr("cap-42")), y el del neutro cortado cabe en unas líneas: tres fuentes de 230,9 V eficaces a 120°, tres resistencias y ningún conductor entre el punto de estrella y masa. Las tensiones de las cargas son las diferencias v(l1) − v(s), v(l2) − v(s) y v(l3) − v(s): 139 V, 263 V y 331 V. Basta con añadir «VN s 0 0» para conectar el neutro y ver cómo vuelven los 230,9 V a las tres.

#codigo[```
* Broken neutral: unbalanced star (2 kW, 1 kW, 200 W rated at 230 V) on 400/230 V
V1 l1 0 AC 230.94 0
V2 l2 0 AC 230.94 -120
V3 l3 0 AC 230.94 120
R1 l1 s 26.45
R2 l2 s 52.9
R3 l3 s 264.5
* no neutral: node s (star point) floats
.ac lin 1 50 50
.end
```]

// ============================================================================================ PARTE 2
#ejercicios[
  #ejercicio[
    La red de un taller es de 400/230 V. Calcula el valor exacto de la tensión de fase si la de línea es 400 V, y los picos de ambas. ¿Por qué no debe medirse la tensión entre dos fases con el osciloscopio del FNIRSI, aunque la sonda esté en ×10?
  ] <ej-24.9>

  #ejercicio[
    Una carga equilibrada en estrella tiene Z = 30 + j40 Ω por fase y se conecta a la red de 400/230 V. Calcula la corriente de línea, el factor de potencia y las potencias activa, reactiva y aparente.
  ] <ej-24.10>

  #ejercicio[
    Las mismas tres impedancias del ejercicio anterior se conectan en triángulo. Calcula la corriente de cada rama, la corriente de línea y la potencia activa, y compárala con la de la conexión en estrella.
  ] <ej-24.11>

  #ejercicio[
    En un local alimentado a 400/230 V hay tres cargas resistivas monofásicas: 3 kW entre L1 y N, 2 kW entre L2 y N y 1 kW entre L3 y N (potencias a 230,9 V). Calcula la corriente del neutro. ¿Cuánto valdría si se desconectara la carga de L3?
  ] <ej-24.12>

  #ejercicio[
    Un motor trifásico de 7,5 kW en el eje, con rendimiento 0,88 y cos φ = 0,80, se alimenta a 400 V. Calcula su corriente de línea, la potencia reactiva de la batería que lleva su factor de potencia a 0,95 y la capacidad de cada condensador si la batería se conecta en triángulo y si se conecta en estrella. ¿Cuánto baja la corriente de línea?
  ] <ej-24.13>

  #ejercicio[
    Dos vatímetros en conexión de Aron sobre una carga equilibrada a 400 V leen W₁ = 5,2 kW y W₂ = 1,8 kW. Halla la potencia activa, la reactiva, el factor de potencia y la corriente de línea.
  ] <ej-24.14>

  #ejercicio[
    Tres cargas resistivas de 3 kW, 500 W y 100 W (potencias nominales a 230 V) están conectadas en estrella a la red de 400/230 V, una por fase, y el neutro se corta. Calcula la tensión que recibe cada carga y la potencia que disipa. ¿Qué le ocurre a la carga de 100 W?
  ] <ej-24.15>

  #ejercicio[
    Un motor en vacío toma 6 A por fase con cos φ = 0,3 a 400 V, y se mide su potencia con dos vatímetros en conexión de Aron (secuencia directa, bobinas de tensión a L3). Calcula las dos lecturas. ¿Qué indicaría un vatímetro analógico en la segunda posición, y cómo se obtiene la potencia del motor?
  ] <ej-24.16>
]

// ============================================================================================ PARTE 3
#soluciones[
  #solucion("ej-24.9")[
    V#sub[f] = V#sub[LL]/√3 = 400/1,732 = 230,9 V (la cifra nominal, 230 V, es un redondeo). Picos: 230,9 × √2 = 326,6 V y 400 × √2 = 565,7 V; con la tolerancia de +10 %, 359 V y 622 V. El pico entre fases supera los ±400 V que admite la entrada del osciloscopio, y aunque la sonda en ×10 llegue a 600 V, su categoría es CAT II: un cuadro es CAT III, con transitorios mucho mayores. Además, los dos canales comparten masa, y el instrumento flotante quedaría al potencial de la pinza. La medida se hace con un multímetro CAT III o CAT IV.
  ]

  #solucion("ej-24.10")[
    |Z| = √(30² + 40²) = 50 Ω, con φ = 53,1° y cos φ = 30/50 = 0,6 (inductivo). Cada impedancia recibe 230,9 V: I#sub[L] = I#sub[f] = 230,9/50 = 4,62 A. P = 3·I²·R = 3 × 4,62² × 30 = 1 920 W; Q = 3·I²·X = 2 560 VAr; S = √3 × 400 × 4,62 = 3 200 VA. Comprobación: √(1 920² + 2 560²) = 3 200 ✓. La simulación con ngspice da 4,619 A, 1 920 W y 2 560 VAr.
  ]

  #solucion("ej-24.11")[
    En triángulo cada impedancia recibe 400 V: I#sub[f] = 400/50 = 8,00 A, e I#sub[L] = √3 × 8,00 = 13,86 A. P = 3 × 8² × 30 = 5 760 W, exactamente el triple de los 1 920 W en estrella, y la corriente de línea también es el triple (13,86 frente a 4,62 A). Es la regla de que un triángulo de Z equivale a una estrella de Z/3. ngspice: 13,86 A de línea y 5 760 W.
  ]

  #solucion("ej-24.12")[
    Corrientes: I₁ = 3 000/230,9 = 12,99 A, I₂ = 2 000/230,9 = 8,66 A, I₃ = 1 000/230,9 = 4,33 A, en fase con sus tensiones (0°, −120° y +120°). La suma fasorial: I#sub[N] = 12,99 + 8,66∠−120° + 4,33∠120° = 7,50 A∠−30°. Una forma rápida: restar a las tres la menor, 4,33 A, que es una terna equilibrada y no aporta nada, y queda 8,66 + 4,33∠−120°, de módulo 7,50 A. Sin la carga de L3: |12,99 + 8,66∠−120°| = 11,46 A; el neutro lleva más al quitar carga, porque la de L3 compensaba parte del desequilibrio. ngspice: 7,50 A.
  ]

  #solucion("ej-24.13")[
    P = 7 500/0,88 = 8 523 W; I#sub[L] = 8 523/(√3 × 400 × 0,80) = 15,38 A; Q = P·tan φ₁ = 8 523 × 0,75 = 6 392 VAr. Batería: Q#sub[C] = 8 523 × (0,750 − 0,329) = 3 591 VAr. En triángulo, C = Q#sub[C]/(3·ω·V#sub[LL]²) = 3 591/(3 × 314,16 × 400²) = 23,8 µF por condensador, para 400 V; en estrella, el triple, 71,4 µF, para 230 V. La corriente baja a 8 523/(√3 × 400 × 0,95) = 12,95 A, un 15,8 % menos. ngspice, con el motor como estrella R-L y la batería en triángulo: 12,95 A.
  ]

  #solucion("ej-24.14")[
    P = W₁ + W₂ = 7,0 kW. Q = √3 × (W₁ − W₂) = √3 × 3,4 = 5,89 kVAr. tan φ = 5,89/7,0 = 0,841, φ = 40,1° y cos φ = 0,765. Corriente: I#sub[L] = P/(√3·V#sub[LL]·cos φ) = 7 000/(√3 × 400 × 0,765) = 13,2 A. Como W₁ > W₂ con la conexión indicada, la carga es inductiva.
  ]

  #solucion("ej-24.15")[
    Resistencias: R = 230²/P = 17,63 Ω, 105,8 Ω y 529 Ω. Con el neutro cortado, el punto de estrella se sitúa (Millman) en V#sub[N′] = Σ(V#sub[k]/R#sub[k])/Σ(1/R#sub[k]), a 174,6 V del neutro, y las cargas reciben 61,9 V, 339,0 V y 364,3 V. Potencias: 217 W, 1 086 W y 251 W, frente a los 3 025 W, 504 W y 101 W que disiparían con el neutro (a 230,9 V). La carga de 100 W recibe 364 V, un 58 % más de su tensión nominal, y disipa 2,5 veces su potencia: una lámpara se funde y un equipo electrónico pierde su varistor o su condensador de entrada. ngspice da las mismas tensiones.
  ]

  #solucion("ej-24.16")[
    φ = arccos 0,3 = 72,5°. W₁ = V#sub[LL]·I#sub[L]·cos(φ − 30°) = 400 × 6 × cos 42,5° = 1 768 W; W₂ = 400 × 6 × cos 102,5° = −521 W. Un vatímetro analógico en la segunda posición desviaría la aguja hacia atrás, contra el tope; se invierte su bobina de tensión, se lee 521 W y se resta: P = 1 768 − 521 = 1 247 W, que coincide con √3 × 400 × 6 × 0,3 = 1 247 W. La reactiva, √3 × (1 768 + 521) = 3 965 VAr, muestra que el motor en vacío toma sobre todo corriente magnetizante. ngspice: 1 768 W y −521 W.
  ]
]

// ============================================================================================ PARTE 4
// (optional) Summary of the chapter, now 23.11. Add this paragraph after the one on the transformer
// («El transformador escala la tensión…»):

#strong[En trifásica], tres tensiones a 120° dan una potencia instantánea constante con menos cobre. V#sub[LL] = √3·V#sub[f] (400/230 V); un triángulo de Z equivale a una estrella de Z/3; P = √3·V#sub[LL]·I#sub[L]·cos φ, con φ el ángulo de cada carga. El neutro solo lleva el desequilibrio y los armónicos múltiplos de tres, que con fuentes conmutadas pueden hacerle llevar 1,73 veces la corriente de una fase; sin neutro, la potencia se mide con dos vatímetros (Aron).

// …these two items at the end of the list «Los errores característicos»:
//   - Usar en P = √3·V#sub[LL]·I#sub[L]·cos φ el ángulo entre V#sub[LL] e I#sub[L], que es φ + 30°.
//   - Suponer que el neutro siempre lleva menos corriente que las fases, o ponerle fusible.
// …and these three formulas at the end of the #tarjeta:
//   #formula($ V_"LL" = sqrt(3) dot.op V_"f" quad quad P = sqrt(3) dot.op V_"LL" dot.op I_"L" dot.op cos φ $)
//   #formula($ C_Δ = Q_"C"/(3 dot.op ω dot.op V_"LL"^2) quad quad C_"Y" = 3 dot.op C_Δ $)
//   #formula($ P = W_1 + W_2 quad quad Q = sqrt(3) dot.op (W_1 - W_2) $)
