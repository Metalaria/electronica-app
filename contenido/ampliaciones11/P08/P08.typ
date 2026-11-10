// P08 — «Álgebra lineal y métodos numéricos para el circuito» for «Electrónica Práctica Avanzada», chapter 0
// (cap00.typ, «Fundamentos Matemáticos para la Electrónica»): an extension of 0.12 (eigenvalues and natural modes) and
// a new section after 0.12 (numerical methods). Five parts, each to be pasted in its own place (see NOTAS.md):
//   PARTE 1  end of 0.12 «Nociones de Álgebra Lineal y Estadística» <sec-0.12>: after its #deduccion[Álgebra lineal]
//            (the last block of 0.12) and before «== Cifras Significativas, Errores e Incertidumbre de Medida
//            <sec-0.13>».
//   PARTE 2  the new section «Métodos Numéricos: Cómo Resuelve el Simulador un Circuito» <sec-new-0-numericos>:
//            right after PARTE 1, so it becomes 0.13 (the old 0.13-0.21 become 0.14-0.22).
//   PARTE 3  nine exercises: inside the chapter's #ejercicios[…], after <ej-0.10>.
//   PARTE 4  their solutions: inside #soluciones[…], after #solucion("ej-0.10")[…].
//   PARTE 5  (comments only) proposals for the chapter's summary, formula card and key terms (paratexto).
// Numbers: figures 0.13 (in 0.12), 0.14-0.15 (new section); the old 0.13-0.16 become 0.16-0.19; equations Ec. 1-5
// (chapter 0 had none of its own; kept below 12 so that «capítulo 1 (Ec. 12 y 13)» in 0.3 is never taken for one of
// these); exercises 0.11-0.19. Every number comes from scripts/calculos.py and every simulated value from the ngspice
// runs (scripts/spice_comprobar.py). The section on time integration refers to P06 (<sec-new-31-modelado>) for the
// methods themselves; see NOTAS.md if P06 is not adopted.

// ============================================================================================ PARTE 1
=== Autovalores y autovectores: los modos naturales de un circuito

Hasta aquí la matriz resolvía un circuito quieto. Con condensadores y bobinas el circuito evoluciona, y la matriz dice también cómo. Se escribe en forma de estado, como en la sección #nr("sec-31.12"): las variables son las que guardan energía (la tensión de cada condensador y la corriente de cada bobina), y el circuito sin fuentes cumple ẋ = A·x, una ecuación diferencial por variable, acopladas por la matriz A.

La idea clave es que hay direcciones del estado que la matriz no tuerce, solo alarga o acorta: A·u = λ·u. El vector u es un #strong[autovector] (o vector propio) y el número λ, su #strong[autovalor] (valor propio; en inglés, #emph[eigenvalue]). Si el circuito arranca con el estado en la dirección de u, cada componente cumple ẋ = λ·x y el estado decae (o crece) como e#super[λt] sin salirse de esa dirección. Es un #strong[modo natural]: la exponencial de la sección #nr("sec-0.8"), ahora con una forma, la proporción en que participa cada condensador y cada bobina. Un estado inicial cualquiera es una suma de modos, y cada uno evoluciona por su cuenta.

#deduccion[Autovalores y modos de un circuito][
  #eclabel[#strong[Ec. 1 — Autovalores de una matriz 2×2]]
  #ec[$ det(A - λ I) = λ^2 - op("tr") A dot.op λ + det A = 0 quad arrow.r.double quad λ = (op("tr") A)/2 plus.minus sqrt(((op("tr") A)/2)^2 - det A) $]

  #strong[Origen.] A·u = λ·u se escribe (A − λ·I)·u = 0, con I la matriz identidad. Para que haya una solución u distinta de cero, A − λ·I tiene que ser singular, como el circuito mal planteado de esta sección: det(A − λ·I) = 0 es el #strong[polinomio característico], de grado n para n variables de estado. En 2×2 se desarrolla con la regla del determinante de arriba; tr A, la traza, es la suma de la diagonal.

  #eclabel[#strong[Ec. 2 — La respuesta como suma de modos]]
  #ec[$ x(t) = c_1 dot.op u_1 dot.op e^(λ_1 t) + c_2 dot.op u_2 dot.op e^(λ_2 t) $]

  #strong[Origen.] Cada término cumple ẋ = A·x por separado (su derivada es λ#sub[k] veces él mismo, lo mismo que A por él), y la suma también, porque la ecuación es lineal. c₁ y c₂ salen del estado inicial: x(0) = c₁·u₁ + c₂·u₂ es otro sistema lineal.

  #strong[Dominio de validez.] Circuitos lineales e invariantes con autovalores distintos; con dos iguales aparece un término t·e#super[λt], el del amortiguamiento crítico de la sección #nr("sec-0.8"). Un circuito no lineal se linealiza antes alrededor de su punto de trabajo (sección #nr("sec-0.14")), y A es entonces la matriz de derivadas parciales, el jacobiano.
]

#strong[Ejemplo: dos etapas RC en cascada.] Dos etapas iguales, R = 10 kΩ y C = 1 µF (τ = R·C = 10 ms en cada una), sin separador entre ellas (figura #nr("fig-new-0-modos")). Kirchhoff en los dos nodos da C·dv₁/dt = (v#sub[e] − v₁)/R − (v₁ − v₂)/R y C·dv₂/dt = (v₁ − v₂)/R; sin la fuente, A = (1/τ)·(−2, 1; 1, −1) (las filas, separadas por punto y coma), con traza −300 s⁻¹ y determinante 10 000 s⁻². La Ec. 1 da λ = (−3 ± √5)/(2·τ): −38,2 y −261,8 s⁻¹, dos constantes de tiempo de #strong[26,2 y 3,82 ms]. Ninguna es la de 10 ms de cada etapa, porque la segunda carga a la primera: el circuito entero tiene sus propios modos. Sus autovectores son (1; 1,618) y (1; −0,618): en el modo lento los dos condensadores se cargan en el mismo sentido, el segundo un 62 % más; en el rápido, en sentidos opuestos, y la carga pasa de uno a otro a través de R₂.

Ante un escalón de 1 V desde el reposo, la Ec. 2 da v₂ = 1 − 1,171·e#super[−t/τ₁] + 0,171·e#super[−t/τ₂], con τ₁ = 26,2 ms y τ₂ = 3,82 ms. El modo rápido se extingue enseguida (a los 10 ms pesa 64 veces menos que el lento): en el plano (v₁, v₂) de la figura, cualquier descarga se pega primero a la recta del modo lento y después baja por ella. La salida llega al 63 % a los 30,3 ms; con las dos etapas separadas por un seguidor, a los 21,5 ms. ngspice da la misma curva en cinco cifras. Y la suma de las dos constantes de tiempo, 30 ms, sale sin calcular autovalores: es la traza de −A⁻¹, que en la salida de una escalera RC vale R₁·(C₁ + C₂) + R₂·C₂, el #strong[retardo de Elmore] con que se estima lo que tarda una señal en recorrer una pista larga de un circuito integrado.

Con una bobina y un condensador, los autovalores pueden ser complejos. El RLC serie de la sección #nr("sec-0.8") (10 Ω, 1 mH, 1 µF), con x = (v#sub[C], i#sub[L]), tiene A = (0, 1/C; −1/L, −R/L): traza −R/L = −10 000 s⁻¹ y determinante 1/(L·C) = 10⁹ s⁻². La Ec. 1 da λ = −5 000 ± j31 225 s⁻¹, las raíces de L·s² + R·s + 1/C = 0 de aquella sección: la parte real es la envolvente, que cae a 1/e cada 0,2 ms, y la imaginaria, la oscilación de 31 225 rad/s (4,970 kHz; ngspice, 4,9696 kHz).

Los autovalores son los #strong[polos] de la sección #nr("sec-0.10") y deciden la estabilidad sin resolver nada: el circuito es estable si todos tienen la parte real negativa, y en 2×2 basta con mirar la Ec. 1: estable si y solo si la traza es negativa y el determinante positivo. Si en serie con aquel RLC se pone una resistencia negativa de −15 Ω, lo que hace la parte activa de un oscilador (sección #nr("sec-23.11")), la resistencia total es −5 Ω, la traza pasa a +5 000 s⁻¹ y los autovalores, a +2 500 ± j31 524 s⁻¹: la oscilación se multiplica por 12,2 cada milisegundo (ngspice: 2 500 s⁻¹ y 5,017 kHz). Es el arranque de un oscilador (sección #nr("sec-28.1")), que crece desde el ruido hasta que la saturación reduce la ganancia; el modelo lineal solo describe el principio. Con el determinante negativo hay un autovalor real positivo: la inestabilidad sin oscilación de un biestable, que se va a uno de sus dos estados. Para más de dos variables no se pasa por el polinomio: los programas (`numpy.linalg.eig`, `eig` en Octave) usan el algoritmo QR, que transforma la matriz paso a paso hasta dejar los autovalores en la diagonal.

#figura("numericos-modos.svg", 100%, [Las dos etapas RC en cascada. En el centro, la descarga desde doce estados iniciales en el plano (v₁, v₂): cada trayectoria recorre primero la dirección del modo rápido (3,82 ms) y después baja por la recta del modo lento (26,2 ms). A la derecha, la respuesta al escalón de 1 V: la suma de los dos modos (Ec. 2), ngspice y, en trazo discontinuo, la salida que darían las dos etapas separadas por un seguidor.]) <fig-new-0-modos>

// ============================================================================================ PARTE 2
== Métodos Numéricos: Cómo Resuelve el Simulador un Circuito <sec-new-0-numericos>

La sección #nr("sec-0.12") contó qué hace SPICE: monta una matriz y la resuelve. Falta cómo, y dónde puede fallar. Un análisis transitorio de un circuito con diodos son tres métodos numéricos, uno dentro de otro (figura #nr("fig-new-0-compania")): en cada instante, un método de integración convierte los condensadores y las bobinas en resistencias con fuentes; en cada uno de esos circuitos, Newton-Raphson sustituye los semiconductores por su tangente; y cada circuito lineal que resulta se resuelve por eliminación gaussiana. Cada uno tiene su manera de fallar, y los mensajes del simulador son casi siempre el nombre de una de ellas.

=== El circuito lineal: eliminación, pivotaje y condicionamiento

Una fuente de 10 mA entra en el nodo 1; R₁ = 1 kΩ va del nodo 1 a masa, R₂ = 2 kΩ del 1 al 2, R₃ = 2 kΩ del 2 a masa, R₄ = 1 kΩ del 2 al 3 y R₅ = 1 kΩ del 3 a masa. Por inspección (sección #nr("sec-23.13")), en milisiemens, miliamperios y voltios:

#ec[$ mat("1,5", "−0,5", 0; "−0,5", 2, -1; 0, -1, 2) dot.op mat(v_1; v_2; v_3) = mat(10; 0; 0) $]

La eliminación resta a la fila 2 la fila 1 multiplicada por −0,5/1,5 = −1/3, lo que anula su primer elemento y deja 1,833 en la diagonal y 3,333 a la derecha; después resta a la fila 3 la nueva fila 2 multiplicada por −1/1,833 = −0,545, y queda 1,455·v₃ = 1,818: v₃ = 1,25 V. Hacia atrás, v₂ = (3,333 + 1,25)/1,833 = 2,5 V y v₁ = (10 + 0,5 × 2,5)/1,5 = 7,5 V. Los multiplicadores forman una matriz triangular inferior L, y lo que queda arriba, una superior U: G = L·U, la #strong[factorización LU]. En un transitorio la matriz cambia en cada paso, pero no su forma, y el simulador decide una sola vez el orden de eliminación.

Eliminar obliga a dividir por el elemento de la diagonal, el #strong[pivote]. En la matriz de nodos de un circuito pasivo la diagonal domina (sección #nr("sec-23.13")) y el orden natural funciona; con fuentes de tensión, el análisis nodal modificado añade filas con un cero en la diagonal, y eliminar en ese orden puede acabar dividiendo por cero. #strong[Pivotar] es cambiar el orden de las filas (o de filas y columnas) para dividir siempre por un número grande. Un pivote pequeño es casi peor que uno nulo, porque no avisa: con las 16 cifras de un ordenador, ε·x + y = 1, x + y = 2 con ε = 10⁻¹⁷ (solución x ≈ y ≈ 1) sale x = 0 e y = 1 con ε como pivote, y x = y = 1 intercambiando antes las filas. Los simuladores eligen cada pivote para que no sea pequeño y no llene de elementos nuevos la matriz dispersa.

Hay además sistemas delicados por sí mismos, se resuelvan como se resuelvan. Lo mide el #strong[número de condición] κ:

#deduccion[Número de condición][
  #eclabel[#strong[Ec. 3 — Cuánto se amplifica un error relativo]]
  #ec[$ (norm(Δ v))/(norm(v)) lt.eq κ dot.op (norm(Δ i))/(norm(i)) quad quad κ = norm(G) dot.op norm(G^(-1)) = (λ_"máx")/(λ_"mín") $]

  #strong[Origen.] De Δv = G⁻¹·Δi sale ‖Δv‖ ≤ ‖G⁻¹‖·‖Δi‖, y de i = G·v, ‖i‖ ≤ ‖G‖·‖v‖; dividiendo, la Ec. 3. La norma de una matriz es lo más que puede alargar un vector; si G es simétrica y de autovalores positivos, como la de nodos de un circuito pasivo con camino a masa, es su autovalor mayor, y la de G⁻¹, el inverso del menor.

  #strong[Dominio de validez.] Es una cota del peor caso, y vale igual, a primer orden, para errores relativos en G. Con 16 cifras, un κ de 10#super[p] puede llevarse p de ellas.
]

En el ejemplo, κ = 3,83: no se pierde nada. Si R₄ se hace muy pequeña, las dos tensiones que une se vuelven casi iguales y el sistema, delicado:

#tabla(none, columns: 5, align: (left, right, right, right, right),
  [R₄], [κ], [v₂, NumPy (V)], [v₂, ngspice (V)], [v₂ exacta (V)],
  [1 kΩ], [3,83], [2,500000], [2,500000], [2,500000],
  [1 mΩ], [2,4·10⁶], [1,818183], [1,818183], [1,818183],
  [1 pΩ (10⁻¹² Ω)], [2,3·10¹⁵], [1,950476], [1,865889], [1,818182],
  [1 fΩ (10⁻¹⁵ Ω)], [1,3·10¹⁸], [singular], [1,865889], [1,818182],
)

Con 1 mΩ se pierden unas seis cifras y las diez que quedan sobran. Con 1 pΩ el daño empieza al montar la matriz: G₂₂ = 10¹² S + 0,001 S necesita dieciséis cifras, y el 0,001 S de R₂ y R₃ pierde un 2,3 % al sumarse al billón. ngspice resuelve esa matriz redondeada casi sin error y aun así da v₂ un 2,6 % alta; la eliminación de NumPy llega al 7,3 %. Con 1 fΩ el sumando pequeño desaparece: NumPy declara la matriz singular, y ngspice avisa de que sube R₄ a 10⁻¹² Ω. Son los valores extremos de la sección #nr("sec-42.6"), con números: un contacto cerrado se modela con miliohmios, y nada se gana con picoohmios. El límite, κ infinito, es una matriz singular: un nodo sin camino de continua a masa (`singular matrix:  check node 3`) o dos fuentes de tensión ideales en paralelo.

=== Newton-Raphson: el punto de trabajo de un diodo

Con V = 5 V, R = 1 kΩ y el diodo de la sección #nr("sec-5.3") (I#sub[S] = 10⁻¹² A, n = 1, V#sub[T] = 0,02585 V), la tensión v del diodo cumple f(v) = (V − v)/R − I#sub[S]·(e#super[v/(n·V#sub[T])] − 1) = 0, sin solución con funciones elementales. #strong[Newton-Raphson] parte de una estimación v₀, sustituye la curva por su tangente en ese punto (la linealización de la sección #nr("sec-0.14")) y toma como estimación siguiente el punto donde la tangente se anula:

#deduccion[Newton-Raphson y el circuito equivalente][
  #eclabel[#strong[Ec. 4 — Un paso de Newton]]
  #ec[$ v_(k+1) = v_k - f(v_k)/(f'(v_k)) quad quad I_D (v) approx I_k + g_k dot.op (v - v_k), quad g_k = I_S/(n V_T) dot.op e^(v_k \/ (n V_T)) $]

  #strong[Origen.] f(v) ≈ f(v#sub[k]) + f′(v#sub[k])·(v − v#sub[k]), el desarrollo de Taylor de primer orden, se iguala a cero. En el circuito, la tangente del diodo es una conductancia g#sub[k], la inversa de su resistencia dinámica, en paralelo con una fuente I#sub[k] − g#sub[k]·v#sub[k]\; resolver el circuito lineal que queda, (V − v)/R = I#sub[k] + g#sub[k]·(v − v#sub[k]), es exactamente dar el paso de Newton. Por eso cada iteración de SPICE es un sistema lineal como el del apartado anterior.

  #strong[Convergencia.] Cerca de la solución, e#sub[k+1] ≈ |f″/(2·f′)|·e#sub[k]#super[2]: la #strong[convergencia cuadrática], que dobla las cifras correctas en cada paso. Para la exponencial del diodo, la constante es casi 1/(2·n·V#sub[T]) = 19,3 V⁻¹.

  #strong[Dominio de validez.] f derivable, con derivada no nula en la solución, y un arranque cercano: lejos, la tangente puede mandar el cálculo a cualquier parte.
]

Desde v₀ = 0,6 V, el cociente de la última columna tiende a esa constante (19,2 V⁻¹: la resistencia resta un poco):

#tabla(none, columns: 4, align: (right, right, right, right),
  [k], [v#sub[k] (V)], [Error (V)], [e#sub[k]/e#sub[k−1]²],
  [0], [0,60000000], [2,6·10⁻²], [—],
  [1], [0,58363831], [9,5·10⁻³], [14,2],
  [2], [0,57568842], [1,5·10⁻³], [17,1],
  [3], [0,57419213], [4,5·10⁻⁵], [18,9],
  [4], [0,57414738], [3,9·10⁻⁸], [19,2],
  [5], [0,57414734], [2,9·10⁻¹⁴], [19,2],
)

SPICE para cuando dos iteraciones seguidas difieren en menos de RELTOL·|v| + VNTOL (10⁻³ y 1 µV por defecto), con una condición parecida en las corrientes (ABSTOL, 1 pA): aquí, en la cuarta. La solución es 0,57415 V y 4,4259 mA; ngspice, que trabaja a 300 K con V#sub[T] = 25,852 mV, da 0,57419 V y 4,4258 mA.

Desde 0 V todo cambia (figura #nr("fig-new-0-newton")). Ahí el diodo apenas conduce, y el primer paso lleva a v₁ = 5,0 V, donde la exponencial vale 10⁷² A. Desde ese punto cada iteración baja casi exactamente V#sub[T], porque en una exponencial f/f′ = V#sub[T]: hacen falta #strong[175 iteraciones], y SPICE se rinde a las 100 (su límite ITL1). Con más de 18,3 V el primer paso lleva a una tensión cuya exponencial desborda el número de coma flotante. Es el «no convergence» de la sección #nr("sec-42.6"): Newton converge deprisa cerca de la solución y puede no llegar nunca desde lejos.

SPICE no deja dar ese salto. Por encima de una tensión crítica, V#sub[crít] = n·V#sub[T]·ln(n·V#sub[T]/(√2·I#sub[S])) = 0,611 V para este diodo, sustituye un paso grande de la tensión de una unión por su logaritmo (la función `pnjlim` de su código), pensado para que la corriente nueva sea la que predecía la tangente y no la que daría la exponencial. Desde 0 V, el primer paso queda en V#sub[T]·ln(5 V/V#sub[T]) = 0,136 V, y en #strong[seis iteraciones] el punto está calculado. Si ni así converge, ngspice prueba dos caminos de #strong[continuación], los que nombran sus mensajes: el paso de #emph[gmin] (una conductancia entre cada nodo y masa, grande al principio para que el circuito sea casi lineal, que va reduciendo) y el paso de fuentes (las sube desde cero). Cada solución es un buen arranque para la siguiente: con el diodo, subir la fuente de 0,5 en 0,5 V cuesta 35 iteraciones en total, sin limitar nada. `.nodeset` e `.ic` hacen lo mismo a mano: dan un v₀ cercano (sección #nr("sec-42.6")), y en un circuito con varias soluciones, como un biestable, eligen cuál encuentra Newton.

#figura("numericos-newton.svg", 100%, [Newton-Raphson en el diodo con 5 V y 1 kΩ. A la izquierda, desde 0,6 V: cada iteración sustituye el diodo por su tangente en v#sub[k] y resuelve el circuito lineal, cuyo corte con la recta de la resistencia es v#sub[k+1]. A la derecha, las iteraciones con tres arranques (eje logarítmico): desde 0 V sin limitar, el primer paso salta a 5 V y después baja 25,85 mV por iteración; limitando el salto como SPICE, seis iteraciones.]) <fig-new-0-newton>

=== Integración en el tiempo: el condensador como resistencia con fuente

En un transitorio, cada derivada se sustituye por una diferencia entre instantes separados por un paso h. Los métodos (Euler explícito e implícito y el trapecio), su precisión y su estabilidad están en la sección #nr("sec-new-31-modelado")\; aquí interesa cómo encajan con lo anterior. Con Euler implícito, la corriente de un condensador en t#sub[n+1] es C·(v#sub[n+1] − v#sub[n])/h: una conductancia C/h en paralelo con una fuente (C/h)·v#sub[n] que guarda la memoria del paso anterior. Es su #strong[modelo de compañía] (figura #nr("fig-new-0-compania")):

#eclabel[#strong[Ec. 5 — Modelos de compañía del condensador]]
#ec[$ i_(n+1) = C/h dot.op (v_(n+1) - v_n) quad "(Euler implícito)" \ i_(n+1) = (2 C)/h dot.op (v_(n+1) - v_n) - i_n quad "(trapecio)" $]

Una bobina da lo mismo con los papeles cambiados: una resistencia L/h (o 2·L/h) y una fuente que recuerda la corriente anterior. Con C = 1 µF y h = 0,1 ms, el condensador es durante ese paso una resistencia de 100 Ω con su fuente; descargándose por 1 kΩ, cada paso multiplica su tensión por (C/h)/(1/R + C/h) = 0,9091, frente a e#super[−0,1] = 0,9048 exacto (0,9048 también con el trapecio). Cada instante es un circuito resistivo y, si tiene diodos, un Newton completo que arranca de la solución anterior, casi siempre cercana: pasos por iteraciones por eliminaciones.

El paso lo limitan dos cosas. La #strong[precisión]: el simulador estima el error de truncamiento y, si es grande, repite el instante con un h menor. Y, en los métodos explícitos, la #strong[estabilidad]: Euler explícito exige h ≤ 2/|λ| para todos los autovalores de la matriz de estado (h ≤ 2·τ para un solo modo), y manda el más rápido. En las dos etapas RC de la figura #nr("fig-new-0-modos"), h ≤ 7,64 ms. Si el generador tiene 50 Ω de salida y el cable pone 100 pF en la entrada, aparece un tercer modo de 4,98 ns: los lentos apenas cambian (26,3 y 3,82 ms), pero un integrador explícito queda limitado a pasos de 9,95 ns y necesitaría diez millones para 100 ms. El cociente entre el autovalor mayor y el menor, aquí 5,3·10⁶, mide la #strong[rigidez] del circuito. Un método implícito es estable con cualquier paso y lo elige solo por precisión: ngspice hace esos 100 ms en 1 016 puntos con el parásito y en 1 014 sin él. Casi todos los circuitos electrónicos son rígidos, y por eso SPICE solo usa métodos implícitos, el trapecio y los de Gear.

#figura("numericos-compania.svg", 100%, [Lo que hace un simulador en cada instante de un transitorio. A la izquierda, los modelos de compañía del condensador (Euler implícito y trapecio) y del diodo en la iteración k de Newton: los tres son una conductancia y una fuente de corriente. A la derecha, los tres métodos uno dentro de otro: integración (rojo, repite el instante con un paso menor), Newton (azul, otra iteración) y la eliminación LU en el centro.]) <fig-new-0-compania>

=== Cuando el simulador se queja

Cada mensaje nombra casi siempre uno de los tres métodos. Los remedios son los de la sección #nr("sec-42.6")\; esta añade el porqué:

#tabla(none, columns: 3, align: (left, left, left),
  [Mensaje de ngspice], [Qué ha pasado], [Qué hacer],
  [`singular matrix`], [G singular: un nodo sin camino de continua a masa, un lazo de fuentes de tensión o de bobinas], [Fuga de 1 GΩ a masa; miliohmios en serie],
  [`Value of resistor … is too small`], [Menos de 10⁻¹² Ω: las demás conductancias pierden cifras], [Miliohmios, no picoohmios],
  [`gmin stepping failed`, `source stepping failed`], [Newton no converge ni con continuación: arranque lejano, varias soluciones, un modelo con saltos], [`.nodeset`, `.ic`; revisar el modelo],
  [`Timestep too small`], [Newton no converge en un instante ni con el paso mínimo: una discontinuidad], [Flancos finitos, modelos continuos],
)

Y un resultado que cambia al bajar RELTOL es el de la tolerancia, no el del circuito.

#comprobacion[
  Todo lo simulable de esta sección y del final de la sección #nr("sec-0.12") se ha comparado con ngspice en 16 circuitos (59 comprobaciones, ninguna discrepancia): las dos etapas RC con su suma de modos, en cinco cifras; el RLC (4,9696 kHz) y su crecimiento con −5 Ω (2 500 s⁻¹); las tensiones de la tabla de R₄; el diodo (0,57419 V a 300 K, como la solución exacta); y un condensador de 1 µF cargado por 1 kΩ desde 5 V con ese diodo en paralelo, que pasa por 0,5 V a los 0,1057 ms, como el cálculo, y se queda en el punto de trabajo. Los mensajes citados son los de ngspice 45.2.
]

// ============================================================================================ PARTE 3
#ejercicios[
  #ejercicio[
    Un RLC serie tiene R = 100 Ω, L = 10 mH y C = 1 µF. Escribe su matriz de estado con x = (v#sub[C], i#sub[L]), calcula sus autovalores con la Ec. 1 y, de ellos, el factor de amortiguamiento, la frecuencia de la oscilación y la constante de tiempo de la envolvente.
  ] <ej-0.11>

  #ejercicio[
    Sin calcular los autovalores, di si son estables los circuitos de matrices de estado (en ms⁻¹) M₁ = (−3, 1; 1, −2), M₂ = (0, 1; −4, 1) y M₃ = (1, 2; 3, 0), y si su respuesta oscila. Comprueba después con la Ec. 1.
  ] <ej-0.12>

  #ejercicio[
    Una escalera de tres mallas: una fuente de 12 V alimenta el nodo a a través de R₁ = 2 kΩ; de a a masa va R₂ = 4 kΩ; de a al nodo b, R₃ = 2 kΩ; de b a masa, R₄ = 4 kΩ; y de b sale R₅ = 2 kΩ hacia una segunda fuente de 6 V, con su negativo a masa. Con las tres corrientes de malla en sentido horario (en kΩ, V y mA), escribe la matriz de mallas por inspección y resuélvela por eliminación gaussiana. ¿Hace falta pivotar? Comprueba el determinante.
  ] <ej-0.13>

  #ejercicio[
    Calcula el número de condición de la matriz de mallas del ejercicio anterior (sus autovalores son números enteros). Repite con R₂ = R₄ = 400 kΩ. ¿Cuántas cifras pueden perderse en cada caso? Escribe después las ecuaciones de nudos del mismo circuito con R₂ = R₄ = 400 kΩ (dos nudos, con las fuentes y sus resistencias pasadas a Norton) y calcula su número de condición. ¿Qué formulación conviene?
  ] <ej-0.14>

  #ejercicio[
    Un diodo (I#sub[S] = 10⁻¹² A, n = 1, V#sub[T] = 0,02585 V) se alimenta con 2 V a través de 100 Ω. Partiendo de v₀ = 0,6 V, calcula la conductancia g₀ y la fuente equivalente del diodo linealizado, y da tres iteraciones de Newton. ¿Cómo decrece el error?
  ] <ej-0.15>

  #ejercicio[
    El mismo diodo se alimenta con 10 V a través de 10 kΩ. Si Newton arranca en 0 V sin limitar el paso, ¿a qué tensión lleva el primer paso? Estima cuántas iteraciones hacen falta para volver a la solución (0,534 V) sabiendo cuánto baja cada una, y compáralo con el límite de 100 de SPICE. ¿Dónde queda el primer paso con la limitación de SPICE?
  ] <ej-0.16>

  #ejercicio[
    Obtén el modelo de compañía de una bobina con Euler implícito y con el trapecio, a partir de v = L·di/dt. Con L = 1 mH y h = 1 µs, ¿qué resistencia equivalente tiene en cada caso? Aplícalo a una bobina que se conecta en t = 0 a 10 V a través de 10 Ω: corriente tras dos pasos con cada método, frente a la exacta.
  ] <ej-0.17>

  #ejercicio[
    Un condensador de 1 µF se carga desde 5 V a través de 1 kΩ, con un diodo en paralelo (I#sub[S] = 10⁻¹² A, n = 1, V#sub[T] = 0,02585 V): un RC no lineal. ¿Dónde acaba la tensión? Con Euler implícito y h = 10 µs, escribe la ecuación del paso que parte de v#sub[n] = 0,5 V, resuélvela con Newton desde 0,5 V y compara el resultado con el valor sin diodo y con el exacto.
  ] <ej-0.18>

  #ejercicio[
    Tres etapas RC iguales en cascada, R = 10 kΩ y C = 1 µF. Escribe la matriz de estado, su polinomio característico (en la variable λ·τ) y calcula numéricamente sus tres constantes de tiempo. Comprueba que suman el retardo de Elmore, y calcula el paso máximo de Euler explícito y la rigidez.
  ] <ej-0.19>
]

// ============================================================================================ PARTE 4
#soluciones[
  #solucion("ej-0.11")[
    A = (0, 1/C; −1/L, −R/L) = (0, 10⁶; −100, −10⁴) s⁻¹: traza −10⁴ s⁻¹ y determinante 1/(L·C) = 10⁸ s⁻². λ = −5 000 ± √(25·10⁶ − 10⁸) = −5 000 ± j8 660 s⁻¹. ω₀ = √(det A) = 10⁴ rad/s y ζ = 5 000/10⁴ = 0,5 (también (R/2)·√(C/L) = 0,5). Oscila a 8 660 rad/s (1,378 kHz) con una envolvente de constante de tiempo 1/5 000 = 0,2 ms.
  ]

  #solucion("ej-0.12")[
    M₁: traza −5 y determinante 5: estable; (tr/2)² − det = 6,25 − 5 = 1,25 > 0, autovalores reales, −1,38 y −3,62 ms⁻¹: no oscila. M₂: traza +1: inestable; con (tr/2)² − det = 0,25 − 4 negativo, λ = 0,5 ± j1,94 ms⁻¹, una oscilación que crece, como la del RLC con resistencia negativa. M₃: determinante −6, negativo: inestable sin oscilación, con λ = 3 y −2 ms⁻¹; un autovalor positivo y otro negativo, el comportamiento de un biestable.
  ]

  #solucion("ej-0.13")[
    Diagonal: la resistencia total de cada malla; fuera: menos la compartida. (6, −4, 0; −4, 10, −4; 0, −4, 6)·(I₁; I₂; I₃) = (12; 0; −6). Fila 2 menos (−4/6) por la fila 1: 7,333·I₂ − 4·I₃ = 8. Fila 3 menos (−4/7,333) = −0,545 por la nueva fila 2: 3,818·I₃ = −1,636, I₃ = −0,4286 mA. Hacia atrás: I₂ = (8 + 4 × (−0,4286))/7,333 = 0,8571 mA e I₁ = (12 + 4 × 0,8571)/6 = 2,571 mA (18/7, 6/7 y −3/7 mA exactos). No hace falta pivotar: la diagonal domina en cada fila. El determinante es el producto de los pivotes, 6 × 7,333 × 3,818 = 168. ngspice da lo mismo: 6,857 V en el nodo común de R₂ y 5,143 V en el de R₄.
  ]

  #solucion("ej-0.14")[
    La matriz es simétrica con autovalores 2, 6 y 14 kΩ: κ = 14/2 = 7, menos de una cifra. Con 400 kΩ, (402, −400, 0; −400, 802, −400; 0, −400, 402), autovalores 2, 402 y 1 202: κ = 601, casi tres cifras en juego. Las tres mallas comparten casi toda su resistencia y sus ecuaciones son casi iguales; las corrientes de R₂ y R₄ (0,025 y 0,020 mA) salen de restar corrientes de malla casi iguales (1,023, 0,998 y 0,978 mA). Por nudos, (1,0025, −0,5; −0,5, 1,0025) mS·(V#sub[a]\; V#sub[b]) = (6; 3) mA, con autovalores 0,5025 y 1,5025 mS: κ = 2,99, y V#sub[a] = 9,954 V, V#sub[b] = 7,957 V. El condicionamiento es de las ecuaciones, no del circuito: el mismo circuito escrito por nudos no pierde nada, y es la formulación que usan los simuladores.
  ]

  #solucion("ej-0.15")[
    En 0,6 V: I₀ = 10⁻¹²·(e#super[0,6/0,02585] − 1) = 12,03 mA y g₀ = I#sub[S]/V#sub[T]·e#super[v₀/V#sub[T]] = 0,4655 S (2,15 Ω), con una fuente de I₀ − g₀·v₀ = −267,2 mA. El circuito lineal: (2 − v)/100 = 12,03 mA + 0,4655·(v − 0,6) da v₁ = 0,604139 V. Siguientes: v₂ = 0,603847 V y v₃ = 0,603845 V. La solución es 0,603845 V y 13,96 mA (ngspice, a 300 K: 0,60389 V). Errores: 3,8·10⁻³, 2,9·10⁻⁴, 1,6·10⁻⁶ y 5·10⁻¹¹ V: cada uno es del orden de 19 veces el cuadrado del anterior, la convergencia cuadrática. Desde 0,7 V harían falta siete iteraciones, bajando poco más de V#sub[T] en cada una.
  ]

  #solucion("ej-0.16")[
    En 0 V la conductancia del diodo es 3,9·10⁻¹¹ S, despreciable frente a 10⁻⁴ S: el primer paso resuelve casi el circuito sin diodo y lleva a v₁ = 10,0 V. Desde ahí, como f/f′ ≈ V#sub[T], cada iteración baja 25,85 mV: (10 − 0,534)/0,02585 ≈ 366 iteraciones; en la cuenta exacta, 370, casi cuatro veces el límite de SPICE, que daría «no convergence». Con la limitación, el primer paso queda en V#sub[T]·ln(10/V#sub[T]) = 0,154 V, y la solución, 0,5343 V y 0,947 mA, llega en seis iteraciones.
  ]

  #solucion("ej-0.17")[
    Euler implícito: v#sub[n+1] = L·(i#sub[n+1] − i#sub[n])/h, es decir, una resistencia L/h en serie con una fuente de tensión −(L/h)·i#sub[n] o, en Norton, una conductancia h/L en paralelo con una fuente de corriente i#sub[n]. Trapecio: (v#sub[n+1] + v#sub[n])/2 = L·(i#sub[n+1] − i#sub[n])/h, que da i#sub[n+1] = (h/(2·L))·v#sub[n+1] + i#sub[n] + (h/(2·L))·v#sub[n]: resistencia 2·L/h y una fuente que recuerda la corriente y la tensión anteriores. Con L = 1 mH y h = 1 µs: 1 kΩ y 2 kΩ. En el RL (τ = 100 µs, final 1 A), Euler implícito da 9,901 y 19,704 mA tras uno y dos pasos; el trapecio, 9,950 y 19,801 mA; la exacta, 9,950 y 19,801 mA.
  ]

  #solucion("ej-0.18")[
    Acaba en el punto de trabajo del diodo con 5 V y 1 kΩ: 0,5741 V (4,43 mA), el de la sección. El paso: (C/h)·(v − 0,5) = (5 − v)/R − I#sub[S]·(e#super[v/V#sub[T]] − 1), con C/h = 0,1 S, que pesa cien veces más que 1/R. Con Newton desde 0,5 V (residuo −4,25 mA, derivada 0,1107 S): 0,53837, 0,53500, 0,534939 V y ahí se queda. Sin el diodo el paso daría 0,5446 V; el exacto (la ecuación integrada con mucha precisión) es 0,5388 V, así que Euler implícito se queda 3,9 mV corto en un paso, y el diodo frena el condensador desde ese momento: a los 0,2 ms ya está en 0,5741 V.
  ]

  #solucion("ej-0.19")[
    A = (1/τ)·(−2, 1, 0; 1, −2, 1; 0, 1, −1), con τ = 10 ms. En la variable x = λ·τ, el polinomio característico es x³ + 5·x² + 6·x + 1 = 0, con raíces −0,198, −1,555 y −3,247: λ = −19,8, −155,5 y −324,7 s⁻¹, y constantes de tiempo de 50,5, 6,43 y 3,08 ms. Suman 60,0 ms, el retardo de Elmore: R·(3·C) + R·(2·C) + R·C = 6·τ. Euler explícito exige h ≤ 2/324,7 s⁻¹ = 6,16 ms, y la rigidez es 324,7/19,8 = 16,4: un circuito nada rígido, que cualquier método resuelve.
  ]
]

// ============================================================================================ PARTE 5
// (optional, comments only) for the chapter's paratexto (paratexto/cap00.typ: resumen-capitulo, formulas-capitulo,
// terminos-clave). Proposed sentences for the summary, after the one on 0.12:
//   «Los autovalores de la matriz de estado son los modos naturales del circuito (sus polos): deciden la forma de la
//   respuesta y su estabilidad, y en 2×2 salen de la traza y el determinante. Un simulador resuelve un transitorio con
//   tres métodos uno dentro de otro: integración implícita (modelos de compañía), Newton-Raphson (cada semiconductor por
//   su tangente) y eliminación gaussiana con pivotaje; el número de condición dice cuántas cifras se pueden perder, y
//   los errores de SPICE nombran uno de los tres.»
// Formula card (three entries, label, formula, section):
//   [Autovalores de una matriz 2×2]   $ λ = (op("tr") A)/2 plus.minus sqrt(((op("tr") A)/2)^2 - det A) $
//   [Paso de Newton-Raphson]          $ v_(k+1) = v_k - f(v_k)/(f'(v_k)) $
//   [Número de condición]             $ κ = norm(G) dot.op norm(G^(-1)) = λ_"máx"/λ_"mín" $
// Key terms: «Autovalor», «Modo natural», «Factorización LU», «Pivotaje», «Número de condición», «Newton-Raphson»,
//   «Modelo de compañía», «Rigidez».
