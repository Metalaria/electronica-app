// P04 — «Inversores y rectificadores controlados»: two new sections of chapter 32 (cap33.typ), for «Electrónica
// Práctica Avanzada». Five parts, each to be pasted in its own place (see NOTAS.md):
//   PARTE 1  the two sections 32.10 «Convertidores CC-CA: el Inversor» and 32.11 «Rectificadores Controlados»:
//            after the end of 32.9 «Gobernar Motores: Puente en H y Conmutación Electrónica» (after its figure
//            <fig-33.10>) and before «== Por Qué el FM7303 Renuncia a Todo Esto <sec-33.10>», which becomes 32.12.
//   PARTE 2  «Problema 32.D — Un inversor de 500 W para una carga resistiva»: in «Problemas de Diseño»
//            <sec-33.17> (now 32.19), after the end of Problema 32.C.
//   PARTE 3  eight exercises: inside the chapter's #ejercicios[…], after the exercise labelled <ej-28.5>.
//   PARTE 4  their solutions: inside #soluciones[…], after #solucion("ej-28.5")[…].
//   PARTE 5  (optional) five formulas for the chapter's #tarjeta (in 32.13, now 32.15).
// Numbers: sections 32.10 and 32.11 (32.10-32.17 become 32.12-32.19); figures 32.12-32.18 (the old 32.12-32.19
// become 32.19-32.26) and the problem's figure, 32.27; exercises 32.9-32.16.
// Every number comes from scripts/calculos.py, and every circuit from the ngspice runs (spice/, spice_analisis.py).

// ============================================================================================ PARTE 1
== Convertidores CC-CA: el Inversor <sec-new-33-inversor>

Todo lo que lleva visto el capítulo convierte continua en continua. Pero un sistema de alimentación ininterrumpida tiene que sacar 230 V de alterna de una batería, un inversor fotovoltaico tiene que inyectar en la red la energía de unos paneles que dan continua, y un variador de frecuencia tiene que alimentar un motor de inducción con una tensión trifásica de frecuencia y amplitud ajustables (sección #nr("sec-33.13")). Las tres cosas son el mismo bloque: un #strong[inversor], o convertidor CC-CA. Y no hace falta ningún componente nuevo, porque el inversor monofásico ya apareció en la sección #nr("sec-33.9"): es el puente en H. Lo único que cambia es cómo se gobiernan sus cuatro interruptores.

=== Del puente en H al inversor monofásico

En el puente en H, los dos interruptores de una misma rama nunca conducen a la vez, así que cada rama solo tiene dos estados: su punto medio está unido al positivo del bus o al negativo. Con las dos ramas A y B, la tensión entre los puntos medios, v#sub[AB], solo puede valer +V#sub[dc] (S1 y S4 cerrados), −V#sub[dc] (S2 y S3) o cero (los dos superiores o los dos inferiores). Un inversor es la manera de encadenar esos tres valores para que su media se parezca a una senoide.

#strong[La onda cuadrada.] La forma más simple es alternar las dos diagonales cada medio periodo: +V#sub[dc] durante 10 ms y −V#sub[dc] durante otros 10 ms dan una alterna de 50 Hz. Su serie de Fourier (sección #nr("sec-0.11")) solo tiene armónicos impares, con amplitudes que caen como 1/n:

#ec[$ v_("AB") = (4 V_("dc"))/(π) lr(( sin ω t + (sin 3 ω t)/("3") + (sin 5 ω t)/("5") + dots )) $]

y la fundamental tiene un valor eficaz de

#ec[$ V_("1,ef") = (4)/(π sqrt("2")) V_("dc") approx "0,900" dot.op V_("dc") $]

Con un bus de 400 V, la fundamental vale 360 V eficaces, el tercer armónico 120 V, el quinto 72,0 V y el séptimo 51,4 V. La distorsión armónica total (THD, la relación entre el valor eficaz de todos los armónicos y el de la fundamental) es del #strong[48,3 %], y no depende de V#sub[dc]. Para una resistencia calefactora da igual; para un motor o un transformador, esos armónicos son corrientes que calientan sin dar par ni potencia útil. Y hay un segundo problema: la amplitud solo se puede ajustar cambiando el bus.

#strong[La onda cuasi cuadrada.] Si las dos ramas conmutan cada una a 50 Hz, pero desfasadas, aparecen intervalos en que las dos están arriba o las dos abajo y la salida vale cero. Con un pulso de anchura σ en cada semiciclo, la amplitud del armónico n es:

#ec[$ V_("n") = (4 V_("dc"))/(n π) dot.op sin((n σ)/("2")) $]

y eso da dos mandos a la vez. La fundamental se ajusta con σ, sin tocar el bus. Y con σ = 120° el seno se anula para n = 3 y sus múltiplos: la onda no tiene tercer armónico, el quinto y el séptimo quedan en el 20 % y el 14,3 % de la fundamental, y el THD baja al 31,1 % (el mínimo, 29,0 %, está en σ ≈ 134°). Es lo que venden como «onda senoidal modificada» los sistemas de alimentación ininterrumpida baratos, con una particularidad: para dar a la vez los 325 V de pico y los 230 V eficaces de la red, el pulso tiene que durar σ = 90°, y entonces la fundamental es de solo 207 V y el THD vuelve a ser del 48,3 %, el mismo de la cuadrada. Una fuente conmutada con PFC lo tolera; un motor de inducción o un cargador con transformador, mucho peor.

#figura("inversor-ondas.svg", 100%, [Tres maneras de gobernar el mismo puente en H, con su espectro. La onda cuadrada tiene todos los armónicos impares; la cuasi cuadrada de 120° pierde el tercero y sus múltiplos; la PWM senoidal tiene más distorsión total que las dos, pero toda lejos de la fundamental, en torno a dos veces la frecuencia de conmutación, donde un filtro pequeño la elimina.]) <fig-new-33-ondas>

=== La modulación senoidal (SPWM)

La solución de verdad no intenta que la onda se parezca a una senoide, sino que lo haga su #strong[valor medio local]. Es la idea del reductor de la sección #nr("sec-33.2"), donde la salida es D·V#sub[in] porque la bobina promedia los pulsos, llevada un paso más allá: si el ciclo de trabajo varía despacio siguiendo una senoide, la media también la sigue. Se conmuta a una frecuencia alta f#sub[sw] (de 5 a 20 kHz con IGBT, más con MOSFET o carburo de silicio) y, en cada periodo de conmutación, el tiempo en +V#sub[dc] se elige proporcional al valor que la senoide tiene en ese instante.

La forma clásica de hacerlo es analógica, aunque hoy la hace un temporizador de microcontrolador (sección #nr("sec-38.5")): se compara una #strong[referencia] senoidal de 50 Hz con una #strong[portadora] triangular de frecuencia f#sub[sw]. Mientras la referencia está por encima, la rama conecta su punto medio al positivo; mientras está por debajo, al negativo. Dos números describen la modulación:

#ec[$ m_("a") = (hat(V)_("ref"))/(hat(V)_("tri")) quad quad m_("f") = (f_("sw"))/(f_("1")) $]

el #strong[índice de modulación] m#sub[a], cociente entre la amplitud de la referencia y la de la portadora, y el #strong[índice de frecuencia] m#sub[f], el número de periodos de conmutación por ciclo de la fundamental f#sub[1]. Mientras m#sub[a] ≤ 1, la fundamental es exactamente proporcional al índice:

#ec[$ hat(V)_("1") = m_("a") dot.op V_("dc") quad quad (m_("a") <= "1") $]

Para sacar 230 V eficaces (325,3 V de pico) de un bus de 400 V, m#sub[a] = 325,3/400 = 0,813.

#strong[Bipolar y unipolar.] Hay dos maneras de llevar esta idea al puente. En la #strong[bipolar], las dos diagonales conmutan en bloque y v#sub[AB] salta entre +V#sub[dc] y −V#sub[dc]\; los armónicos se agrupan alrededor de m#sub[f] y sus múltiplos, y el mayor está justo en m#sub[f]. En la #strong[unipolar], cada rama tiene su propia referencia, una la senoide y la otra la misma senoide cambiada de signo, con una sola portadora común (figura #nr("fig-new-33-spwm")). La salida tiene entonces tres niveles, +V#sub[dc], 0 y −V#sub[dc], y algo mejor que eso: los armónicos alrededor de m#sub[f] se cancelan entre las dos ramas y el primer grupo aparece en 2·m#sub[f]. Con los mismos transistores y la misma frecuencia de conmutación, el filtro ve el doble de frecuencia. La tabla lo cuantifica para m#sub[a] = 0,8 y f#sub[sw] = 20 kHz (m#sub[f] = 400), en fracciones de V#sub[dc]:

#tabla(none, columns: 4, align: (left, right, right, right,),
  [Armónico], [Frecuencia], [Bipolar], [Unipolar],
  [Fundamental], [50 Hz], [0,800], [0,800],
  [m#sub[f]], [20 kHz], [0,818], [0],
  [m#sub[f] ± 2], [19,9 y 20,1 kHz], [0,220], [0],
  [2·m#sub[f] ± 1], [39,95 y 40,05 kHz], [0,314], [0,314],
  [2·m#sub[f] ± 3], [39,85 y 40,15 kHz], [0,139], [0,139],
  [THD sin filtrar], [—], [146 %], [76,9 %],
)

La última fila sorprende: la PWM senoidal tiene #strong[más] distorsión total que la onda cuadrada. Pero no importa cuánta haya, sino dónde está. Los armónicos de la cuadrada empiezan en 150 Hz, a una octava y media de la fundamental, y ningún filtro razonable los separa de ella; los de la PWM empiezan en 40 kHz, casi diez octavas por encima, y los quita una bobina y un condensador pequeños. En el puente bipolar, además, hay un armónico en m#sub[f] mayor que la propia fundamental, que el filtro tiene que atenuar con una frecuencia la mitad de alta: de ahí que los inversores monofásicos usen casi siempre la unipolar.

Conviene que m#sub[f] sea grande (más de 20) o, si es pequeño, entero e impar y sincronizado con la referencia; si no, aparecen subarmónicos y una pequeña componente continua que satura transformadores. Con portadoras de varios kilohercios el problema desaparece.

#figura("inversor-spwm.svg", 100%, [La PWM senoidal unipolar. Cada rama compara su referencia con la misma portadora triangular; la rama A sigue a +m#sub[a]·sen ωt y la B a −m#sub[a]·sen ωt. La tensión de salida del puente, v#sub[AB] = v#sub[A] − v#sub[B], solo toma tres valores, pero su media en cada periodo de conmutación es la senoide de referencia. Se ha usado m#sub[f] = 15 para que se distingan los pulsos; un inversor real usa cientos.]) <fig-new-33-spwm>

=== Índice de modulación y sobremodulación

¿Qué pasa si la referencia supera a la portadora, m#sub[a] > 1? Cerca de los picos de la senoide desaparecen los cruces: la rama se queda arriba durante varios periodos de conmutación seguidos y la PWM degenera, en esos tramos, en onda cuadrada. Es la #strong[sobremodulación], y tiene dos consecuencias (figura #nr("fig-new-33-modulacion")):

- #strong[La fundamental deja de crecer en proporción.] Con m#sub[a] = 1,5 vale 1,17·V#sub[dc], y no 1,5; con m#sub[a] = 2, 1,22·V#sub[dc]\; y nunca pasa del límite de la onda cuadrada, 4/π = 1,27·V#sub[dc].
- #strong[Vuelven los armónicos bajos.] Con m#sub[a] = 1,5, el tercer armónico ya es el 17,6 % de V#sub[dc], y esos sí llegan a la carga, porque el filtro está calculado para 40 kHz.

La zona lineal es la buena, y por eso un inversor se diseña con el bus suficiente para trabajar con m#sub[a] entre 0,8 y 0,95, dejando margen para las caídas de tensión internas y para las bajadas del bus. La sobremodulación se usa a propósito en los variadores, al final del margen de velocidad, cuando se prefiere un poco más de tensión a costa de algo de distorsión.

#figura("inversor-modulacion.svg", 69%, [Fundamental, tercer y quinto armónico frente al índice de modulación (PWM bipolar, m#sub[f] = 21). Hasta m#sub[a] = 1 la fundamental es m#sub[a]·V#sub[dc] y no hay armónicos bajos; en sobremodulación la fundamental tiende al límite de la onda cuadrada y reaparecen el tercero y el quinto.]) <fig-new-33-modulacion>

=== El filtro de salida

Entre el puente y la carga va un filtro LC paso bajo (figura #nr("fig-new-33-spwm")). Su papel no es el del filtro de un reductor, que deja pasar la continua: este tiene que dejar pasar los 50 Hz y frenar los 40 kHz, y eso fija dos condiciones. La frecuencia de corte, f#sub[0] = 1/(2π·√(L·C)), debe quedar muy por encima de 50 Hz, para que el filtro no altere la fundamental, y muy por debajo del primer grupo de armónicos, porque por encima de f#sub[0] el LC atenúa 40 dB por década:

#ec[$ A(f) approx lr(( f / f_("0") ))^("2") quad quad (f >> f_("0")) $]

La bobina se elige por el rizado de corriente, como en el reductor. En la unipolar el puente conmuta entre 0 y V#sub[dc] (en el semiciclo positivo) al doble de f#sub[sw], con un ciclo de trabajo d = v/V#sub[dc] que sigue a la senoide, y el rizado de pico a pico es:

#ec[$ Delta I = (V_("dc") dot.op d dot.op ("1" - d))/("2" dot.op L dot.op f_("sw")) quad arrow.r.double.long quad Delta I_("máx") = (V_("dc"))/("8" dot.op L dot.op f_("sw")) quad (d = "0,5") $]

El máximo no está en el pico de la senoide, sino donde la tensión de salida es la mitad del bus.

#ejemplo[
  Filtro de un inversor de 230 V y 500 W, con bus de 400 V y PWM unipolar a 20 kHz. \ Con L = 2,2 mH, el rizado máximo es ΔI = 400/(8 × 2,2 mH × 20 kHz) = 1,14 A de pico a pico, algo más de un tercio del pico de la corriente de carga (3,07 A). \ Con C = 3,3 µF, f#sub[0] = 1/(2π·√(2,2 mH × 3,3 µF)) = 1 868 Hz: 37 veces la fundamental y 21 veces por debajo de 40 kHz. \ A 40 kHz la atenuación es (40 000/1 868)² ≈ 458, es decir, 53,2 dB. Aplicada al espectro exacto de la PWM, deja en la carga 230,2 V de fundamental con un rizado de alta frecuencia de 0,30 V eficaces: un THD del 0,13 %. \ A 50 Hz el condensador solo toma 0,24 A, y en la bobina caen 1,5 V: el filtro apenas toca la fundamental. \ La misma LC no serviría para una onda cuadrada: le dejaría un THD del 55 %, porque sus armónicos bajos pasan casi enteros y los que caen cerca de 1 868 Hz salen amplificados por la resonancia.
]

Esa resonancia es el punto débil del filtro. Con la carga nominal, la resistencia de 105,8 Ω amortigua el LC (su impedancia característica, √(L/C), es de 25,8 Ω, y el factor de calidad resultante, 105,8/25,8 = 4,1, es moderado), pero en vacío no hay nada que lo amortigüe, y cualquier escalón de carga o cualquier armónico cerca de 1,9 kHz lo hace oscilar. Se resuelve con una resistencia en serie con un segundo condensador en paralelo con C (amortiguamiento pasivo), o haciendo que el lazo de control mida la corriente del condensador y la realimente (amortiguamiento activo), que es lo que hacen los inversores comerciales.

=== El inversor trifásico de seis interruptores

Un motor trifásico, o la conexión a la red trifásica (sección #nr("sec-new-24-trifasica")), necesita tres tensiones desfasadas 120°. El inversor trifásico añade una tercera rama al puente en H: seis interruptores, tres ramas, y la carga conectada a los tres puntos medios, normalmente en estrella y sin neutro (figura #nr("fig-new-33-trifasico")). Cada rama se modula con su propia referencia, desfasada 120° de las otras dos, y todas comparten la portadora.

Cada rama da, respecto al punto medio del bus, una fundamental de m#sub[a]·V#sub[dc]/2 de pico. En el puente en H la salida es la diferencia de dos ramas en oposición, y por eso vale el doble, m#sub[a]·V#sub[dc]\; aquí la tensión de línea es la diferencia de dos ramas desfasadas 120°, que es √3 veces la de una rama:

#ec[$ hat(V)_("LL") = (sqrt("3"))/("2") dot.op m_("a") dot.op V_("dc") quad arrow.r.double.long quad V_("LL,ef") = "0,612" dot.op m_("a") dot.op V_("dc") $]

Y aquí aparece el problema práctico. Un variador conectado a la red de 400 V rectifica las tres fases con un puente de seis pulsos (sección #nr("sec-new-33-rectificadores")) y obtiene un bus de unos 540 V. Con m#sub[a] = 1, la PWM senoidal solo saca 0,612 × 540 = 331 V de línea: el motor de 400 V no recibiría su tensión nominal. Para llegar a 400 V con modulación senoidal haría falta un bus de 653 V.

#strong[La secuencia cero.] La salida está en la observación de que la carga, conectada en estrella sin neutro, solo ve las #strong[diferencias] entre ramas. Cualquier señal que se sume por igual a las tres referencias desaparece de las tensiones de línea, igual que en la sección #nr("sec-new-24-trifasica") los armónicos múltiplos de tres no aparecen entre fases. Si se suma a las tres referencias la señal −(máx + mín)/2, donde máx y mín son en cada instante la mayor y la menor de las tres, sus picos se aplanan, la referencia toma la forma de «silla de montar» de la figura #nr("fig-new-33-trifasico"), y m#sub[a] puede subir hasta 2/√3 = 1,155 sin sobremodular. La tensión de línea máxima pasa a ser:

#ec[$ hat(V)_("LL,máx") = V_("dc") quad arrow.r.double.long quad V_("LL,ef") = "0,707" dot.op V_("dc") $]

un 15,5 % más que la senoidal: 382 V con el bus de 540 V, y 400 V con el bus de 566 V que da el rectificador en vacío. Sumar un tercer armónico de amplitud 1/6 de la referencia consigue lo mismo, con otra forma.

#strong[La modulación vectorial (SVPWM).] La silla de montar tiene otra lectura, más geométrica, que es como la explican los fabricantes de microcontroladores para control de motores. Las tres ramas, cada una arriba (1) o abajo (0), tienen 2³ = 8 estados. Si las tres tensiones de fase se combinan en un solo vector giratorio del plano (la transformación de Clarke), seis de esos estados dan vectores de longitud 2·V#sub[dc]/3 en los vértices de un hexágono, y los otros dos (000 y 111) dan el vector nulo. Una tensión trifásica equilibrada de amplitud V#sub[ref] es un vector de esa longitud que gira a ω. En cada periodo de conmutación T#sub[s], el modulador lo construye como media de los dos vectores activos que lo rodean y del nulo:

#ec[$ T_("1") = sqrt("3") dot.op T_("s") dot.op (V_("ref"))/(V_("dc")) dot.op sin("60°" - θ) quad quad T_("2") = sqrt("3") dot.op T_("s") dot.op (V_("ref"))/(V_("dc")) dot.op sin θ quad quad T_("0") = T_("s") - T_("1") - T_("2") $]

donde θ es el ángulo del vector dentro de su sector de 60°. El círculo más grande que cabe en el hexágono tiene radio V#sub[dc]/√3, y ese es el límite de la zona lineal: exactamente el mismo de la silla de montar, porque las dos son la misma modulación cuando el tiempo nulo se reparte por igual entre 000 y 111.

#ejemplo[
  Un variador con bus de 540 V alimenta un motor de 400 V y 50 Hz a 40 Hz. \ Con la ley V/f constante de la sección #nr("sec-33.13"), la tensión de línea debe ser 400 × 40/50 = 320 V, y la amplitud de fase, V#sub[ref] = 320·√2/√3 = 261,3 V, por debajo del límite 540/√3 = 311,9 V. \ Con T#sub[s] = 100 µs (10 kHz) y el vector a θ = 20° dentro del sector: T#sub[1] = √3 × 100 µs × (261,3/540) × sen 40° = 53,9 µs; T#sub[2] = √3 × 100 µs × 0,484 × sen 20° = 28,7 µs; y quedan T#sub[0] = 17,5 µs para los estados nulos. \ Comprobación: la media de los dos vectores, (53,9 × 2/3·540∠0° + 28,7 × 2/3·540∠60°)/100, da un vector de 261,3 V a 20°, el pedido.
]

#comprobacion[
  #strong[Comprobación con ngspice] de un inversor trifásico con bus de 540 V, conmutando a 10 kHz sobre una carga en estrella de 10 Ω y 20 mH por fase: con PWM senoidal y m#sub[a] = 1, la tensión de línea es de 328,3 V eficaces (331 V en el cálculo ideal); con la secuencia cero y m#sub[a] = 1,155, 378,9 V (382 V en el cálculo). La diferencia son las caídas de los interruptores. Las tensiones de rama respecto al negativo llevan la secuencia cero; las de línea no tienen tercer armónico: 0,07 V.
]

#figura("inversor-trifasico.svg", 100%, [El inversor trifásico de dos niveles. Abajo a la izquierda, los seis vectores activos de la modulación vectorial, con los estados de las ramas (1 = arriba); el vector de referencia se construye en cada periodo con los dos que lo rodean y con los nulos. A la derecha, la misma modulación vista como referencia de una fase: la senoide más la secuencia cero, que cabe entera en la portadora con m#sub[a] = 1,155.]) <fig-new-33-trifasico>

=== Tiempos muertos, drivers de rama y protección

Todo lo anterior supone que los dos interruptores de una rama conmutan a la vez. No pueden: el que se apaga tarda más en dejar de conducir que el que se enciende en empezar, y si se solapan cortocircuitan el bus (secciones #nr("sec-33.5") y #nr("sec-7.8")). Así que el modulador retrasa cada encendido un #strong[tiempo muerto] t#sub[d], durante el cual los dos están abiertos: de unos cientos de nanosegundos con MOSFET a uno o dos microsegundos con IGBT, por la cola de corriente de su apagado (sección #nr("sec-10.2")).

#strong[Lo que cuesta el tiempo muerto.] Durante t#sub[d] el punto medio de la rama no lo fija la orden, sino la corriente, que no se puede interrumpir y sigue por uno de los diodos (figura #nr("fig-new-33-tiempo-muerto")). Si la corriente sale de la rama hacia la carga, la recoge el diodo inferior y la rama está abajo; si entra, el superior, y está arriba. El resultado es que, en cada periodo de conmutación, la rama pierde un tiempo t#sub[d] a +V#sub[dc] cuando la corriente es positiva y lo gana cuando es negativa. En media:

#ec[$ Delta V = t_("d") dot.op f_("sw") dot.op V_("dc") quad "por rama, de signo contrario al de la corriente" $]

Con t#sub[d] = 1 µs, 20 kHz y 400 V, el tiempo muerto es el 2 % del periodo y el error, 8 V por rama y 16 V en el puente completo. Parece poco, pero es una onda cuadrada que sigue el signo de la corriente, y una onda cuadrada tiene armónicos impares: 20,4 V de pico se restan de la fundamental (un 6,3 %), y aparecen un tercer armónico de 6,8 V (2,1 % de la fundamental) y un quinto de 4,1 V (1,3 %). Son armónicos bajos que el filtro LC deja pasar enteros, y en un motor se notan como rizado de par a baja velocidad, donde la tensión es pequeña y el error, que no depende de ella, pesa más.

#comprobacion[
  #strong[Comprobación con ngspice] del inversor del problema #nr("prob-33.D") con tres tiempos muertos: sin tiempo muerto, la salida tiene 229,3 V y un THD del 0,15 %; con 0,5 µs, 223,9 V y un THD del 0,83 % (tercer armónico, 0,68 %); con 1 µs, 216,8 V y un THD del 2,18 % (tercer armónico, 1,76 %; quinto, 0,95 %). El cálculo simple da el 2,1 % y el 1,3 % para 1 µs: es una cota superior, porque cerca del paso por cero la corriente cambia de signo dentro del propio periodo de conmutación y el error es solo parcial. Y la simulación sin tiempo muerto enseña por qué no es opcional: con interruptores que tardan unas decenas de nanosegundos en conmutar, la fuente entrega 1,6 kW para 0,5 kW de salida, y el resto se va en conducción cruzada.
]

La corrección es la #strong[compensación del tiempo muerto]: como el error depende solo del signo de la corriente, el modulador mide la corriente de cada fase y suma a la referencia el error contrario. Los controladores de motor la incorporan, y es delicada justo donde más falta hace, en el paso por cero, donde el signo es dudoso.

#figura("inversor-tiempo-muerto.svg", 100%, [El tiempo muerto. A la izquierda, una rama: el encendido de cada interruptor se retrasa t#sub[d], y durante ese intervalo la tensión de la rama la fija el diodo que recoge la corriente; con corriente saliente se pierde tiempo arriba, con corriente entrante se gana. A la derecha, el error que produce en la salida del inversor del problema #nr("prob-33.D"), simulado con ngspice: una onda casi cuadrada en fase con la corriente, con los armónicos bajos que eso implica.]) <fig-new-33-tiempo-muerto>

#strong[Los drivers de rama.] En cada rama, el interruptor superior tiene el emisor (o la fuente) flotando entre los dos extremos del bus (sección #nr("sec-33.5")). Las dos soluciones se reparten así en los inversores:

- #strong[Bootstrap], con un driver de medio puente integrado: barato, una sola alimentación de 15 V referida al negativo, y adecuado hasta unos kilovatios. Su condensador se recarga cada vez que conduce el interruptor inferior, así que este tiene que encenderse en todos los periodos, aunque sea brevemente. En un inversor eso pone un tope al índice de modulación: con m#sub[a] = 0,8 y modulación unipolar, en el pico el interruptor inferior conduce el 10 % del periodo (5 µs de cada 50 µs) y basta; en sobremodulación hay periodos enteros sin encendido inferior y el bootstrap se descarga. En el arranque, además, hay que encender los inferiores un momento antes de empezar a modular, para cargar los tres condensadores.
- #strong[Drivers aislados] (por optoacoplador, por transformador o con aislador digital, sección #nr("sec-20.2")), cada uno con su convertidor CC-CC aislado. Es lo obligado con IGBT de potencia, que se apagan con tensión negativa de −5 a −8 V para que la capacidad Miller no los vuelva a encender cuando conmuta el otro de la rama (sección #nr("sec-7.8")). Un dato de su hoja que aquí importa: la inmunidad a transitorios de modo común (CMTI), en kV/µs, porque la referencia del driver superior sube y baja todo el bus en unas decenas de nanosegundos.

#strong[La protección de cortocircuito de rama.] Si una rama conduce entera, por un fallo del driver, un disparo espurio o un cortocircuito en la salida, la corriente solo la limitan las inductancias parásitas y sube a centenares de amperios en microsegundos. Un IGBT de potencia aguanta un cortocircuito durante un tiempo garantizado en su hoja de datos, típicamente entre 5 y 10 µs, y la protección tiene que actuar dentro de ese tiempo. Hay tres defensas, y un inversor serio lleva las tres:

- #strong[Desaturación] (sección #nr("sec-10.2")): el driver vigila la tensión colector-emisor mientras el IGBT está encendido. Con la corriente nominal es de unos 2 V; si pasa de unos 7 V, el transistor está fuera de saturación y lleva una corriente excesiva. Esa comprobación se inhibe durante 1 a 3 µs tras el encendido (el tiempo de cegado), porque la tensión tarda en bajar.
- #strong[Apagado suave]: al detectar el fallo, el driver no corta de golpe, sino con una resistencia de puerta mayor, porque cortar centenares de amperios en unos nanosegundos produce, en la inductancia parásita, una sobretensión que destruiría el transistor que se pretende salvar.
- #strong[Medida de la corriente del bus] con un shunt y un comparador que bloquea por hardware todas las salidas de PWM, sin pasar por el software. Los temporizadores para control de motores tienen una entrada de bloqueo (break) precisamente para eso (sección #nr("sec-38.5")).

=== En el banco

Un inversor que trabaja con el bus de 400 V no se pone en marcha a la primera con el bus de 400 V.

- #strong[Primero, sin potencia.] Con el bus desconectado, se comprueban las seis (o cuatro) señales de puerta con el osciloscopio: el tiempo muerto entre las dos de cada rama, que nunca deben solaparse (sección #nr("sec-33.5")), y que la modulación hace lo que se espera.
- #strong[Luego, con poca tensión.] Con la fuente de laboratorio a 30 o 40 V y el límite de corriente bajo, y la carga conectada, se mide la salida: debe salir una senoide de amplitud m#sub[a]·V#sub[dc] (a 40 V, unos 33 V de pico con m#sub[a] = 0,813). Un fallo aquí cuesta un fusible, no un módulo.
- #strong[Las medidas con el bus alto], con sonda diferencial o con el equipo alimentado a través de un transformador de aislamiento (sección #nr("sec-50.2")): ni el punto medio de una rama ni la salida del inversor están referidos a tierra, y conectar ahí la masa de un osciloscopio de sobremesa es un cortocircuito.
- #strong[La FFT de la salida] (sección #nr("sec-21.13")), con ventana de unos 200 ms para resolver 50 Hz: la raya del tercer armónico mide directamente el efecto del tiempo muerto, y cambiar t#sub[d] en el firmware y ver cómo sube o baja es la mejor manera de entenderlo.

== Rectificadores Controlados <sec-new-33-rectificadores>

El camino inverso, de alterna a continua, ya se conoce con diodos (sección #nr("sec-5.6")), y tiene un inconveniente para la potencia: la tensión de salida la fija la red y no se puede ajustar. Si los diodos se sustituyen por tiristores (sección #nr("sec-10.1")), que no conducen hasta que reciben un pulso de puerta, el instante de disparo controla la tensión media. Es el #strong[rectificador controlado], y aunque los convertidores con IGBT lo han desplazado en potencias pequeñas y medianas, sigue mandando donde se necesitan cientos de kilovatios con robustez: accionamientos de motores de continua grandes, electrólisis, cargadores industriales y las estaciones de transporte en corriente continua de alta tensión. Y su versión con diodos, el puente trifásico de seis pulsos, es la entrada de casi todos los variadores de frecuencia.

=== El puente monofásico totalmente controlado

Cuatro tiristores en puente, como el rectificador de diodos, con T1 y T2 disparados a la vez en el semiciclo positivo y T3 y T4 en el negativo (figura #nr("fig-new-33-rect-mono")). El retraso del disparo respecto al paso por cero de la red es el #strong[ángulo de disparo] α. Lo que pasa después depende de la carga.

#strong[Con carga resistiva], la corriente sigue a la tensión: los tiristores conducen desde α hasta el paso por cero, donde la corriente se anula y se apagan solos. La salida es un trozo de cada semiciclo, como en el regulador de la sección #nr("sec-10.1"), pero rectificado:

#ec[$ V_("d") = (sqrt("2") dot.op V)/(π) dot.op ("1" + cos α) $]

#strong[Con carga muy inductiva], como el inducido de un motor de continua o una carga con una bobina de alisado grande, la corriente no puede anularse en el paso por cero: la inductancia la mantiene, y los tiristores que conducen siguen conduciendo, ahora con la tensión de red ya negativa, hasta que se disparan los otros dos y la corriente pasa a ellos. Cada pareja conduce exactamente medio ciclo, desde α hasta α + 180°, y la salida incluye un trozo negativo:

#ec[$ V_("d") = (2 sqrt("2") dot.op V)/(π) dot.op cos α = "0,900" dot.op V dot.op cos α $]

Con la red de 230 V, V#sub[d] vale 207,1 V con α = 0 (lo mismo que el puente de diodos sin condensador), 146,4 V con α = 45° y 103,5 V con α = 60°. Con carga resistiva, a esos mismos ángulos, 176,7 y 155,3 V.

#strong[Y con α > 90°, la tensión media es negativa.] La corriente no puede cambiar de sentido, porque los tiristores solo conducen en uno; si la tensión media se invierte con la corriente positiva, la potencia media también cambia de signo y fluye de la carga a la red. El puente funciona como #strong[inversor conmutado por la red]: no inventa la frecuencia, que la pone la red, ni necesita apagar sus tiristores, que se apagan cuando la tensión de la red los polariza en inversa. Para que eso tenga sentido, en el lado de continua tiene que haber una fuente de energía: un motor de continua frenando con su fuerza contraelectromotriz invertida, o los paneles de una instalación antigua. Es el funcionamiento en dos cuadrantes (tensión de ambos signos, corriente de uno), y para el motor que tiene que frenar en los dos sentidos se usan dos puentes en antiparalelo. El ángulo no puede llegar a 180°: el tiristor saliente necesita un tiempo con tensión inversa para recuperar el bloqueo, y si no lo tiene vuelve a conducir y cortocircuita la red a través de la carga. En la práctica se limita a unos 150°.

#comprobacion[
  #strong[Comprobación con ngspice] del puente de 230 V con tiristores (modelados con una caída de 1,3 a 2 V según la corriente) y 50 µH de inductancia de red. Con α = 45°: carga de 100 Ω, V#sub[d] = 174,9 V (176,7 V calculados); carga de 10 Ω y 2 H, 142,3 V (146,4 V) y un factor de potencia de 0,636 (0,637 calculado más abajo). Con α = 120° y una fuerza electromotriz en la carga que mantiene 10 A, V#sub[d] = −107,1 V (−103,5 V calculados más las caídas de los tiristores) y el puente devuelve 1 008 W a la red.
]

#figura("rectificador-monofasico.svg", 100%, [El puente monofásico totalmente controlado. Arriba a la derecha, la tensión media frente al ángulo de disparo con carga resistiva y con carga muy inductiva; por encima de 90°, con carga inductiva y una fuente en la carga, el puente devuelve energía a la red. Abajo, las formas de onda con α = 45° simuladas con ngspice: con carga resistiva la corriente de red sigue a la tensión a trozos; con carga inductiva es cuadrada, desplazada 45° respecto a la tensión, y la salida incluye tramos negativos.]) <fig-new-33-rect-mono>

=== El factor de potencia del rectificador controlado

Con carga muy inductiva, la corriente que toma el puente de la red es una onda cuadrada de amplitud I#sub[d] (figura #nr("fig-new-33-rect-mono")), centrada no en el pico de la tensión sino α grados después. Los dos factores del factor de potencia de la sección #nr("sec-24.5") salen de esa forma:

#ec[$ "FP" = underbrace((2 sqrt("2"))/(π), "distorsión" = "0,900") dot.op underbrace(cos α, "desplazamiento") $]

La distorsión es la de la onda cuadrada: su fundamental es el 90 % de su valor eficaz. El desplazamiento es el retraso del disparo. Y ahí está el precio del control por fase: #strong[cuanto más se baja la tensión, peor es el factor de potencia]. Un motor de 180 V alimentado con el puente desde 230 V pide α = 29,6° y trabaja con FP = 0,9 × 180/207,1 = 0,783; a media tensión, con α = 60°, el factor de potencia es 0,45. La red ve una carga que consume potencia reactiva, como un motor de inducción descargado, además de los armónicos de la onda cuadrada.

=== El puente trifásico de seis pulsos

Con tres fases, el puente lleva seis tiristores: tres en la parte superior, con los cátodos unidos al positivo de salida, y tres en la inferior (figura #nr("fig-new-33-seis-pulsos")). Con diodos, en cada instante conduce el diodo superior de la fase más positiva y el inferior de la más negativa, y la salida es la envolvente de las seis tensiones de línea: seis casquetes de senoide por ciclo, cada uno de 60°. Los tiristores retrasan cada cambio de pareja el mismo ángulo α, contado desde el instante en que conmutarían los diodos, y la tensión media es:

#ec[$ V_("d") = (3 sqrt("2"))/(π) dot.op V_("LL") dot.op cos α = "1,35" dot.op V_("LL") dot.op cos α $]

donde V#sub[LL] es la tensión eficaz de línea. Con la red de 400 V, 540,2 V con α = 0, 467,8 V con α = 30° y 270,1 V con α = 60°. Un motor de continua de 440 V se alimenta con α = 35,5°.

#strong[El rizado, con diodos.] Cada casquete va del pico de la tensión de línea, 400·√2 = 565,7 V, a ese pico por cos 30°, 489,9 V: 75,8 V de pico a pico a 300 Hz, seis veces la frecuencia de red. Su valor eficaz es el 4,2 % de la media; el de un puente monofásico de onda completa sin condensador es el 48,3 %, once veces más, y a 100 Hz. De ahí que el puente de seis pulsos necesite un filtro mucho menor, y que el condensador del bus de un variador esté más para absorber las corrientes de conmutación del inversor que para alisar la red. Con ese condensador, el bus se acerca al pico, 565,7 V, cuanto menor es la carga, y se queda cerca de los 540 V con la carga nominal: los dos números que se usaron para el inversor trifásico.

#strong[Los armónicos de la corriente de red.] Con carga muy inductiva, cada fase toma bloques de corriente de 120°, +I#sub[d] y −I#sub[d], separados por 60° sin corriente (figura #nr("fig-new-33-seis-pulsos")). Su valor eficaz es √(2/3)·I#sub[d] = 0,816·I#sub[d] y su fundamental, (√6/π)·I#sub[d] = 0,780·I#sub[d]:

#ec[$ "FP" = (3)/(π) dot.op cos α = "0,955" dot.op cos α $]

La distorsión es menor que en monofásica (0,955 frente a 0,900), y los armónicos que quedan son solo los de orden 6k ± 1: el 5.º, el 7.º, el 11.º, el 13.º…, con amplitudes I#sub[1]/n (20 %, 14,3 %, 9,1 %, 7,7 %) y un THD de corriente del 31,1 %. No hay tercer armónico ni múltiplos de tres, y por eso el puente se conecta a tres hilos, sin neutro: compárese con los rectificadores monofásicos de la sección #nr("sec-new-24-trifasica"), cuyos terceros armónicos se suman en el neutro. Aun así, el 5.º y el 7.º son lo bastante grandes para que la norma EN 61000-3-12 (equipos de 16 a 75 A por fase) obligue a muchos variadores a llevar una bobina de entrada o de bus que los reduzca. En potencias grandes se usan #strong[puentes de doce pulsos]: dos puentes de seis alimentados por un transformador con un secundario en estrella y otro en triángulo, desfasados 30°, con los que el 5.º y el 7.º se cancelan y el primer armónico pasa a ser el 11.º.

#strong[La conmutación no es instantánea.] Todo lo anterior supone que la corriente pasa de un tiristor al siguiente de golpe. La red tiene inductancia (la del transformador de distribución y la de los cables, L#sub[s] por fase), y la corriente tarda un ángulo μ, el #strong[ángulo de solapamiento], en pasar de una fase a otra. Durante ese tiempo conducen tres tiristores, dos fases quedan en cortocircuito a través de L#sub[s], y la tensión de salida es la media de las dos. Se pierde un trozo de cada casquete, y la tensión media baja:

#ec[$ Delta V_("d") = (3 dot.op ω dot.op L_("s"))/(π) dot.op I_("d") $]

No es una pérdida de energía: es una caída sin resistencia, como la de una impedancia de salida. Con L#sub[s] = 1 mH, I#sub[d] = 30 A y α = 30°, ΔV#sub[d] = 9,0 V y μ = 3,6°. Lo que sí molesta son las #strong[muescas] que el solapamiento abre en la tensión de la red, seis por ciclo, que ven todos los demás equipos conectados al mismo punto. Las bobinas de entrada de los variadores también sirven para eso: ponen la mayor parte de L#sub[s] del lado del convertidor, y la muesca queda en sus bornes y no en los de los vecinos.

#comprobacion[
  #strong[Comprobación con ngspice] del puente de seis pulsos en la red de 400 V. Con diodos y 54 Ω de carga, la salida va de 487,6 a 563,2 V (75,7 V de rizado) con 537,7 V de media (540,2 V menos dos caídas de diodo). Con tiristores, α = 30° y unos 30 A en la carga, V#sub[d] = 461,9 V con la red casi ideal y 453,5 V con L#sub[s] = 1 mH: 8,4 V menos, frente a los 8,8 V que da la fórmula entre los dos casos. El solapamiento medido es de 3,6°. Los armónicos de la corriente de fase son el 20,7 %, el 13,3 %, el 8,9 % y el 7,1 % de la fundamental para el 5.º, 7.º, 11.º y 13.º, algo por debajo de 1/n porque el solapamiento redondea los flancos de los bloques; el tercero es nulo.
]

#figura("rectificador-seis-pulsos.svg", 100%, [El puente trifásico de seis pulsos, simulado con ngspice en la red de 400 V. Arriba, con diodos: la salida es la envolvente de las tensiones de línea, con seis casquetes por ciclo y 76 V de rizado alrededor de 538 V. Abajo a la izquierda, con tiristores y α = 30°: con 1 mH de inductancia de red aparecen las muescas del solapamiento y la tensión media baja. Abajo a la derecha, la corriente de una fase: bloques de 120° cuyo espectro contiene el 5.º, el 7.º, el 11.º y el 13.º armónicos, cerca de 1/n, y ningún múltiplo de tres.]) <fig-new-33-seis-pulsos>

=== El disparo y lo que se hace hoy

El circuito de disparo tiene que sincronizarse con la red, porque α se cuenta desde un paso por cero o desde un cruce de tensiones de línea, y aislar la puerta de cada tiristor, cuyo cátodo está a la tensión de la red o del bus. La forma clásica de hacerlo es analógica: una rampa o una senoide sincronizada con la red y un comparador con la tensión de control. Si se compara con una senoide, α = arccos(v#sub[c]/V#sub[m]), la tensión de salida queda proporcional a la tensión de control y el puente se convierte en un amplificador lineal de potencia, que es lo que necesita un lazo de control. La puerta se ataca con un transformador de impulsos y, con carga inductiva, con un tren de impulsos o un impulso largo, no con uno corto: la corriente de ánodo tarda en subir y tiene que superar la corriente de enclavamiento (sección #nr("sec-10.1")) antes de que se retire la señal de puerta. Hoy el ángulo lo suele contar un microcontrolador desde la detección del paso por cero, como en el regulador con optotriac de la sección #nr("sec-10.1").

¿Y lo que se hace hoy en lugar de todo esto? Un #strong[rectificador activo], que es un inversor trifásico como el de la sección #nr("sec-new-33-inversor") funcionando al revés, con bobinas hacia la red: absorbe corriente senoidal, con factor de potencia unitario a cualquier tensión de bus, y devuelve energía a la red cuando el motor frena, sin el tope de los 150°. Es lo que llevan los variadores regenerativos, los inversores fotovoltaicos y los cargadores rápidos. El precio son seis transistores con sus drivers y un control mucho más elaborado que seis tiristores con un circuito de disparo.

=== En el banco

- #strong[Contar los casquetes.] Con sonda diferencial en la salida de un puente de seis pulsos, se cuentan seis casquetes iguales por cada 20 ms. Si uno de los seis diodos o tiristores está abierto, desaparecen dos casquetes de cada seis y el rizado pasa a tener una componente de 50 Hz muy visible: es la avería más típica de la entrada de un variador, y se ve antes en el rizado que en la tensión media.
- #strong[El ángulo de disparo] se mide con dos canales: la tensión de red (con sonda diferencial o desde un transformador pequeño) y la salida. El retraso de cada salto respecto al punto en que conmutaría un diodo es α, y debe ser el mismo en los seis.
- #strong[Las muescas] del solapamiento se ven en la tensión de red con el puente cargado. Su anchura, medida en grados, es μ, y con la fórmula de ΔV#sub[d] da una estimación de la inductancia de la red en ese punto.
- #strong[La corriente de entrada] con una pinza y la FFT (sección #nr("sec-21.13")): el 5.º y el 7.º armónicos deben andar por el 20 % y el 14 % de la fundamental con una bobina de alisado grande, y bastante más con un condensador de bus sin bobina, que estrecha los bloques en pulsos.

// ============================================================================================ PARTE 2
=== Problema #nr("prob-33.D") — Un inversor de 500 W para una carga resistiva <prob-33.D>

#strong[Enunciado]

Diseñar un inversor monofásico que alimente una carga resistiva de #strong[500 W] con #strong[230 V y 50 Hz], a partir del bus de #strong[400 V] que da un PFC (sección #nr("sec-33.8")), con una distorsión armónica de la tensión de salida inferior al #strong[3 %].

#strong[Se pide:] elegir la modulación y la frecuencia; dimensionar los interruptores, el filtro y el condensador del bus; elegir el tiempo muerto y estimar su efecto; y comprobarlo todo con una simulación.

#strong[Verificación]

#strong[Modulación.] PWM senoidal unipolar a 20 kHz, por encima de lo audible, con m#sub[f] = 400 y el primer grupo de armónicos en 40 kHz (sección #nr("sec-new-33-inversor")). La carga es de 230²/500 = 105,8 Ω y toma 2,17 A eficaces, 3,07 A de pico. El índice de modulación ideal es m#sub[a] = 325,3/400 = 0,813, con margen suficiente hasta 1 para las caídas internas y las bajadas del bus.

#strong[Interruptores.] Soportan el bus, 400 V, más las sobretensiones de conmutación: MOSFET de 600 o 650 V (con IGBT, 20 kHz ya obliga a uno rápido, y a esta corriente la caída fija de 2 V de un IGBT pesa más que la resistencia de un MOSFET, sección #nr("sec-10.2")). La corriente de pico es la de la carga más medio rizado de la bobina en ese punto, 3,07 + 0,69/2 = 3,42 A, y la eficaz por interruptor, unos 2,17/√2 = 1,54 A. Con 0,15 Ω de resistencia en caliente, las cuatro conducciones suman 4 × 1,54² × 0,15 = 1,4 W; con las pérdidas de conmutación del mismo orden, un disipador pequeño basta.

#strong[Filtro.] El del ejemplo de la sección #nr("sec-new-33-inversor"): L = 2,2 mH, con un rizado máximo de 1,14 A (sin saturar con 3,42 A de pico), y C = 3,3 µF de polipropileno para tensión alterna, con f#sub[0] = 1 868 Hz y 53 dB de atenuación a 40 kHz. El condensador lleva el rizado de la bobina, hasta 1,14/(2·√3) = 0,33 A eficaces a 40 kHz, más 0,24 A a 50 Hz: hay que comprobar su corriente admisible, no solo su tensión.

#strong[El condensador del bus.] Aquí está la sorpresa del problema. La potencia instantánea de una carga monofásica pulsa al doble de la frecuencia de red (sección #nr("sec-24.5")): entre 0 y 1 000 W, cien veces por segundo, alrededor de los 500 W medios. El bus entrega una corriente continua de 500/400 = 1,25 A más una componente de 100 Hz de la misma amplitud, y esa componente, si el PFC no la da, sale del condensador:

#ec[$ Delta V_("pp") = (P)/(ω dot.op C_("bus") dot.op V_("dc")) quad quad I_("C,100 Hz") = (P)/(sqrt("2") dot.op V_("dc")) $]

Con 470 µF, ΔV#sub[pp] = 500/(314,2 × 470 µF × 400) = 8,5 V (el 2,1 % del bus), y por el condensador circulan 0,88 A eficaces a 100 Hz, que es lo que fija su tamaño: un electrolítico de 470 µF y 450 V con al menos 1 A de corriente de rizado admisible. Para bajar al 1 % harían falta 995 µF. En un inversor monofásico, el condensador del bus se elige por esa corriente, no por el rizado de conmutación.

#strong[Tiempo muerto.] Con MOSFET bastan 0,5 µs, el 1 % del periodo: un error de 4 V por rama y 8 V en el puente, que según el cálculo simple resta 10,2 V de pico a la fundamental y añade un tercer armónico de hasta el 1,0 %. Para compensar la caída, el índice sube a m#sub[a] = 0,835.

#strong[La simulación.] El inversor completo en ngspice (interruptores de 0,1 Ω con su diodo, puerta con tiempo muerto de 0,5 µs y el filtro LC con 0,1 Ω de resistencia en la bobina), con m#sub[a] = 0,8126 (figura #nr("fig-new-33-problema")):

#tabla(none, columns: 3, align: (left, right, right,),
  [Magnitud], [Cálculo], [ngspice],
  [Tensión de salida, sin tiempo muerto], [230,2 V], [229,3 V],
  [Tensión de salida, con 0,5 µs], [≈ 223,0 V], [223,9 V],
  [THD de la salida, con 0,5 µs], [≤ 1,0 % (3.er armónico)], [0,83 %],
  [Rizado de la bobina, máximo], [1,14 A], [1,17 A],
  [Rizado de la bobina, en el pico], [0,69 A], [0,73 A],
  [Corriente de pico de la bobina], [3,42 A], [3,42 A],
  [Rizado de alta frecuencia en la salida], [0,30 V], [0,30 V],
  [Componente de 100 Hz de la corriente del bus], [1,18 A de pico (474 W)], [1,21 A de pico],
)

La salida queda con el 0,83 % de THD, muy por debajo del 3 % pedido, y casi todo es tercer armónico del tiempo muerto: el filtro hace su trabajo con la alta frecuencia. Los 6,1 V que faltan para 230 V son las caídas en los interruptores y en la bobina más el tiempo muerto, y se recuperan con m#sub[a] = 0,835. En la práctica, un lazo de tensión los corrige solo y además compensa las variaciones del bus.

#strong[En el banco]

- #strong[Arrancar con el bus bajo]: 40 V de una fuente de laboratorio con límite de corriente, la carga de 105,8 Ω y, a la salida, una senoide de 33 V de pico. Luego, en escalones, hasta los 400 V.
- #strong[Mirar la corriente de la bobina] con una sonda de corriente: el rizado triangular de 40 kHz, de 1,1 A en los cruces por la mitad del bus y de 0,7 A en el pico, confirma la bobina y que no satura (si satura, el triángulo se vuelve picudo en el pico de la senoide).
- #strong[Medir el rizado de 100 Hz del bus] con acoplamiento en alterna: unos 8,5 V de pico a pico con 470 µF. Si es mucho mayor, el condensador ha perdido capacidad, y es lo primero que envejece en un inversor.

#strong[Resultado:] PWM unipolar a 20 kHz con m#sub[a] ≈ 0,835; cuatro MOSFET de 650 V; L = 2,2 mH (I#sub[sat] ≥ 4 A), C = 3,3 µF de polipropileno; bus de 470 µF y 450 V con al menos 1 A de rizado a 100 Hz; tiempo muerto de 0,5 µs. Salida de 230 V con un THD inferior al 1 %.

#figura("inversor-problema.svg", 100%, [El inversor del problema #nr("prob-33.D") simulado con ngspice, con 0,5 µs de tiempo muerto. A la izquierda, la tensión de salida y la corriente de la bobina durante un ciclo; a la derecha, el rizado de la corriente alrededor del pico, con su triángulo de 40 kHz.]) <fig-new-33-problema>

// ============================================================================================ PARTE 3
#ejercicios[
  #ejercicio[
    Un inversor de onda cuadrada se alimenta de una batería de 48 V. Calcula el valor eficaz de la fundamental y de los armónicos tercero y quinto de su salida. ¿Qué relación de transformación necesitaría un transformador para dar 230 V de fundamental?
  ] <ej-33.9>

  #ejercicio[
    Un inversor monofásico con PWM senoidal tiene un bus de 400 V. ¿Qué índice de modulación necesita para dar 230 V eficaces? Si el diseño no debe pasar de m#sub[a] = 0,95, ¿cuál es la tensión mínima del bus con la que sigue dando 230 V?
  ] <ej-33.10>

  #ejercicio[
    Un inversor conmuta a 16 kHz y da 50 Hz. ¿Cuánto vale m#sub[f]? ¿A qué frecuencia está el primer grupo de armónicos con modulación bipolar y con unipolar? Con la unipolar, ¿qué frecuencia de corte debe tener el filtro LC para atenuar 60 dB ese grupo, y qué condensador hace falta con una bobina de 3 mH?
  ] <ej-33.11>

  #ejercicio[
    Un variador tiene un bus de 560 V. ¿Qué tensión de línea eficaz máxima puede dar sin sobremodular con PWM senoidal, y cuál con modulación vectorial? ¿Puede alimentar un motor de 400 V a su tensión nominal?
  ] <ej-33.12>

  #ejercicio[
    En un inversor con modulación vectorial, el bus es de 600 V, el periodo de conmutación 125 µs y el vector de referencia tiene 300 V de amplitud y está a 45° dentro de su sector. Calcula T#sub[1], T#sub[2] y T#sub[0]. ¿Cuál es la amplitud máxima del vector de referencia en la zona lineal?
  ] <ej-33.13>

  #ejercicio[
    Un inversor trifásico con IGBT conmuta a 8 kHz con un bus de 560 V y un tiempo muerto de 2 µs. Calcula el error medio de tensión por rama. ¿Por qué ese error importa mucho más cuando el motor gira despacio que a su velocidad nominal?
  ] <ej-33.14>

  #ejercicio[
    Un puente monofásico totalmente controlado, conectado a 230 V, alimenta el inducido de un motor de continua con una bobina de alisado grande. ¿Qué ángulo de disparo da 150 V? ¿Cuál es el factor de potencia en la red? ¿Qué tensión media da con α = 120°, y qué tiene que estar haciendo el motor para que el puente trabaje así?
  ] <ej-33.15>

  #ejercicio[
    Un puente trifásico de seis tiristores, conectado a la red de 400 V, alimenta una carga muy inductiva con I#sub[d] = 100 A y α = 45°. Calcula la tensión media, la potencia, el factor de potencia y las corrientes eficaces de la fundamental y de los armónicos quinto y séptimo de la red. Repite el cálculo de la tensión media si la red tiene 0,3 mH de inductancia por fase y α = 30°.
  ] <ej-33.16>
]

// ============================================================================================ PARTE 4
#soluciones[
  #solucion("ej-33.9")[
    La fundamental de una onda cuadrada de amplitud V#sub[dc] vale 4·V#sub[dc]/π de pico, es decir, 0,900·V#sub[dc] eficaces: 0,900 × 48 = 43,2 V. Los armónicos caen como 1/n: el tercero, 43,2/3 = 14,4 V, y el quinto, 43,2/5 = 8,6 V. Para dar 230 V de fundamental, el transformador necesita una relación 230/43,2 = 5,3. Los armónicos se transforman con la misma relación (el tercero, 76,7 V a la salida), y el THD sigue siendo del 48,3 %: el transformador eleva la tensión pero no limpia la onda.
  ]

  #solucion("ej-33.10")[
    En la zona lineal, el pico de la fundamental es m#sub[a]·V#sub[dc]. Para 230 V eficaces (325,3 V de pico): m#sub[a] = 325,3/400 = 0,813. Con m#sub[a] = 0,95, el bus mínimo es 325,3/0,95 = 342,4 V. Por debajo, el inversor tendría que sobremodular, con la distorsión que eso supone, o dar menos tensión. Ese margen entre 342 y 400 V es el que cubre las bajadas del bus en un escalón de carga.
  ]

  #solucion("ej-33.11")[
    m#sub[f] = 16 000/50 = 320. Con modulación bipolar, el primer grupo está en m#sub[f]: 16 kHz. Con unipolar se cancela y el primero está en 2·m#sub[f]: 32 kHz. Para 60 dB a 32 kHz con una pendiente de 40 dB por década, (32 kHz/f#sub[0])² = 1 000, y f#sub[0] = 32 000/√1 000 = 1 012 Hz. Con L = 3 mH: C = 1/((2π·1 012)² × 3 mH) = 8,2 µF. La frecuencia de corte queda 20 veces por encima de 50 Hz, así que el filtro no toca la fundamental.
  ]

  #solucion("ej-33.12")[
    Con PWM senoidal, la tensión de línea eficaz máxima es 0,612·V#sub[dc] = 0,612 × 560 = 342,9 V. Con modulación vectorial (o secuencia cero), 0,707·V#sub[dc] = 396,0 V. Con PWM senoidal, el motor de 400 V recibiría el 86 % de su tensión y daría menos par en la zona alta de velocidad; con modulación vectorial se queda a un 1 % de la nominal, y el poco que falta se cubre con una ligera sobremodulación.
  ]

  #solucion("ej-33.13")[
    V#sub[ref]/V#sub[dc] = 300/600 = 0,5. T#sub[1] = √3 × 125 µs × 0,5 × sen(60° − 45°) = 108,25 × 0,2588 = 28,0 µs. T#sub[2] = √3 × 125 µs × 0,5 × sen 45° = 108,25 × 0,7071 = 76,5 µs. T#sub[0] = 125 − 28,0 − 76,5 = 20,4 µs, repartido entre los estados 000 y 111. A 45° el vector está más cerca de V#sub[2] que de V#sub[1], y por eso T#sub[2] es mayor. La amplitud máxima en la zona lineal es V#sub[dc]/√3 = 346,4 V.
  ]

  #solucion("ej-33.14")[
    El error por rama es t#sub[d]·f#sub[sw]·V#sub[dc] = 2 µs × 8 kHz × 560 V = 8,96 V: el tiempo muerto es el 1,6 % del periodo, y ese 1,6 % del bus se pierde o se gana según el signo de la corriente. El error no depende de la tensión que se esté generando. A la tensión nominal (326,6 V de pico de fase) es un 2,7 %; con la ley V/f, a 5 Hz la tensión de fase es la décima parte y el mismo error es un 27 % de ella. De ahí la distorsión de corriente y el rizado de par a baja velocidad, y la importancia de compensar el tiempo muerto en los variadores.
  ]

  #solucion("ej-33.15")[
    Con carga muy inductiva, V#sub[d] = 0,900·V·cos α = 207,1·cos α. Para 150 V: cos α = 150/207,1 = 0,724 y α = 43,6°. El factor de potencia es 0,900·cos α = 0,900 × 0,724 = 0,652. Con α = 120°, V#sub[d] = 207,1 × (−0,5) = −103,5 V. Como la corriente no puede invertirse, la potencia sale del motor y va a la red, y para eso el motor tiene que actuar como generador con su fuerza contraelectromotriz invertida, por ejemplo frenando una carga que lo arrastra (un ascensor que baja).
  ]

  #solucion("ej-33.16")[
    V#sub[d] = 1,35 × 400 × cos 45° = 382,0 V, y la potencia en la carga, 382,0 × 100 = 38,2 kW. FP = 0,955 × cos 45° = 0,675. Fundamental de la corriente de red: 0,780 × 100 = 78,0 A; quinto armónico, 78,0/5 = 15,6 A; séptimo, 78,0/7 = 11,1 A. Comprobación: la potencia aparente es √3 × 400 × 0,816 × 100 = 56,6 kVA, y 38,2/56,6 = 0,675. Con L#sub[s] = 0,3 mH y α = 30°: el ideal sería 1,35 × 400 × cos 30° = 467,8 V, y el solapamiento resta 3 × 314,2 × 0,3 mH × 100/π = 9,0 V, quedando 458,8 V. (El ángulo de solapamiento es de 3,6°: el mismo que con 1 mH y 30 A, porque solo depende del producto L#sub[s]·I#sub[d].)
  ]
]

// ============================================================================================ PARTE 5
// Five formulas for the chapter's #tarjeta (end of its list):
#tarjeta[
  #formula($ hat(V)_("1") = m_("a") dot.op V_("dc") quad quad V_("LL,ef") = "0,612" dot.op m_("a") dot.op V_("dc") quad ("SVPWM: " "0,707" dot.op V_("dc")) $)

  #formula($ Delta I_("máx") = (V_("dc"))/("8" dot.op L dot.op f_("sw")) quad "(PWM unipolar)" $)

  #formula($ Delta V = t_("d") dot.op f_("sw") dot.op V_("dc") quad "(por rama)" $)

  #formula($ V_("d") = "0,900" dot.op V dot.op cos α quad quad V_("d") = "1,35" dot.op V_("LL") dot.op cos α $)

  #formula($ Delta V_("d") = (3 dot.op ω dot.op L_("s"))/(π) dot.op I_("d") quad quad "FP" = "0,955" dot.op cos α $)
]
