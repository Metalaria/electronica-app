// P05 — «Análisis y compensación clásicos del lazo de control»: three new sections of chapter 30 (cap31.typ), after
// 30.9 «Estabilidad del Lazo de Control: Margen de Fase y de Ganancia», for «Electrónica Práctica Avanzada».
// Five parts, each to be pasted in its own place (see NOTAS.md):
//   PARTE 1  the three sections: after the end of 30.9 (after its figure <fig-31.18>) and before
//            «== Multiplexación: Compartir el Medio <sec-31.10>», which becomes 30.13.
//   PARTE 2  problem 30.D: at the end of «Problemas de Diseño» (now 30.17), after problem 30.C and before #ejercicios.
//   PARTE 3  nine exercises: inside the chapter's #ejercicios[…], after the exercise labelled <ej-31.8>.
//   PARTE 4  their solutions: inside #soluciones[…], after #solucion("ej-31.8")[…].
//   PARTE 5  (comments only) proposals for the chapter's summary, formula card and key terms (paratexto).
// Numbers: sections 30.10-30.12 (the old 30.10-30.14 become 30.13-30.17); figures 30.19-30.24 (the old 30.19-30.22
// become 30.25-30.28); exercises 30.9-30.17; problem 30.D. Every number comes from scripts/calculos.py and every
// simulated value from the ngspice runs (scripts/spice_comprobar.py).

// ============================================================================================ PARTE 1
== Respuesta Temporal y Error en Régimen Permanente <sec-new-31-respuesta>

La sección #nr("sec-31.2") enumeró los criterios con que se juzga un lazo y la #nr("sec-31.9") los relacionó con el margen de fase mediante una regla aproximada. Esta sección los convierte en números que se pueden pedir y comprobar: qué polos dan un 10 % de sobreimpulso y medio segundo de establecimiento, y qué estructura necesita el lazo para seguir una consigna sin error.

=== El sistema de segundo orden de referencia

Muchos lazos reales se comportan como este: un integrador y un polo en lazo abierto (un motor gobernado en posición, una planta de primer orden con un PI y un filtro), que en lazo cerrado dan dos polos:

#ec[$ L(s) = (ω_"n"^2)/(s dot.op (s + 2 ζ ω_"n")) quad arrow.r.double quad T(s) = (L(s))/(1 + L(s)) = (ω_"n"^2)/(s^2 + 2 ζ ω_"n" s + ω_"n"^2) $]

con la frecuencia natural ω#sub[n] y el factor de amortiguamiento ζ de la sección #nr("sec-24.3"). Si ζ < 1, los polos son complejos conjugados:

#ec[$ s = -σ plus.minus j ω_"d" quad quad σ = ζ ω_"n" quad quad ω_"d" = ω_"n" sqrt(1 - ζ^2) $]

En el plano s (figura #nr("fig-new-31-segundo-orden")), σ fija lo deprisa que decae la envolvente, ω#sub[d] la frecuencia a la que oscila, la distancia al origen es ω#sub[n] y el ángulo θ con el semieje real negativo cumple cos θ = ζ.

=== Las cuatro especificaciones

Ante un escalón unitario, de la senoide amortiguada salen las cuatro medidas de una especificación:

#ec[$ M_"p" = e^(- π ζ \/ sqrt(1 - ζ^2)) quad quad t_"p" = π/(ω_"d") quad quad t_"s" approx 4/σ quad quad t_"r" approx ("1,8")/(ω_"n") $]

El #strong[sobreimpulso] M#sub[p] solo depende de ζ (es la fórmula que la sección #nr("sec-24.3") dio sin deducir); el #strong[tiempo de pico] t#sub[p] es medio periodo de la oscilación; el #strong[tiempo de establecimiento] t#sub[s], hasta quedar dentro de ±2 % del valor final, solo depende de σ (con ±5 %, 3/σ). El #strong[tiempo de subida] t#sub[r], del 10 % al 90 %, no tiene fórmula cerrada: 1,8/ω#sub[n] acierta con menos de un 10 % de error entre ζ = 0,5 y 0,6.

#deduccion[Las especificaciones del segundo orden y su margen de fase][
  #eclabel[#strong[Ec. 1 — Respuesta al escalón]]
  #ec[$ y(t) = 1 - e^(- σ t)/(sqrt(1 - ζ^2)) dot.op sin(ω_"d" t + θ) quad quad θ = arccos ζ $]

  #strong[Origen.] Y(s) = T(s)/s; con fracciones simples, completando s² + 2ζω#sub[n]s + ω#sub[n]² = (s + σ)² + ω#sub[d]², y la tabla de pares de la sección #nr("sec-0.10").

  #eclabel[#strong[Ec. 2 — Tiempo de pico y sobreimpulso]]
  #ec[$ (d y)/(d t) = (ω_"n")/(sqrt(1 - ζ^2)) dot.op e^(- σ t) dot.op sin(ω_"d" t) = 0 quad arrow.r.double quad t_"p" = π/(ω_"d") , quad y(t_"p") = 1 + e^(- σ π \/ ω_"d") $]

  #strong[Origen.] La derivada (la respuesta al impulso) se anula por primera vez en ω#sub[d]·t = π. El exceso sobre 1 es e#super[−σπ/ω#sub[d]], y σ/ω#sub[d] = ζ/√(1 − ζ²).

  #eclabel[#strong[Ec. 3 — Tiempo de establecimiento]]
  #ec[$ e^(- σ t_"s")/(sqrt(1 - ζ^2)) = "0,02" quad arrow.r.double quad t_"s" = (ln(50 \/ sqrt(1 - ζ^2)))/(σ) approx 4/σ $]

  #strong[Origen.] La respuesta está entre las envolventes 1 ± e#super[−σt]/√(1 − ζ²); cuando estas entran en la banda del 2 %, la respuesta ya no sale. ln 50 = 3,91, y con ζ = 0,6 el logaritmo vale 4,1: de ahí el 4. Es una cota: la respuesta puede entrar antes, en un valle, y por eso el valor exacto salta al variar ζ.

  #eclabel[#strong[Ec. 4 — Margen de fase del lazo de referencia]]
  #ec[$ ω_"c" = ω_"n" sqrt(sqrt(1 + 4 ζ^4) - 2 ζ^2) quad quad "MF" = arctan((2 ζ ω_"n")/(ω_"c")) $]

  #strong[Origen.] La fase de L(jω) es −90° − arctan(ω/2ζω#sub[n]), y |L(jω#sub[c])| = 1 es ω#sub[c]²·(ω#sub[c]² + 4ζ²ω#sub[n]²) = ω#sub[n]⁴, de segundo grado en ω#sub[c]².

  #strong[Dominio de validez.] Exacto para el lazo de referencia; en otro, en la medida en que sus polos dominantes se parezcan a estos.
]

La tabla da los valores exactos y permite juzgar las dos reglas de bolsillo, 4/ζ para ω#sub[n]·t#sub[s] y ζ ≈ MF/100:

#tabla(none, columns: 6, align: (left, right, right, right, right, right),
  [ζ], [M#sub[p]], [ω#sub[n]·t#sub[p]], [ω#sub[n]·t#sub[s] (exacto)], [4/ζ], [Margen de fase],
  [0,3], [37,2 %], [3,29], [11,2], [13,3], [33,3°],
  [0,4], [25,4 %], [3,43], [8,41], [10,0], [43,1°],
  [0,5], [16,3 %], [3,63], [8,08], [8,00], [51,8°],
  [0,6], [9,5 %], [3,93], [5,94], [6,67], [59,2°],
  [0,7], [4,6 %], [4,40], [5,98], [5,71], [65,2°],
  [0,8], [1,5 %], [5,24], [3,76], [5,00], [69,9°],
  [1,0], [0 %], [—], [5,83], [4,00], [76,3°],
)

La regla ζ ≈ MF/100 de la sección #nr("sec-31.9") se separa del valor exacto 3,3° como mucho hasta 60°, que es donde se usa; por encima falla, porque el margen del lazo de referencia nunca pasa de 76° (de ahí el «unos 76°» con sobreimpulso nulo de la sección #nr("sec-27.10")). Y 4/σ sobrestima hasta en un tercio: sirve para dimensionar.

#ejemplo[
  Se pide un sobreimpulso de 10 % como máximo y un tiempo de establecimiento al 2 % de 0,8 s como máximo. El primero exige ζ ≥ 0,591 (θ ≤ 53,8°); el segundo, σ ≥ 4/0,8 = 5 s#super[−1]. En el plano s, los polos deben quedar dentro de una cuña de ±53,8° alrededor del semieje real negativo y a la izquierda de la vertical s = −5: es la región sombreada de la figura #nr("fig-new-31-segundo-orden").

  Con ζ = 0,6 y σ = 5, en el borde: ω#sub[n] = 8,33 rad/s, ω#sub[d] = 6,67 rad/s y polos en −5 ± j6,67; M#sub[p] = 9,5 %, t#sub[p] = 0,471 s, t#sub[s] ≈ 0,8 s y t#sub[r] ≈ 0,216 s. El lazo de referencia tiene 59,2° de margen y cruza en 5,96 rad/s. Simulado en ngspice: 9,48 %, pico en 0,471 s y establecimiento en 0,713 s, mejor que la cota.
]

#figura("control-segundo-orden.svg", 100%, [A la izquierda, la respuesta al escalón del ejemplo (ζ = 0,6, ω#sub[n] = 8,33 rad/s), simulada con ngspice, con sus cuatro especificaciones y la banda del ±2 %. A la derecha, el plano s: la región que cumple M#sub[p] ≤ 10 % y t#sub[s] ≤ 0,8 s y los dos polos elegidos en su borde.]) <fig-new-31-segundo-orden>

=== Polos dominantes

Las fórmulas valen para un lazo con más polos si dos complejos, los #strong[dominantes], están mucho más cerca del eje imaginario que los demás. Sobre un par con ζ = 0,5 (16,3 % de sobreimpulso), un polo real añadido a cinco veces su parte real deja el sobreimpulso en el 14,8 %, y a dos veces lo baja al 8,1 %; un cero a cinco veces lo sube al 18,0 %, y a dos veces, al #strong[29,8 %]. Lo que esté a más de cinco veces se puede ignorar; lo que esté más cerca, no, y un cero cercano siempre aumenta el sobreimpulso, como se verá con el adelanto (sección #nr("sec-new-31-compensacion")). Y todo esto es lineal: si el actuador satura en el transitorio (sección #nr("sec-31.5")), la respuesta cambia, así que las especificaciones se comprueban con un escalón pequeño.

=== Tipo del sistema y error en régimen permanente

El otro criterio es el error al final, cuando el transitorio se ha extinguido. Con realimentación unitaria, el error es E(s) = R(s)/(1 + L(s)), y su valor final lo da el teorema del valor final, siempre que el lazo cerrado sea estable:

#ec[$ e_(infinity) = lim_(t arrow.r infinity) e(t) = lim_(s arrow.r 0) s dot.op E(s) = lim_(s arrow.r 0) (s dot.op R(s))/(1 + L(s)) $]

Decide cuántos integradores tiene L(s), el #strong[tipo] del sistema (0, 1 o 2), y con él y tres constantes de error el resultado se lee en una tabla:

#ec[$ K_"pos" = lim_(s arrow.r 0) L(s) quad quad K_"v" = lim_(s arrow.r 0) s dot.op L(s) quad quad K_"a" = lim_(s arrow.r 0) s^2 dot.op L(s) $]

#tabla(none, columns: 4, align: (left, right, right, right),
  [Tipo de L(s)], [Escalón de amplitud A], [Rampa de pendiente A], [Parábola A·t²/2],
  [0 (sin integrador)], [A/(1 + K#sub[pos])], [crece sin límite], [crece sin límite],
  [1 (un integrador)], [0], [A/K#sub[v]], [crece sin límite],
  [2 (dos integradores)], [0], [0], [A/K#sub[a]],
)

#deduccion[Las constantes de error][
  #eclabel[#strong[Ec. 5 — Error ante escalón, rampa y parábola]]
  #ec[$ R = A/s arrow.r e_(infinity) = A/(1 + K_"pos") quad quad R = A/s^2 arrow.r e_(infinity) = A/(K_"v") quad quad R = A/s^3 arrow.r e_(infinity) = A/(K_"a") $]

  #strong[Origen.] Con R(s) = A/s, s·E(s) = A/(1 + L(s)) → A/(1 + L(0)). Con la rampa, s·E(s) = A/(s + s·L(s)), cuyo denominador tiende a K#sub[v]\; con la parábola, a K#sub[a]. Cada integrador hace infinita una constante y finita la siguiente.

  #strong[Dominio de validez.] Solo si s·E(s) no tiene polos en el semiplano derecho ni en el eje imaginario: primero se comprueba la estabilidad (sección #nr("sec-new-31-estabilidad")).
]

El problema #nr("prob-31.B") es de tipo 0: la planta térmica de 0,8 °C/W con K#sub[p] = 5 W/°C tiene K#sub[pos] = 4 y deja un 1/(1 + 4) = 20 % de error. El PI la hace de tipo 1, y con T#sub[i] igual a la constante de tiempo de la planta, 120 s, su cero cancela el polo y queda L(s) = 5 × 0,8/(120·s) = 1/(30·s): lazo cerrado de primer orden de 30 s, sin error ante un escalón. Ante una rampa de 2 °C/min (0,0333 °C/s), K#sub[v] = 1/30 s#super[−1] y el error es #strong[1,0 °C]. Con solo proporcional crece sin límite: en ngspice va por 8,64 °C a los 20 minutos y sube 0,4 °C por minuto (figura #nr("fig-new-31-error")).

#nota[
  Muchos textos llaman K#sub[p] a la constante de error de posición; aquí K#sub[p] es la ganancia del PID (sección #nr("sec-31.3")) y la constante se escribe K#sub[pos]. K#sub[v] y K#sub[a] se miden en s#super[−1] y s#super[−2].
]

#figura("control-error.svg", 100%, [La planta térmica de 0,8 °C/W y 120 s, simulada con ngspice. A la izquierda, un escalón de 10 °C: con acción proporcional (tipo 0) queda un 20 % de error; con el PI (tipo 1), ninguno. A la derecha, una rampa de 2 °C/min: el PI la sigue con un retraso constante de 1,0 °C, y el proporcional se queda cada vez más atrás.]) <fig-new-31-error>

#importante[
  El tipo garantiza error nulo #strong[ante la consigna]. Ante una perturbación cuentan solo los integradores entre el error y el punto donde entra, los del controlador. Un servo de posición ya es de tipo 1 (la posición integra la velocidad) y con un proporcional sigue sin error un escalón de consigna, pero un par de carga constante le deja error: el integrador del motor está después del par. Hace falta el del controlador.
]

=== En el banco

Las cuatro especificaciones salen de una captura en disparo único (sección #nr("sec-21.9")): el sobreimpulso da ζ (despejando la Ec. 2, ζ = ln(1/M#sub[p])/√(π² + ln²(1/M#sub[p]))), el tiempo de pico ω#sub[d], y la tabla el margen. Si el establecimiento no cuadra con el ζ medido, hay un polo lento sin modelar. Y K#sub[v] se mide con una triangular lenta como consigna: el retraso en el tramo recto es A/K#sub[v], el «error de seguimiento» que limita la velocidad de una máquina que sigue trayectorias.

== Criterios de Estabilidad: Routh-Hurwitz y Nyquist <sec-new-31-estabilidad>

La sección #nr("sec-31.9") midió la estabilidad con márgenes del Bode, y la anterior supuso que el lazo cerrado era estable. Los dos criterios clásicos lo garantizan: el de #strong[Routh-Hurwitz], sobre el polinomio del lazo cerrado, da sin calcular raíces el intervalo de ganancias estables; el de #strong[Nyquist], sobre la respuesta en frecuencia del lazo abierto, fundamenta los márgenes.

=== Estabilidad absoluta: dónde están las raíces

Los polos del lazo cerrado son las raíces de 1 + L(s) = 0; con L(s) = N(s)/D(s), las del #strong[polinomio característico] D(s) + N(s), y el lazo es estable si todas tienen parte real negativa (sección #nr("sec-0.10")). Lo que se quiere saber no es dónde están, sino para qué ganancias están todas a la izquierda. Una condición necesaria se ve a simple vista: ningún coeficiente nulo ni de signo distinto. En primer y segundo grado también es suficiente; desde el tercero, no.

=== La tabla de Routh

El criterio (Edward Routh, 1877; Adolf Hurwitz, 1895, por otro camino) la completa con una tabla. Para a#sub[n]·s#super[n] + … + a#sub[0]:

+ La primera fila lleva los coeficientes a#sub[n], a#sub[n−2], a#sub[n−4]…; la segunda, a#sub[n−1], a#sub[n−3]…
+ Cada fila nueva sale de las dos anteriores, a#sub[1], a#sub[2]… y b#sub[1], b#sub[2]…: c#sub[1] = (b#sub[1]·a#sub[2] − a#sub[1]·b#sub[2])/b#sub[1], y así con las columnas siguientes, hasta la fila de s⁰.

#strong[El número de cambios de signo en la primera columna es el número de raíces en el semiplano derecho.] En tercer grado la tabla se resuelve de una vez:

#ec[$ s^3 + a_2 s^2 + a_1 s + a_0 quad "estable" quad arrow.l.r.double quad a_2, a_1, a_0 > 0 quad "y" quad a_2 dot.op a_1 > a_0 $]

=== El margen de una ganancia

Con el ejemplo de la sección #nr("sec-31.9"), polos en −1 y −3 y un tercero en −10 (el del sensor):

#ec[$ L(s) = K/((s + 1)(s + 3)(s + 10)) quad quad s^3 + 14 s^2 + 43 s + 30 + K = 0 $]

#tabla(none, columns: 4, align: (left, right, right, left),
  [Fila], [Primera columna], [Segunda columna], [Con K = 100],
  [s³], [1], [43], [1],
  [s²], [14], [30 + K], [14],
  [s¹], [(14 × 43 − 30 − K)/14], [—], [33,7],
  [s⁰], [30 + K], [—], [130],
)

Con K = 100 no hay cambios de signo: estable, con polos en −11,2 y −1,40 ± j3,11. La columna solo cambia en la fila de s¹, cuando 30 + K > 14 × 43 = 602: estable para #strong[0 < K < 572].

Con K = 572 la fila de s¹ se anula; la anterior forma el #strong[polinomio auxiliar], 14·s² + 602 = 0, s = ±j6,56 rad/s: oscilación sostenida con periodo de 0,958 s. Son K#sub[u] = 572 y T#sub[u] = 0,958 s, los números que Ziegler-Nichols busca subiendo la ganancia en la planta (sección #nr("sec-31.11")), obtenidos en el papel. Con K = 100 el margen de ganancia es 572/100 = 5,72 (15,1 dB), el mismo que da el Bode a 6,56 rad/s.

#comprobacion[
  En ngspice, con K = 572 el lazo oscila con periodo de 0,958 s y amplitud constante durante 15 s; con K = 560 se amortigua despacio; con K = 1000 crece: su primera columna, 1, 14, −30,6 y 1030, cambia dos veces de signo, y hay polos en 0,755 ± j8,11 (figura #nr("fig-new-31-routh")).
]

#figura("control-routh.svg", 100%, [El lazo K/((s + 1)(s + 3)(s + 10)). A la izquierda, su lugar de las raíces: las dos ramas complejas cruzan el eje imaginario en ±j6,56 con K = 572, el límite que da la tabla de Routh. A la derecha, la respuesta al escalón simulada con ngspice para K = 100 (estable), 572 (oscilación sostenida, periodo de 0,958 s) y 1000 (inestable).]) <fig-new-31-routh>

=== Casos especiales y estabilidad relativa

- #strong[Un cero en la primera columna] (con el resto de la fila no nulo): se sustituye por un ε > 0 pequeño. Con s⁴ + s³ + 3s² + 3s + 2, la fila de s² empieza por 0; con ε, la de s¹ vale 3 − 2/ε, muy negativa, y hay dos cambios de signo: dos raíces a la derecha, 0,130 ± j1,589.
- #strong[Una fila entera de ceros]: hay raíces simétricas respecto al origen, que da el polinomio auxiliar; su derivada sustituye a la fila nula.

Con s = z − σ#sub[0], la tabla cuenta las raíces a la derecha de −σ#sub[0]. Con K = 100 y σ#sub[0] = 1 sale z³ + 11z² + 18z + 100, estable (198 > 100); con σ#sub[0] = 1,5, z³ + 9,5z² + 7,75z + 93,6, que no lo es (73,6 < 93,6): los polos dominantes tienen su parte real entre −1,5 y −1 (es −1,40), y el establecimiento queda acotado sin calcular raíces. Lo que Routh no trata es el retardo, e#super[−sT], que no es un polinomio (salvo aproximado por Padé, (1 − sT/2)/(1 + sT/2)).

=== El criterio de Nyquist

Harry Nyquist lo publicó en 1932, al estudiar los amplificadores realimentados de la telefonía. Se traza L(jω) en el plano complejo para ω de −∞ a +∞ (la mitad negativa es la simétrica respecto al eje real): es el #strong[diagrama de Nyquist], y el criterio dice:

#ec[$ Z = N + P $]

con P los polos de L(s) en el semiplano derecho, N las vueltas horarias de la curva alrededor del −1 (negativas si son antihorarias) y Z los polos del lazo cerrado en el semiplano derecho. Con lazo abierto estable (P = 0): #strong[el lazo cerrado es estable si la curva no rodea el punto −1].

#deduccion[El criterio de Nyquist][
  #eclabel[#strong[Ec. 6 — Principio del argumento]]
  #ec[$ N_(F) = Z - P quad quad F(s) = 1 + L(s) $]

  #strong[Origen.] Si s recorre en sentido horario un contorno cerrado, cada factor (s − z#sub[i]) con el cero dentro gira una vuelta, y los de fuera ninguna; cada polo dentro resta una. Se elige el contorno que encierra el semiplano derecho (el eje imaginario y una semicircunferencia infinita, donde L → 0 o a una constante), así que todo se reduce a la curva L(jω). Los ceros de F son los polos del lazo cerrado, sus polos los de L, y F = 1 + L rodea el origen cuando L rodea el −1: Z = N + P. Un integrador en el origen se esquiva por la derecha con un semicírculo diminuto, que la curva convierte en un arco infinito que se cierra por la derecha.
]

Los márgenes de la sección #nr("sec-31.9") están en el dibujo (figura #nr("fig-new-31-nyquist")). Con K = 100, la curva corta el semieje negativo en −0,175 a 6,56 rad/s: la ganancia puede multiplicarse por 1/0,175 = 5,72 (el #strong[margen de ganancia] de Routh) antes de alcanzar el −1. Atraviesa la circunferencia unidad a 2,35 rad/s con −118,3°: le faltan 61,7° de giro para llegar al −1, el #strong[margen de fase]. Y pasa a 0,640 del −1 a 3,77 rad/s: M#sub[s] = 1,56.

#figura("control-nyquist.svg", 100%, [Diagrama de Nyquist de 100/((s + 1)(s + 3)(s + 10)), calculado por ngspice. A la izquierda, los tres márgenes: el corte con el semieje negativo (margen de ganancia), el cruce con la circunferencia unidad (margen de fase) y la distancia mínima al −1 (pico de sensibilidad). A la derecha, el mismo lazo con un retardo de 0,458 s: la curva gira sin cambiar de módulo y pasa por el −1.]) <fig-new-31-nyquist>

#precaucion[
  Con 61,7° de margen la regla de la sección #nr("sec-31.9") predice menos de un 10 % de sobreimpulso, y la simulación da un #strong[23 %] (sobre su valor final, 0,769). La regla supone el lazo de referencia; este es de tipo 0 y su curva se acerca al −1 en diagonal, lejos del cruce. M#sub[s] = 1,56, por encima de 1,4, sí lo avisa: hay que mirar los tres números.
]

=== Lo que Nyquist resuelve y el Bode no

- #strong[Retardo puro.] e#super[−jωT] gira cada punto de la curva un ángulo ωT sin cambiar su módulo; el del cruce llega al −1 cuando ω#sub[c]·T iguala el margen de fase en radianes: 1,078/2,35 = 0,458 s, el margen de retardo de la sección #nr("sec-31.9"). En ngspice, con una línea sin pérdidas de 0,458 s en el lazo, oscila de forma sostenida con periodo 2π/2,35 = 2,67 s.
- #strong[Lazos condicionalmente estables.] Si la curva corta varias veces el semieje negativo, el lazo puede volverse inestable al #strong[bajar] la ganancia, por ejemplo cuando un actuador satura. El margen de ganancia del Bode no lo avisa.
- #strong[Plantas inestables] (P > 0: un levitador, un péndulo invertido). Con L(s) = K/(s − 1), la curva es una circunferencia de −K al origen; si K > 1 rodea el −1 una vez en sentido antihorario, N = −1 y Z = 0: estable, con el polo en 1 − K. Si K < 1, Z = 1. Hace falta una ganancia mínima, y los márgenes del Bode pierden su lectura habitual.

=== En el banco

Routh es la comprobación previa a cualquier ensayo: con el modelo identificado de la planta (sección #nr("sec-31.2")) da la ganancia a la que oscilará. Si oscila con bastante menos, falta un polo, casi siempre el del sensor o un filtro. Y la curva de Nyquist se mide con la inyección de la sección #nr("sec-27.10"): el cociente de las tensiones a ambos lados de la resistencia da L(jω), y se dibuja la parte real contra la imaginaria; diez frecuencias alrededor del cruce bastan para ver por dónde pasa respecto al −1.

== Compensación de Adelanto y de Retraso <sec-new-31-compensacion>

Subir la ganancia reduce el error y gasta margen (sección #nr("sec-31.2")). Cuando una ganancia sola no cumple las dos cosas, un #strong[compensador], un cero y un polo reales, cambia la forma del lazo: con el cero por debajo del polo adelanta la fase en el cruce y da margen (#strong[adelanto]); con el cero por encima sube la ganancia a baja frecuencia sin tocar el cruce y reduce el error (#strong[retraso]). Son el PID de la sección #nr("sec-31.3") visto de otra manera, y las redes de tipo II y III de la sección #nr("sec-33.16") son adelantos con un integrador.

=== La red de adelanto

#ec[$ C(s) = K_"c" dot.op (1 + s \/ ω_"z")/(1 + s \/ ω_"p") quad quad α = (ω_"p")/(ω_"z") > 1 $]

Entre ω#sub[z] y ω#sub[p] la red deriva: la ganancia sube 20 dB/década y la fase se adelanta. Por encima de ω#sub[p] la ganancia es K#sub[c]·α, y ese es el precio: el ruido de alta frecuencia sale multiplicado por α. El máximo y su frecuencia:

#ec[$ φ_"m" = arcsin((α - 1)/(α + 1)) quad quad ω_"m" = sqrt(ω_"z" dot.op ω_"p") quad quad |C(j ω_"m")| = K_"c" dot.op sqrt(α) $]

#deduccion[El adelanto máximo][
  #eclabel[#strong[Ec. 7 — Fase de la red y su máximo]]
  #ec[$ φ(ω) = arctan(ω/(ω_"z")) - arctan(ω/(ω_"p")) quad quad tan φ_"m" = (α - 1)/(2 sqrt(α)) $]

  #strong[Origen.] Derivando e igualando a cero sale ω² = ω#sub[z]·ω#sub[p], el centro del tramo en escala logarítmica. Con la tangente de una diferencia, tan φ#sub[m] = (√α − 1/√α)/2, y de ahí sin φ#sub[m] = (α − 1)/(α + 1). El módulo allí es √α: la mitad, en decibelios, de la subida total.
]

#tabla(none, columns: 3, align: (left, right, right),
  [α = ω#sub[p]/ω#sub[z]], [Adelanto máximo φ#sub[m]], [Ganancia en ω#sub[m] (10·log α)],
  [2], [19,5°], [3,0 dB],
  [3], [30,0°], [4,8 dB],
  [5], [41,8°], [7,0 dB],
  [10], [54,9°], [10,0 dB],
  [20], [64,8°], [13,0 dB],
)

Pasar de 55° a 65° cuesta duplicar α y el ruido; por encima de unos 60° se ponen dos redes en cascada. Y el proporcional más el derivativo filtrado de la sección #nr("sec-31.3") es una red de adelanto con α = N + 1: con N = 10, como mucho 56,4°.

=== Diseño de un adelanto por frecuencia

Ejemplo: un servo de posición (motor de continua y reductor, de la tensión al ángulo), G(s) = 10/(s·(0,1·s + 1)), de tipo 1. Se pide un error de seguimiento de 0,01 rad como máximo a 1 rad/s (K#sub[v] ≥ 100 s#super[−1]) y al menos 50° de margen.

+ #strong[La ganancia, por el error.] K#sub[v] = 10·K = 100 exige K = 10. Con ella, L#sub[0]\(s) = 100/(s·(0,1·s + 1)) cruza a 30,8 rad/s con un margen de fase de #strong[18,0°], y el escalón se pasa un 60,5 %.
+ #strong[El adelanto que falta.] φ#sub[m] = 50° − 18,0° + 10°, con 10° de reserva porque el cruce subirá a donde la planta tiene menos fase: 42,0°, y α = (1 + sin φ#sub[m])/(1 − sin φ#sub[m]) = 5,05.
+ #strong[Dónde.] La red sube √α (7,0 dB) en ω#sub[m]\; el nuevo cruce está donde |L#sub[0]| = −7,0 dB, 46,9 rad/s, y ahí se centra: ω#sub[z] = ω#sub[m]/√α = 20,9 rad/s y ω#sub[p] = ω#sub[m]·√α = 105,4 rad/s, con K#sub[c] = 1 para no tocar K#sub[v].
+ #strong[Comprobar.] Cruce en 46,9 rad/s con 54,1°. Si sale corto, se repite con más reserva.

La red se construye con un operacional inversor (figura #nr("fig-new-31-redes")): a la entrada, R#sub[1] en paralelo con la rama R#sub[3] + C#sub[1]\; en la realimentación, R#sub[2]. Su ganancia es

#ec[$ -(R_2)/(R_1) dot.op (1 + s (R_1 + R_3) C_1)/(1 + s R_3 C_1) quad quad ω_"z" = 1/((R_1 + R_3) C_1) quad quad ω_"p" = 1/(R_3 C_1) quad quad α = 1 + (R_1)/(R_3) $]

con R#sub[2] = R#sub[1] para K#sub[c] = 1 (el signo lo absorbe el amplificador de error). Con R#sub[1] = 100 kΩ: R#sub[3] = R#sub[1]/(α − 1) = 24,7 kΩ y C#sub[1] = 385 nF; normalizados, 24 kΩ y 390 nF dan ω#sub[z] = 20,7 rad/s, ω#sub[p] = 106,8 rad/s y α = 5,17. En ngspice la red da 42,5° en 47,0 rad/s, y el lazo completo, con el operacional, cruza a 47,2 rad/s con #strong[54,5°]\; el escalón se pasa un 17,7 % y se establece en 0,126 s (figura #nr("fig-new-31-servo")). El sobreimpulso supera el 13,8 % que daría ese margen en el lazo de referencia porque el cero de la red está cerca de los polos dominantes. Y la tolerancia de C#sub[1] apenas importa: con ±10 % el margen queda entre 53,6° y 54,8°, porque la cima de la fase es plana.

=== La red de retraso

#ec[$ C(s) = (1 + s \/ ω_"z")/(1 + s \/ ω_"p") quad quad β = (ω_"z")/(ω_"p") > 1 $]

Con el polo por debajo del cero, la ganancia es 1 en continua y 1/β por encima de ω#sub[z]: el cruce baja a donde la planta tiene más fase y K#sub[v] no cambia. Su retraso de fase se hace pequeño (unos 5°) con ω#sub[z] una década por debajo del cruce. Para el servo: L#sub[0] tiene −180° + 50° + 5° de fase en 7,00 rad/s, donde |L#sub[0]| = 11,7 = β; con ω#sub[z] = 0,700 rad/s y ω#sub[p] = 0,060 rad/s cruza a 7,03 rad/s con 49,7°. Las cuatro opciones, simuladas con ngspice:

#tabla(none, columns: 6, align: (left, right, right, right, right, right),
  [Servo 10/(s·(0,1·s + 1))], [K#sub[v] (s#super[−1])], [Cruce (rad/s)], [Margen de fase], [Sobreimpulso], [Establecimiento (2 %)],
  [K = 10, sin compensar], [100], [30,8], [18,0°], [60,5 %], [0,73 s],
  [Solo ganancia (K = 1,10)], [11,0], [8,39], [50,0°], [18,1 %], [0,79 s],
  [Adelanto (K = 10)], [100], [47,2], [54,5°], [17,7 %], [0,13 s],
  [Retraso (K = 10)], [100], [7,03], [49,7°], [22,3 %], [1,97 s],
)

El adelanto da margen #strong[y] velocidad: se establece seis veces antes que bajando la ganancia, con K#sub[v] nueve veces mayor. El retraso cumple, pero cruza casi siete veces más abajo y tarda quince veces más en establecerse, también por la cola lenta que deja su par polo-cero cerca del origen. El retraso es para cuando solo falta ganancia a baja frecuencia; el adelanto, para cuando falta margen o velocidad; si faltan las dos cosas, se combinan.

#figura("control-servo.svg", 100%, [El servo 10/(s·(0,1·s + 1)) con las cuatro opciones de la tabla. A la izquierda, la ganancia y la fase del lazo abierto: el adelanto sube la fase en el cruce y lo lleva más arriba; el retraso baja la ganancia en el cruce y lo lleva más abajo. A la derecha, la respuesta al escalón simulada con ngspice (el adelanto, con el circuito del operacional).]) <fig-new-31-servo>

=== Diseño por el lugar de las raíces

Un punto s#sub[0] es del lugar de las raíces si la fase de L(s#sub[0]) es −180° (condición de ángulo), con la ganancia que hace |L(s#sub[0])| = 1 (condición de módulo); si los polos deseados no están en el lugar, el compensador aporta el ángulo que falta. Con el servo como G(s) = 100/(s·(s + 10)) y ζ = 0,5 con t#sub[s] = 0,4 s, los polos deseados son −10 ± j17,3. Una ganancia sola no llega: s² + 10·s + 100·K tiene σ = 5 para cualquier K, y con ζ = 0,5 (K = 1) se establece en 0,81 s con K#sub[v] = 10 s#super[−1]. En s#sub[0] la planta tiene −120° − 90° = −210°: faltan 30°. Con el cero de la red sobre el polo de −10, el polo de la red debe restar 60°: arctan(17,3/(p − 10)) = 60°, p = 20; la condición de módulo da K#sub[c] = 20 × 20/100 = 4. Con C(s) = 4·(s + 10)/(s + 20), el lazo cerrado es s² + 20·s + 400: ζ = 0,5, ω#sub[n] = 20 rad/s, 16,3 % de sobreimpulso, 0,404 s de establecimiento y K#sub[v] = 20 s#super[−1], la mitad de tiempo y el doble de K#sub[v].

#nota[
  Cancelar un polo con un cero solo vale si el polo es estable y se conoce bien; si la planta cambia, queda un par polo-cero cercano y una cola en la respuesta. Un polo inestable no se cancela nunca: el modo sigue en el lazo aunque no se vea entre consigna y salida.
]

=== Los compensadores y el PID

Un PI es un retraso con el polo en el origen (sube el tipo a costa de fase a baja frecuencia); un PD con filtro, un adelanto con α = N + 1; un PID con filtro, un adelanto-retraso. Verlo como dos ceros que se colocan da una sintonía sin llevar el lazo a oscilar: el cero del PI cerca del polo más lento de la planta, el del PD cerca del siguiente, y la ganancia para el margen deseado. El problema #nr("prob-31.D") lo compara con Ziegler-Nichols.

=== La conexión con las redes de tipo II y III

La red de #strong[tipo II] de la sección #nr("sec-33.16") es un integrador (el tipo 1 y la «ganancia en continua alta» que allí se pedía) por una red de adelanto; su «hasta 90°» es el φ#sub[m] de la Ec. 7 con α → ∞. La de #strong[tipo III] es un integrador por dos adelantos y llega a casi 180°.

Su tipo II (cero en 300 Hz, polo en 11 kHz) tiene α = 36,7 y podría dar 71,2° en 1,82 kHz, pero en el cruce de 8 kHz da 51,8°, porque la receta no centra el máximo: cancela el polo de la planta y el cero del ESR. Con sus componentes (10 kΩ, 40 kΩ, 13 nF y 360 pF), ngspice da 52,7° (el cero queda en 306 Hz y el polo en 11,4 kHz). En su tipo III, la fase en 8 kHz suma −90° + 87,4° + 84,8° − 35,3° − 9,1° = +37,7°, y con los −178° + 35,3° de la planta el lazo queda en −105,0°: los 75° de margen que anuncia.

Centrar el adelanto en el cruce es lo que hace el #strong[método del factor K] de H. Dean Venable (1983), muy usado en fuentes conmutadas. Con el realce necesario Δφ = MF − φ#sub[planta] − 90° (φ#sub[planta], la fase de la planta en f#sub[c]):

#ec[$ "tipo II:" quad K = tan((Δ φ)/2 + 45°) quad f_"z" = (f_"c")/K quad f_"p" = K dot.op f_"c" $]

#ec[$ "tipo III:" quad K = tan^2((Δ φ)/4 + 45°) quad f_"z" = (f_"c")/(sqrt(K)) quad f_"p" = sqrt(K) dot.op f_"c" $]

(en el tipo III, ceros y polos dobles). El tipo II es un adelanto con α = K² centrado en el cruce, y K es la fórmula de φ#sub[m] al revés. Con la planta de 32.16 (−142,7° en 8 kHz) y 60° de margen, el realce es 112,7° y el tipo III queda con K = 10,9: ceros dobles en 2,42 kHz, polos dobles en 26,5 kHz y 60,0° exactos. La receta de 32.16 da más, 75°, porque cancela el doble polo LC; las dos son correctas, y la comprobación con el ESR mínimo y máximo vale para ambas.

#figura("control-redes.svg", 100%, [Las tres redes con un operacional: el adelanto (un cero y un polo, ganancia R#sub[2]/R#sub[1] en continua), el tipo II (integrador, un cero y un polo) y el tipo III (integrador, dos ceros y dos polos), con las frecuencias de cada elemento.]) <fig-new-31-redes>

=== En el banco

La red de adelanto del ejemplo se comprueba con generador y osciloscopio en tres puntos: a 7,5 Hz (47 rad/s), salida adelantada unos 42° y 2,27 veces (√5,17) la entrada; a 1 Hz, 13,5° y 1,04; a 100 Hz, 7,8° y 5,10, cerca de α. En el lazo real, la comprobación es la respuesta al escalón de la sección #nr("sec-new-31-respuesta"). Y el adelanto multiplica por α el ruido de alta frecuencia: en un motor se oye como un siseo y calienta el driver. Si molesta, se baja α o se añade un polo por encima del cruce, que es lo que hace el segundo polo del tipo III.

// ============================================================================================ PARTE 2
=== Problema #nr("prob-31.D") — Del papel al ajuste: un PID por márgenes <prob-31.D>

#strong[Enunciado]

La planta K/((s + 1)(s + 3)(s + 10)) de la sección #nr("sec-new-31-estabilidad"), con K = 1 (ganancia estática 1/30), se controla con un PID con filtro en la derivada (N = 10, sección #nr("sec-31.3")).

#strong[Se pide:] obtener K#sub[u] y T#sub[u] sin ensayo y aplicar Ziegler-Nichols; evaluar el resultado con el margen de fase, M#sub[s] y la respuesta al escalón; y diseñar una alternativa por colocación de ceros con 60° de margen.

#strong[Ziegler-Nichols desde Routh]

El polinomio s³ + 14s² + 43s + 30 + K#sub[p] da, con la tabla de Routh, K#sub[u] = 572 y T#sub[u] = 2π/√43 = 0,958 s. La tabla de la sección #nr("sec-31.3") da K#sub[p] = 0,6 × 572 = 343, T#sub[i] = 0,479 s y T#sub[d] = 0,120 s.

#tabla(none, columns: 6, align: (left, right, right, right, right, right),
  [PID], [K#sub[p]], [T#sub[i]], [T#sub[d]], [Margen de fase · M#sub[s]], [Sobreimpulso · establecimiento],
  [Ziegler-Nichols], [343], [0,479 s], [0,120 s], [25,2° · 2,39], [54,2 % · 2,62 s],
  [K#sub[p] = 0,33·K#sub[u]], [189], [0,479 s], [0,120 s], [27,1° · 2,23], [48,8 % · 3,72 s],
  [Colocación de ceros], [178], [1,333 s], [0,250 s], [63,1° · 1,38], [5,0 % · 0,81 s],
)

#strong[Cómo leer la tabla.] Ziegler-Nichols da lo que advierte la sección #nr("sec-31.11"): 25° y un 54 % de sobreimpulso. Bajar K#sub[p] a 0,33·K#sub[u] (problema #nr("prob-31.A")) apenas mejora: 2° más y un lazo más lento. El defecto está en T#sub[i]: con 0,479 s, el cero del PI cae en 2,09 rad/s, por encima del polo lento de la planta (1 rad/s), y su retraso de fase llega al cruce.

#strong[El diseño por márgenes.] En forma serie, C(s) = K#sub[c]·(1 + 1/(T′#sub[i]·s))·(1 + T′#sub[d]·s)/(1 + T′#sub[d]·s/N), los ceros van sobre los dos polos lentos: T′#sub[i] = 1 s y T′#sub[d] = 1/3 s. Queda L(s) = K#sub[c]/(3·s·(s + 10)·(1 + s/30)), y 60° de margen piden K#sub[c] = 133,7: cruce en 4,09 rad/s, M#sub[s] = 1,42, 7,9 % de sobreimpulso y 0,96 s. En la forma paralela del libro, K#sub[p] = K#sub[c]·(1 + T′#sub[d]/T′#sub[i]) = 178, T#sub[i] = T′#sub[i] + T′#sub[d] = 1,333 s y T#sub[d] = T′#sub[i]·T′#sub[d]/(T′#sub[i] + T′#sub[d]) = 0,250 s; con el filtro de la sección #nr("sec-31.3") sobre T#sub[d], el margen sale en 63,1° (la fila de la tabla).

#strong[El precio de cancelar.] El polo de −1 sigue en el lazo: una perturbación de carga se corrige con su constante de tiempo de 1 s (entre los 2 y los 5 s su efecto baja unas 20 veces, e#super[3]). Si la carga cambia a menudo, conviene un T#sub[i] algo menor.

#strong[En el banco]

- Calcula K#sub[u] con el modelo antes de buscarla subiendo la ganancia: si la planta oscila con mucha menos, falta un polo.
- Prueba también un escalón de carga, para ver la cola de 1 s que deja la cancelación.

#strong[Resultado:] Ziegler-Nichols da 25° de margen y un 54 % de sobreimpulso; el PID por colocación de ceros, K#sub[p] = 178, T#sub[i] = 1,33 s y T#sub[d] = 0,25 s, da 63° de margen, un 5 % de sobreimpulso y se establece tres veces antes.

// ============================================================================================ PARTE 3
#ejercicios[
  #ejercicio[
    Un lazo se comporta como un segundo orden con ζ = 0,4 y ω#sub[n] = 5 rad/s. Calcula el sobreimpulso, el tiempo de pico y el tiempo de establecimiento al 2 % con la fórmula aproximada. ¿Qué margen de fase tiene el lazo de referencia con ese ζ?
  ] <ej-31.9>

  #ejercicio[
    En el osciloscopio, la respuesta al escalón de un lazo se pasa un 25 % y alcanza el pico a los 0,2 s. Suponiendo un segundo orden, calcula ζ, ω#sub[n] y el tiempo de establecimiento, y estima el margen de fase con la regla de la sección #nr("sec-31.9") y con el valor exacto.
  ] <ej-31.10>

  #ejercicio[
    El lazo abierto de un control con realimentación unitaria es L(s) = 50·(s + 2)/(s·(s + 5)·(s + 10)). ¿De qué tipo es? Calcula el error en régimen permanente ante un escalón unitario y ante una rampa de pendiente 1 y de pendiente 5.
  ] <ej-31.11>

  #ejercicio[
    Con la tabla de Routh, halla el intervalo de K para el que es estable el lazo K/(s·(s + 1)·(s + 2)·(s + 3)). ¿A qué frecuencia oscila en el límite?
  ] <ej-31.12>

  #ejercicio[
    ¿Cuántas raíces tiene en el semiplano derecho el polinomio s⁴ + 2s³ + 3s² + 6s + 5? Construye la tabla de Routh y resuelve el caso especial que aparece.
  ] <ej-31.13>

  #ejercicio[
    Para L(s) = 40/(s·(s + 2)·(s + 5)), calcula el margen de ganancia con Routh y el margen de fase. ¿Qué retardo puro haría oscilar el lazo? ¿Qué dirías de este lazo al verlo en la curva de Nyquist?
  ] <ej-31.14>

  #ejercicio[
    Hace falta una red de adelanto que dé 35° a 20 rad/s. Calcula α, ω#sub[z] y ω#sub[p], y los componentes de la red con operacional de la figura #nr("fig-new-31-redes") con R#sub[1] = R#sub[2] = 47 kΩ y valores normalizados. ¿Cuánto amplifica el ruido de alta frecuencia?
  ] <ej-31.15>

  #ejercicio[
    El lazo de temperatura del problema #nr("prob-31.B") (planta 0,8/(120·s + 1), K#sub[p] = 5) deja un 20 % de error. Se propone una red de retraso que multiplique por 10 la ganancia en continua sin tocar el cruce. Calcula el nuevo error, dónde colocar el cero y el polo, y lo que cuesta en margen de fase. ¿Por qué en la práctica se usa un PI?
  ] <ej-31.16>

  #ejercicio[
    El amplificador de error de una fuente en modo corriente debe cruzar a 10 kHz con 60° de margen. La planta tiene −100° de fase y −12 dB de ganancia a 10 kHz. Diseña la red de tipo II por el método del factor K, con R#sub[1] = 10 kΩ y valores normalizados.
  ] <ej-31.17>
]

// ============================================================================================ PARTE 4
#soluciones[
  #solucion("ej-31.9")[
    M#sub[p] = e#super[−π·0,4/√(1−0,16)] = 25,4 %. ω#sub[d] = 5·√(1 − 0,16) = 4,58 rad/s y t#sub[p] = π/4,58 = 0,686 s. t#sub[s] ≈ 4/(ζ·ω#sub[n]) = 4/2 = 2,0 s (el valor exacto es 1,68 s: la fórmula es una cota). Margen de fase del lazo de referencia con ζ = 0,4: 43,1° (la regla ζ ≈ MF/100 da 40°).
  ]

  #solucion("ej-31.10")[
    ζ = ln(1/0,25)/√(π² + ln²(1/0,25)) = 0,404. ω#sub[d] = π/t#sub[p] = 15,7 rad/s y ω#sub[n] = 15,7/√(1 − 0,404²) = 17,2 rad/s. t#sub[s] ≈ 4/(0,404 × 17,2) = 0,58 s. Margen de fase: unos 40° con la regla, 43,5° con la Ec. 4; la sección #nr("sec-27.10") daría entre 35° y 48° para sobreimpulsos del 35 % y del 20 %, coherente.
  ]

  #solucion("ej-31.11")[
    Un polo en el origen: tipo 1. Ante un escalón, error nulo. K#sub[v] = lim s·L(s) = 50 × 2/(5 × 10) = 2 s#super[−1]: ante una rampa de pendiente 1, el error es 1/2 = 0,5; de pendiente 5, 2,5. Antes de aplicar el valor final hay que comprobar la estabilidad: los polos del lazo cerrado están en −1,20 y −6,90 ± j5,99, todos a la izquierda.
  ]

  #solucion("ej-31.12")[
    Polinomio: s⁴ + 6s³ + 11s² + 6s + K. Tabla: s⁴: 1, 11, K; s³: 6, 6; s²: (66 − 6)/6 = 10, K; s¹: (60 − 6K)/10; s⁰: K. Estable si K > 0 y 60 − 6K > 0: #strong[0 < K < 10]. Con K = 10, la fila de s¹ se anula y el polinomio auxiliar 10s² + 10 = 0 da s = ±j1: oscila a 1 rad/s (periodo 6,28 s). Las otras dos raíces están en −3 ± j1. ngspice, con K = 10: oscilación sostenida de periodo 6,28 s.
  ]

  #solucion("ej-31.13")[
    Tabla: s⁴: 1, 3, 5; s³: 2, 6; s²: (2·3 − 6)/2 = 0 y 5. Cero en la primera columna con el resto no nulo: se sustituye por ε > 0. s¹: (6ε − 10)/ε ≈ −10/ε, muy negativo; s⁰: 5. Primera columna: 1, 2, ε, −10/ε, 5: dos cambios de signo, dos raíces en el semiplano derecho. Las raíces son 0,300 ± j1,625 y −1,300 ± j0,375. Todos los coeficientes eran positivos: la condición necesaria no basta.
  ]

  #solucion("ej-31.14")[
    Polinomio: s³ + 7s² + 10s + 40. Routh: estable si 7 × 10 > K, K#sub[u] = 70, con oscilación en √10 = 3,16 rad/s; margen de ganancia 70/40 = 1,75 (4,9 dB). |L(jω)| = 1 en ω#sub[c] = 2,35 rad/s, con fase −164,7°: margen de fase 15,3°. Retardo máximo: 0,267 rad/2,35 rad/s = 0,114 s. En la curva de Nyquist pasa muy cerca del −1: M#sub[s] = 4,44 (distancia mínima 0,225), muy por encima de 2, un lazo frágil que se pasará más de un 60 % y oscilará varios ciclos. ngspice: 15,3° y 1,75.
  ]

  #solucion("ej-31.15")[
    α = (1 + sin 35°)/(1 − sin 35°) = 3,69. ω#sub[z] = 20/√3,69 = 10,4 rad/s y ω#sub[p] = 20·√3,69 = 38,4 rad/s. R#sub[3] = R#sub[1]/(α − 1) = 17,5 kΩ y C#sub[1] = 1/(ω#sub[z]·(R#sub[1] + R#sub[3])) = 1,49 µF. Con 18 kΩ y 1,5 µF: ω#sub[z] = 10,3 rad/s, ω#sub[p] = 37,0 rad/s, α = 3,61 y un máximo de 34,5° en 19,5 rad/s, medio grado por debajo de lo pedido. En alta frecuencia la ganancia es α = 3,6 (11,3 dB con la α ideal): el ruido sale casi cuatro veces mayor.
  ]

  #solucion("ej-31.16")[
    Con la ganancia en continua multiplicada por 10, K#sub[pos] = 40 y el error baja a 1/41 = 2,4 %. El cruce del lazo proporcional está donde |4/(120·jω + 1)| = 1: ω#sub[c] = √15/120 = 0,0323 rad/s. El cero se pone una década por debajo, en 0,00323 rad/s (constante de tiempo de 310 s), y el polo diez veces más abajo, en 0,000323 rad/s (3 100 s, unos 52 min). El margen de fase baja de 104,5° a 99,3°, un coste de 5,2°. El problema práctico es ese polo de 52 minutos: el último tramo del error tarda horas en desaparecer, y un condensador para esa constante de tiempo es enorme. Un PI elimina el error del todo con un cero de constante de tiempo comparable a la de la planta y un integrador, que en un microcontrolador es una suma.
  ]

  #solucion("ej-31.17")[
    Realce necesario: Δφ = 60° − (−100°) − 90° = 70°. K = tan(70°/2 + 45°) = tan 80° = 5,67. f#sub[z] = 10/5,67 = 1,76 kHz y f#sub[p] = 10 × 5,67 = 56,7 kHz. La red debe dar +12 dB (×3,98) en 10 kHz; con C(s) ≈ (R#sub[2]/R#sub[1])·(1 + ω#sub[z]/s)/(1 + s/ω#sub[p]), |C| en el cruce es (R#sub[2]/R#sub[1])·√(1 + (f#sub[z]/f#sub[c])²)/√(1 + (f#sub[c]/f#sub[p])²) = R#sub[2]/R#sub[1], porque los dos factores valen 1,015 y se compensan: R#sub[2] = 39,8 kΩ. C#sub[1] = 1/(2π·R#sub[2]·f#sub[z]) = 2,27 nF y C#sub[2] = 1/(2π·R#sub[2]·f#sub[p]) = 70 pF. Con 39 kΩ, 2,2 nF y 68 pF, la simulación en ngspice da 70,3° de realce y 11,6 dB en 10 kHz: los 0,4 dB que faltan se deben a los redondeos y a que C#sub[2] no es del todo despreciable frente a C#sub[1]\; con el lazo cayendo 20 dB/década en el cruce, lo bajan un 5 %, algo que se ajusta en el banco.
  ]
]

// ============================================================================================ PARTE 5
// (optional, comments only) for the chapter's paratexto (cap31.typ of paratexto/: resumen-capitulo, formulas-capitulo,
// terminos-clave). Proposed sentence for the summary, after the one on stability margins:
//   «Las especificaciones temporales se traducen en polos: el sobreimpulso fija ζ y el establecimiento σ, y el tipo
//   del lazo decide el error ante escalón, rampa y parábola. Routh-Hurwitz da sin calcular raíces el intervalo de
//   ganancias estables y la ganancia crítica de Ziegler-Nichols; Nyquist da sentido a los márgenes y trata el retardo
//   y las plantas inestables. Los compensadores de adelanto y de retraso, que son el PD y el PI vistos como ceros y
//   polos, se diseñan por frecuencia o por el lugar de las raíces, y las redes de tipo II y III son adelantos con un
//   integrador.»
// Formula card (three entries, label, formula, section):
//   [Segundo orden: sobreimpulso y establecimiento]  $ M_"p" = e^(- π ζ \/ sqrt(1 - ζ^2)) quad t_"s" approx 4/(ζ ω_"n") $
//   [Error ante rampa de un lazo de tipo 1]           $ e_(infinity) = A/(K_"v") quad K_"v" = lim_(s arrow.r 0) s dot.op L(s) $
//   [Adelanto máximo de una red]                       $ sin φ_"m" = (α - 1)/(α + 1) quad ω_"m" = sqrt(ω_"z" ω_"p") $
// Key terms: «Tipo del sistema», «Criterio de Routh-Hurwitz», «Criterio de Nyquist», «Red de adelanto»,
//   «Red de retraso», «Polos dominantes», «Factor K».
