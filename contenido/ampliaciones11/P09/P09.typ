// P09 — «Del Campo a la Onda: las Ecuaciones de Maxwell»: a new first section of chapter 35 (cap36.typ),
// «Radiofrecuencia y Líneas de Transmisión», for «Electrónica Práctica Avanzada». Three parts (see NOTAS.md):
//   PARTE 1  the section, new 35.1: right after the chapter's opening paragraph («Hasta ahora un cable ha sido un
//            nudo…») and before «== Cuando el Cable Deja de Ser un Cable <sec-36.1>», which becomes 35.2.
//   PARTE 2  nine exercises: inside the chapter's #ejercicios[…], after the exercise labelled <ej-36.5>.
//   PARTE 3  their solutions: inside #soluciones[…], after #solucion("ej-36.5")[…].
// Numbers: sections 35.1-35.13 become 35.2-35.14; the three new figures are 35.1-35.3 and the old 35.1-35.15
// become 35.4-35.18; the new tables are unnumbered, so table 35.1 keeps its number; exercises 35.6-35.14.
// Every number comes from scripts/calculos.py (datos/calculos.json); the line delays and the 50 ohm plateau also
// from ngspice (spice/, spice_comprobar.py).

// ============================================================================================ PARTE 1
== Del Campo a la Onda: las Ecuaciones de Maxwell <sec-new-36-maxwell>

El libro ha usado los campos cada vez que un componente los necesitaba: el eléctrico del dieléctrico para la capacidad (sección #nr("sec-3.1")), el magnético y la inducción para la bobina (sección #nr("sec-4.1")), la corriente que se refugia en la superficie de un conductor (sección #nr("sec-1.14")) y el aviso de que Kirchhoff solo vale mientras el circuito es pequeño frente a la longitud de onda (sección #nr("sec-23.2")). Esta sección junta esas piezas en las cuatro ecuaciones de Maxwell y saca de ellas lo que el resto del capítulo da por supuesto: que una perturbación del campo viaja a la velocidad de la luz, que una línea de transmisión es una guía para esa onda y que una antena es el lugar donde la onda se suelta de la línea.

=== Las magnitudes del campo

Cada campo se describe con dos vectores (en negrita), uno para su efecto y otro para su fuente, y los relaciona el material, con las mismas ε y µ que fijan la capacidad y la inductancia:

#tabla(none, columns: 3, align: (left, left, left,),
  [Magnitud], [Símbolo y relación], [Unidad SI],
  [Campo eléctrico], [#strong[E]], [V/m],
  [Desplazamiento eléctrico], [#strong[D] = ε·#strong[E]], [C/m²],
  [Campo magnético], [#strong[H]], [A/m],
  [Densidad de flujo magnético], [#strong[B] = µ·#strong[H]], [T = Wb/m² = V·s/m²],
  [Densidad de corriente], [#strong[J] = σ·#strong[E]], [A/m²],
  [Densidad de carga], [ρ#sub[v]], [C/m³],
)

El material entra con ε = ε#sub[0]·ε#sub[r] (F/m), µ = µ#sub[0]·µ#sub[r] (H/m) y σ = 1/ρ (S/m), con las constantes del apéndice #nr("ap-C"): ε#sub[0] = 8,854 × 10⁻¹² F/m y µ#sub[0] = 1,257 × 10⁻⁶ H/m. La densidad de carga lleva el subíndice v para no confundirla con la resistividad ρ.

=== La ley de Gauss: la carga es la fuente del campo eléctrico

El flujo del desplazamiento que sale de cualquier superficie cerrada es igual a la carga que hay dentro:

#ec[$ integral.surf_S bold(D) dot.op d bold(A) = Q_"int" $]

La superficie es imaginaria y se elige de modo que, por simetría, el campo sea uniforme y perpendicular a ella: la integral se convierte en un producto y el campo sale despejado. En el condensador de placas se envuelve la placa positiva (figura #nr("fig-new-36-gauss")a); el campo solo atraviesa la cara que mira a la otra placa, D·A = Q, E = Q/(ε·A), y con V = E·d sale C = ε·A/d, la fórmula de la sección #nr("sec-3.1"). Con las placas de 1 cm² y 10 µm de aire de aquella sección y 10 V, E = 1 MV/m, D = ε#sub[0]·E = 8,85 µC/m² y la carga es D·A = 885 pC, exactamente C·V con C = 88,5 pF.

En un coaxial la superficie es un cilindro de radio r alrededor del vivo (figura #nr("fig-new-36-gauss")c). Con Q' culombios por metro, D·2πr = Q': el campo es radial y decrece como 1/r, y su integral entre el radio a del vivo y el radio b de la malla da la tensión y, con ella, la capacidad por metro:

#ec[$ E(r) = Q'/(2π dot.op ε dot.op r) quad quad C' = (2π dot.op ε)/ln(b \/ a) $]

Para #strong[B] el flujo que sale es siempre cero: no hay cargas magnéticas, y todo el flujo que entra en un núcleo sale de él, como la corriente del circuito magnético de la sección #nr("sec-4.10").

=== La ley de Ampère: la corriente es la fuente del campo magnético

La circulación de #strong[H] por un camino cerrado es igual a la corriente que atraviesa cualquier superficie apoyada en él:

#ec[$ integral.cont_C bold(H) dot.op d bold(l) = I_"int" $]

Alrededor de un hilo recto el camino es una circunferencia (figura #nr("fig-new-36-gauss")b): H·2πr = I. Con 10 A a 1 cm, H = 159 A/m y B = µ#sub[0]·H = 200 µT, cuatro veces el campo terrestre: por eso una sonda Hall que abraza un conductor mide su corriente. En un solenoide, H·l = N·I da B = µ#sub[0]·µ#sub[r]·N·I/l, y con N·Φ = L·i, la inductancia: el de la sección #nr("sec-4.1") (100 espiras, 5 cm, 1 cm², sin núcleo) tiene 2,51 mT con 1 A, 0,251 µWb por espira y 25,1 µH. La fórmula de la inductancia es Ampère más Faraday.

En el coaxial, entre los conductores solo cuenta la corriente del vivo; fuera de la malla, la circunferencia abraza la ida y la vuelta, que suman cero, y no hay campo: es el «el campo no sale» de la sección #nr("sec-36.2"). El flujo por metro entre a y b da la inductancia por metro:

#ec[$ H(r) = I/(2π dot.op r) quad quad L' = µ/(2π) dot.op ln(b \/ a) $]

#figura("campo-gauss-ampere.svg", 100%, [Las superficies y los caminos que convierten las leyes de Gauss y de Ampère en fórmulas de componentes. a) La superficie que envuelve la placa positiva da E = Q/(ε·A) y la capacidad; entre las placas no circula carga, pero sí la corriente de desplazamiento. b) La circunferencia alrededor de un hilo da H = I/(2π·r). c) En un coaxial, el campo eléctrico es radial y el magnético forma círculos: los dos están solo en el dieléctrico, y por él viaja la energía.]) <fig-new-36-gauss>

=== La corriente de desplazamiento

La ley de Faraday de la sección #nr("sec-4.1"), escrita con campos, dice que la circulación de #strong[E] por un camino cerrado es menos la derivada del flujo de #strong[B] que lo atraviesa, haya o no un conductor en ese camino. La de Ampère, tal cual, se contradice en cuanto hay un condensador: sobre el hilo que lo carga se apoya una circunferencia, y un disco que corta el hilo encierra la corriente i, mientras que una bolsa que pasa entre las placas no corta ningún conductor y encierra cero.

Maxwell lo resolvió sumando a la corriente de conducción la variación del flujo de #strong[D]. Entre las placas ese flujo es D·A = Q, y su derivada, dQ/dt = i:

#ec[$ i_"d" = d/(d t) integral.double_S bold(D) dot.op d bold(A) = ε dot.op A dot.op (d E)/(d t) = C dot.op (d v)/(d t) $]

Es la corriente que i = C·dv/dt atribuye al condensador: la de conducción de los hilos sigue por el dieléctrico como #strong[corriente de desplazamiento], y el circuito se cierra sin que ninguna carga atraviese el aislante. No es un artificio: es la que se escapa por las capacidades parásitas (sección #nr("sec-23.2")), y los 1,65 mA que un flanco de 3,3 V en 2 ns inyecta a través de 1 pF en la sección #nr("sec-32.8") cruzan el aire de esa forma. En un material conviven las dos, σ·E de conducción y ω·ε·E de desplazamiento; en el cobre a 1 GHz la primera es 1,0 × 10⁹ veces mayor, y en un dieléctrico solo existe la segunda.

=== Las cuatro ecuaciones

Con ese término, las cuatro leyes forman un sistema completo. En forma integral, la que se aplica a un componente:

#ec[$ integral.surf_S bold(D) dot.op d bold(A) &= Q_"int" & quad quad integral.cont_C bold(E) dot.op d bold(l) &= - d/(d t) integral.double_S bold(B) dot.op d bold(A) \
  integral.surf_S bold(B) dot.op d bold(A) &= 0 & quad quad integral.cont_C bold(H) dot.op d bold(l) &= I_"int" + d/(d t) integral.double_S bold(D) dot.op d bold(A) $]

Haciendo el volumen o la superficie infinitamente pequeños (teoremas de Gauss y de Stokes) se obtiene la forma diferencial, válida en cada punto: la divergencia ∇· mide cuánto campo nace en un punto por unidad de volumen, y el rotacional ∇×, cuánto gira a su alrededor por unidad de área.

#ec[$ nabla dot.op bold(D) &= ρ_"v" & quad quad nabla times bold(E) &= - (partial bold(B))/(partial t) \
  nabla dot.op bold(B) &= 0 & quad quad nabla times bold(H) &= bold(J) + (partial bold(D))/(partial t) $]

Las unidades cuadran término a término: ∇×#strong[H], #strong[J] y la derivada de #strong[D] están en A/m². Con #strong[D] = ε·#strong[E], #strong[B] = µ·#strong[H] y #strong[J] = σ·#strong[E], las fuentes determinan los campos.

#nota[
  Kirchhoff es este sistema simplificado: la ley de mallas es Faraday con el flujo encerrado en las bobinas, y la de nudos, la conservación de la carga con el desplazamiento encerrado en los condensadores. Cuando uno de los dos se escapa, Kirchhoff falla (sección #nr("sec-23.2")).
]

=== La onda plana

Sin cargas ni corrientes, las dos ecuaciones del rotacional se alimentan una a otra: un campo eléctrico que cambia crea campo magnético, y uno magnético que cambia crea campo eléctrico. El resultado es una perturbación que se propaga sola.

#deduccion[La ecuación de onda][
  Para un campo eléctrico según x y uno magnético según y que solo dependen de z y de t, Faraday y Ampère-Maxwell sin corriente de conducción se reducen a:

  #eclabel[#strong[Ec. 1 — Las dos leyes del rotacional]]
  #ec[$ (partial E_x)/(partial z) = - µ dot.op (partial H_y)/(partial t) quad quad (partial H_y)/(partial z) = - ε dot.op (partial E_x)/(partial t) $]

  Derivando la primera respecto a z y sustituyendo la segunda:

  #eclabel[#strong[Ec. 2 — Ecuación de onda]]
  #ec[$ (partial^2 E_x)/(partial z^2) = µ dot.op ε dot.op (partial^2 E_x)/(partial t^2) $]

  La cumple cualquier perfil E#sub[x] = f(z − v·t) que avanza sin deformarse con v = 1/√(µ·ε). Llevándolo a la Ec. 1 sale H#sub[y] = E#sub[x]/√(µ/ε): los dos campos van en fase y su cociente es una constante del medio.
]

En el vacío esa velocidad y ese cociente valen

#ec[$ c = 1/sqrt(µ_0 dot.op ε_0) = "299 792 458 m/s" quad quad η_0 = E/H = sqrt(µ_0/ε_0) = "376,7 Ω" approx 120 π $]

La velocidad de la luz sale de dos constantes que se miden con condensadores y bobinas, y así concluyó Maxwell que la luz es una onda electromagnética. η#sub[0] es la #strong[impedancia del vacío], los 377 Ω con los que la sección #nr("sec-36.8") presenta la antena como un adaptador; es un cociente de V/m entre A/m y, como la Z#sub[0] de una línea, no disipa nada. Una onda de 1 V/m lleva 2,65 mA/m. La onda es transversal: #strong[E] y #strong[H] son perpendiculares entre sí y a la dirección de avance (figura #nr("fig-new-36-onda")). En un medio,

#ec[$ v = c/sqrt(ε_r dot.op µ_r) quad quad η = η_0 dot.op sqrt(µ_r / ε_r) quad quad λ = v/f $]

con µ#sub[r] = 1 en los dieléctricos. La luz recorre 30 cm por nanosegundo; en polietileno (ε#sub[r] = 2,25) la onda va a 0,667 c con η = 251,2 Ω, y en FR4 (ε#sub[r] = 4,4), a 0,477 c, 14,3 cm/ns, con η = 179,6 Ω, que es la velocidad que la sección #nr("sec-36.8") da para una antena impresa con todo el campo en el sustrato. En el agua, con ε#sub[r] = 81 a baja frecuencia, v = c/9 y η = 41,9 Ω.

#figura("onda-plana.svg", 71%, [Onda plana que avanza según z. El campo eléctrico y el magnético son perpendiculares entre sí y a la dirección de avance, van en fase y su cociente es la impedancia del medio, 376,7 Ω en el vacío. La potencia viaja en la dirección del vector de Poynting.]) <fig-new-36-onda>

=== De la onda a la línea de transmisión

En un coaxial, el campo eléctrico radial y el magnético circular son perpendiculares entre sí y al eje, igual que en la onda plana: la línea es una guía para esa misma onda (el modo #strong[TEM], transversal electromagnético). Integrando #strong[E] entre los conductores sale la tensión, y circulando #strong[H] alrededor del vivo, la corriente; las dos leyes del rotacional se convierten en las #strong[ecuaciones del telegrafista]:

#ec[$ (partial v)/(partial z) = - L' dot.op (partial i)/(partial t) quad quad (partial i)/(partial z) = - C' dot.op (partial v)/(partial t) $]

Son la Ec. 1 de la deducción con v en lugar de E#sub[x], i en lugar de H#sub[y], L' en lugar de µ y C' en lugar de ε, y tienen la misma solución: una onda de tensión y corriente que avanza con velocidad 1/√(L'·C') y un cociente tensión/corriente constante, la Z#sub[0] = √(L'/C') de la sección #nr("sec-36.1"). Con la C' de Gauss y la L' de Ampère:

#ec[$ Z_0 = η/(2π) dot.op ln(b \/ a) = 60/sqrt(ε_r) dot.op ln(b \/ a) " Ω" quad quad v = 1/sqrt(L' dot.op C') = c/sqrt(ε_r) $]

L'·C' vale µ·ε sea cual sea la geometría: la velocidad la decide solo el dieléctrico, y la geometría, la impedancia. Para 50 Ω con polietileno macizo hace falta ln(b/a) = 1,251, b/a = 3,49 (vivo de 0,45 mm de radio y dieléctrico de 1,57 mm de radio); entonces C' = 100 pF/m, L' = 250 nH/m y v = 20 cm/ns, 5,00 ns por metro.

#comprobacion[
  Un metro de ese coaxial como una escalera de 200 celdas de L'·Δz y C'·Δz, excitado en ngspice con un escalón de 1 V a través de 50 Ω: la entrada se queda en 0,500 V (la línea presenta 50 Ω), el escalón llega al extremo 5,00 ns después y, con el extremo abierto, la salida sube a 1,00 V y la reflexión vuelve a la entrada a los 10,03 ns. Es la reflectometría de la sección #nr("sec-36.2") obtenida desde las ecuaciones de Maxwell; la línea ideal de ngspice (elemento T) da 5,00 y 10,01 ns.
]

=== Hasta dónde entra la onda en un conductor

En un buen conductor la ley de Ampère-Maxwell se queda en ∇×#strong[H] = σ·#strong[E]\; la ecuación de onda se convierte en una de difusión y el campo, con su corriente, decae como e#super[−z/δ] desde la superficie, con

#ec[$ δ = 1/sqrt(π dot.op f dot.op µ dot.op σ) = sqrt(ρ/(π dot.op f dot.op µ)) $]

la profundidad de penetración de la sección #nr("sec-1.14"), aquí como la forma que toma la onda dentro del metal (la solución completa, con la corriente de desplazamiento, da los mismos 2,087 µm en el cobre a 1 GHz). Dos consecuencias:

- #strong[La pérdida del coaxial crece con √f.] La corriente ocupa una capa δ en el vivo y en la malla: R' = R#sub[s]·(1/a + 1/b)/(2π), con R#sub[s] = √(π·f·µ·ρ). En el coaxial anterior, a 100 MHz, R#sub[s] = 2,61 mΩ y R' = 1,19 Ω/m, 10,3 dB cada 100 m; a 1 GHz, √10 veces más, 32,6 dB. Es cobre liso: la malla trenzada y el dieléctrico añaden pérdidas, pero no cambian la ley de √f.
- #strong[La absorción de una pantalla depende de su espesor medido en δ] (sección #nr("sec-32.7")). A 100 MHz, una lámina de cobre de 0,1 mm son 15 δ y absorbe unos 132 dB; a 50 Hz, en aluminio, δ = 11,6 mm, y una chapa de 1 mm no llega a una décima de δ: el campo de un transformador la atraviesa.

=== De la línea a la antena: campo cercano y campo lejano

Si los conductores de la línea se separan, como en un dipolo, el campo ya no queda encerrado. El de un elemento corto de corriente tiene tres términos, en 1/r³, 1/r² y 1/r (figura #nr("fig-new-36-cercano")b): los dos primeros son el campo cuasiestático de un condensador y de una bobina, que se queda junto a la fuente y le devuelve su energía en cada ciclo; el tercero es la onda que se va. Pesan lo mismo a la distancia r = λ/2π, que separa el #strong[campo cercano] del #strong[campo lejano]:

#tabla(none, columns: 4, align: (left, right, right, right,),
  [Frecuencia], [λ (vacío)], [λ/2π], [δ (cobre)],
  [50 Hz], [5 996 km], [954 km], [9,33 mm],
  [1 MHz], [300 m], [47,7 m], [66,0 µm],
  [13,56 MHz], [22,1 m], [3,52 m], [17,9 µm],
  [100 MHz], [3,00 m], [47,7 cm], [6,60 µm],
  [868 MHz], [34,5 cm], [5,50 cm], [2,24 µm],
  [2,4 GHz], [12,5 cm], [1,99 cm], [1,35 µm],
)

A 50 Hz todo es campo cercano: un transformador no radia, acopla (sección #nr("sec-32.8")); y un lector NFC de 13,56 MHz, a pocos centímetros y muy dentro de sus 3,52 m, son dos bobinas acopladas, no una radio.

El cociente E/H, la #strong[impedancia de onda], solo vale η#sub[0] en el campo lejano (figura #nr("fig-new-36-cercano")a). Cerca de una fuente eléctrica (un dipolo, un cable abierto, un nudo con mucho dv/dt) es mayor, ≈ η#sub[0]·λ/(2π·r); cerca de una magnética (un bucle, un lazo de corriente con mucho di/dt), menor, ≈ η#sub[0]·2π·r/λ. A 100 MHz y 1 cm, 18,0 kΩ y 7,9 Ω. De ahí la asimetría de la sección #nr("sec-32.7"): una pantalla de miliohmios refleja casi todo un campo de 18 kΩ, muy desadaptado respecto a ella, y bastante menos uno de 8 Ω. Y de ahí que una sonda de campo cercano diga dónde está la fuente y no cuánto llegará a 3 m (sección #nr("sec-32.13")): mide un campo que en su mayor parte no se va.

#figura("campo-cercano.svg", 100%, [a) Impedancia de onda frente a la distancia, en unidades de λ/2π, para una fuente eléctrica y otra magnética; la escala superior la traduce a distancias a 100 MHz. Las dos tienden a η#sub[0] = 377 Ω pasado el límite del campo cercano. b) Peso relativo de los tres términos del campo eléctrico de un dipolo corto, que se igualan en r = λ/2π.]) <fig-new-36-cercano>

=== El vector de Poynting y la potencia radiada

La potencia que transporta el campo, por unidad de área y en la dirección en que viaja, es el #strong[vector de Poynting]:

#ec[$ bold(S) = bold(E) times bold(H) quad lr([ "W/m²" ]) $]

Integrado sobre una superficie cerrada da la potencia que sale de ella. En el coaxial, su flujo por la corona entre a y b es exactamente V·I (con 10 V y 0,2 A, la integral da 2,000 W): la energía viaja por el dieléctrico, como la del condensador estaba en el campo (sección #nr("sec-3.1")), y los conductores la guían y se quedan solo con sus pérdidas.

En el campo lejano, E = η#sub[0]·H y S = E²/η#sub[0] con valores eficaces, y una fuente isótropa reparte su potencia sobre una esfera:

#ec[$ S = P/(4π dot.op r^2) quad quad E = sqrt(η_0 dot.op P/(4π))/r approx sqrt(30 dot.op P)/r $]

Un vatio a 1 km deja 79,6 nW/m² y 5,48 mV/m. Una antena receptora entrega esa densidad multiplicada por su #strong[área efectiva], A#sub[e] = G·λ²/(4π): 94,9 cm² para una isótropa a 868 MHz y solo 12,4 cm² a 2,4 GHz. Juntando las dos fórmulas sale la de Friis,

#ec[$ P_"r"/P_"t" = G_"t" dot.op G_"r" dot.op (λ/(4π dot.op d))^2 $]

cuyo logaritmo es la pérdida en espacio libre de la sección #nr("sec-36.12"). Leída así se ve de dónde salen los 6 dB por cada vez que se dobla la frecuencia: la densidad de potencia a una distancia dada no depende de f; lo que encoge con λ² es el área efectiva de una antena de la misma ganancia.

#ejemplo[
  El enlace a 868 MHz de la sección #nr("sec-36.12"), visto como campo. \ Sale de la antena el equivalente de 14 − 1 + 2 = 15 dBm isótropos, 31,6 mW. A 1 km, S = 31,6 mW/(4π·(1 km)²) = 2,52 nW/m² y E = √(S·η#sub[0]) = 0,974 mV/m (59,8 dBµV/m). \ La antena receptora de 2 dBi tiene A#sub[e] = 1,585 × (34,5 cm)²/(4π) = 150 cm² y recoge 2,52 nW/m² × 150 cm² = 37,9 pW, −74,2 dBm: el nivel de la tabla de aquella sección antes del cable de recepción. El balance en decibelios es el vector de Poynting escrito en logaritmos.
]

La misma integral sobre la esfera da la potencia que radia un elemento de corriente de longitud l, y su #strong[resistencia de radiación], P = I#sub[ef]²·R#sub[rad]:

#ec[$ R_"rad" = 80 π^2 dot.op (l/λ)^2 approx 790 dot.op (l/λ)^2 $]

con corriente uniforme; en un dipolo corto real se anula en las puntas y queda la cuarta parte. Uno de 2 cm a 433 MHz (λ = 69,2 cm) tiene 0,165 Ω y necesita 246 mA para radiar 10 mW, frente a 11,7 mA en un dipolo de media onda (la integral del campo exacto le da los 73,1 Ω y 2,15 dBi de la sección #nr("sec-36.8")). Con veintiuna veces más corriente, unas décimas de ohmio en serie (la bobina de adaptación, un contacto) disipan tanto como lo que se radia: por eso una antena pequeña funciona mal.

El caso dual es el bucle pequeño: su campo lejano es E = η#sub[0]·π·A·I/(λ²·r), y con λ = c/f,

#ec[$ E = (π dot.op η_0)/c^2 dot.op f^2 dot.op A dot.op I/r = "1,317" times 10^(-14) dot.op f^2 dot.op A dot.op I/r $]

la fórmula de la sección #nr("sec-32.8"), que redondea el coeficiente a 1,3 × 10⁻¹⁴: no es empírico, son η#sub[0], π y c. En su ejemplo (1 cm², 40 mA, 100 MHz, 3 m) da 176 µV/m frente a 173, y vale porque 3 m está más allá de los 47,7 cm de λ/2π; a 1 cm de una sonda, no.

=== En el banco

Con la reflectometría de la sección #nr("sec-36.2") y un coaxial abierto de longitud conocida, el tiempo de ida y vuelta da v, y (c/v)² la ε#sub[r] del dieléctrico: el polietileno macizo da 0,667 c, 10 ns de ida y vuelta por metro, y la espuma, en torno a 0,8 c. Y una sonda de bucle, que responde a #strong[H], frente a un trozo de vivo sin malla, que responde a #strong[E], dice si el culpable de una emisión es un lazo con mucho di/dt o un nudo con mucho dv/dt (sección #nr("sec-32.8")).

// Suggested additions to the chapter's #tarjeta (in 35.13, now): the three key formulas of this section
//   #formula($ c = 1/sqrt(µ_0 dot.op ε_0) quad quad η_0 = sqrt(µ_0/ε_0) = "376,7 Ω" $)
//   #formula($ Z_0 = 60/sqrt(ε_r) dot.op ln(b \/ a) " Ω" quad quad v = c/sqrt(ε_r) $)
//   #formula($ r = λ/(2π) quad quad S = P/(4π dot.op r^2) $)

// ============================================================================================ PARTE 2
#ejercicios[
  #ejercicio[
    Un condensador de placas de 2 cm² tiene un dieléctrico de PTFE (ε#sub[r] = 2,1) de 0,1 mm y está cargado a 50 V. Con la ley de Gauss, calcula E y D en el dieléctrico, la carga de cada placa y la capacidad. ¿Cambiaría E si el dieléctrico fuera aire, con la misma tensión?
  ] <ej-36.6>

  #ejercicio[
    Por un cable de alimentación circulan 25 A. ¿A qué distancia del conductor el campo B baja a 50 µT, el valor del campo terrestre? ¿Cuánto vale a 5 cm? Si el conductor de retorno va a 1 cm del de ida, ¿qué campo queda a 5 cm del de ida, en la línea que une ambos y por el lado opuesto al retorno?
  ] <ej-36.7>

  #ejercicio[
    a) Un condensador cerámico de 100 pF, con placas equivalentes de 1 cm², recibe una tensión senoidal de 5 V de pico a 1 MHz. Calcula el pico de la corriente de desplazamiento en el dieléctrico y su densidad. b) El agua de mar tiene σ ≈ 4 S/m y ε#sub[r] ≈ 81. ¿A qué frecuencia son iguales la corriente de conducción y la de desplazamiento? ¿Cuánto penetra una onda de 10 kHz, y por qué se comunica con los submarinos en frecuencias muy bajas?
  ] <ej-36.8>

  #ejercicio[
    Una onda plana de 1 GHz viaja por polietileno (ε#sub[r] = 2,25). Calcula su velocidad, su longitud de onda y la impedancia del medio. Si el campo eléctrico vale 10 V/m eficaces, ¿cuánto valen H y la densidad de potencia?
  ] <ej-36.9>

  #ejercicio[
    Se quiere un coaxial de 75 Ω con dieléctrico de polietileno macizo. Calcula b/a, el diámetro del dieléctrico si el vivo tiene 1 mm de diámetro, C', L' y el retardo por metro. Compáralo con el de 50 Ω de la sección: ¿qué ha cambiado y qué no? ¿Qué impedancia tendría la misma geometría con aire?
  ] <ej-36.10>

  #ejercicio[
    Calcula la profundidad de penetración en el cobre a 1 GHz. ¿Cuántas veces cabe en los 35 µm de cobre de una placa? Si el coaxial de 50 Ω de la sección pierde 10,3 dB cada 100 m a 100 MHz por el cobre, ¿cuánto pierde a 400 MHz y a 1 GHz? ¿Qué fracción de la potencia llega al final de 20 m a 1 GHz?
  ] <ej-36.11>

  #ejercicio[
    a) Un lector NFC de 13,56 MHz se comunica con una tarjeta a 4 cm. ¿Está en campo cercano o lejano? Estima la impedancia de onda junto a su antena de bucle. b) Un módulo wifi de 2,4 GHz está a 10 cm de un sensor. ¿Cuánto vale allí kr, y qué impedancia de onda verá el sensor si la fuente es eléctrica, y si es magnética?
  ] <ej-36.12>

  #ejercicio[
    En una placa, un bucle de 4 cm² lleva una componente de 20 mA a 200 MHz. Calcula el campo a 3 m con la fórmula del bucle pequeño, en µV/m y en dBµV/m, y comprueba que 3 m es campo lejano. ¿Cuántos dB supera los 100 µV/m que la sección #nr("sec-32.8") toma como referencia? ¿A qué área habría que reducir el bucle, o a qué corriente, para quedarse en ese valor?
  ] <ej-36.13>

  #ejercicio[
    Un transmisor de 5 W a 100 MHz alimenta un dipolo de media onda (2,15 dBi). A 2 km, en espacio libre, calcula la densidad de potencia, el campo eléctrico en mV/m y en dBµV/m, el área efectiva de otro dipolo de media onda y la potencia que este entrega a un receptor de 50 Ω, en nW, en dBm y como tensión eficaz. Comprueba el resultado con la pérdida en espacio libre.
  ] <ej-36.14>
]

// ============================================================================================ PARTE 3
#soluciones[
  #solucion("ej-36.6")[
    El campo es uniforme entre las placas: E = V/d = 50 V/0,1 mm = 500 kV/m. Por Gauss, D = ε#sub[0]·ε#sub[r]·E = 8,854 × 10⁻¹² × 2,1 × 500 000 = 9,30 µC/m², y la carga es Q = D·A = 9,30 µC/m² × 2 cm² = 1,86 nC. La capacidad, Q/V = 37,2 pF, la misma que da ε·A/d. Con aire y la misma tensión el campo no cambia, porque E = V/d solo depende de la tensión y de la distancia; lo que baja 2,1 veces es D, y con él la carga y la capacidad.
  ]

  #solucion("ej-36.7")[
    B = µ#sub[0]·I/(2π·r), luego r = µ#sub[0]·I/(2π·B) = (4π × 10⁻⁷ × 25)/(2π × 50 × 10⁻⁶) = 0,10 m: a 10 cm el cable ya iguala el campo terrestre. A 5 cm, 100 µT. Con el retorno a 1 cm, en ese punto el retorno está a 6 cm y su campo tiene sentido contrario: B = 2 × 10⁻⁷ × 25 × (1/0,05 − 1/0,06) = 16,7 µT, seis veces menos. Llevar la ida junto a la vuelta, o trenzarlas, es lo que anula el campo exterior, el mismo principio que hace que el coaxial no tenga campo fuera.
  ]

  #solucion("ej-36.8")[
    a) i#sub[d] = C·dv/dt, y con v = 5·sen(ωt) el pico es C·ω·V#sub[p] = 100 pF × 2π × 1 MHz × 5 V = 3,14 mA. Su densidad en el dieléctrico es 3,14 mA/1 cm² = 31,4 A/m², sin que ninguna carga lo atraviese. b) Son iguales cuando σ = ω·ε, es decir f = σ/(2π·ε#sub[0]·ε#sub[r]) = 4/(2π × 8,854 × 10⁻¹² × 81) = 888 MHz: por debajo el agua de mar es un conductor, por encima un dieléctrico con pérdidas. A 10 kHz la conducción domina (el cociente vale 88 766) y δ = 1/√(π·f·µ#sub[0]·σ) = 2,52 m; a 1 MHz, solo 25,2 cm. Como la señal cae e veces cada δ, solo las frecuencias muy bajas llegan a unas decenas de metros de profundidad.
  ]

  #solucion("ej-36.9")[
    v = c/√2,25 = c/1,5 = 2,00 × 10⁸ m/s (20,0 cm/ns), λ = v/f = 20,0 cm (frente a 30,0 cm en el aire) y η = 376,7/1,5 = 251,2 Ω. Con E = 10 V/m, H = E/η = 39,8 mA/m y S = E²/η = 0,398 W/m².
  ]

  #solucion("ej-36.10")[
    Z#sub[0] = (60/√ε#sub[r])·ln(b/a), luego ln(b/a) = 75 × 1,5/60 = 1,876 y b/a = 6,53: con un vivo de 1 mm, el dieléctrico mide 6,53 mm de diámetro. C' = 2π·ε/ln(b/a) = 66,7 pF/m y L' = (µ#sub[0]/2π)·ln(b/a) = 375 nH/m. El retardo, √(L'·C') = 5,00 ns/m, es el mismo que en el de 50 Ω: la geometría cambia C' y L' en sentidos opuestos y su producto sigue siendo µ·ε. Con aire, la misma geometría daría 60 × 1,876 = 112,5 Ω (1,5 veces más) y una velocidad 1,5 veces mayor.
  ]

  #solucion("ej-36.11")[
    δ = √(ρ/(π·f·µ#sub[0])) = √(1,72 × 10⁻⁸/(π × 10⁹ × 4π × 10⁻⁷)) = 2,09 µm, así que los 35 µm del cobre de una placa son 16,8 δ: a 1 GHz la corriente solo usa la piel de la pista. La pérdida del conductor crece con √f: a 400 MHz, 10,3 × 2 = 20,6 dB/100 m; a 1 GHz, 10,3 × √10 = 32,6 dB/100 m. En 20 m a 1 GHz se pierden 6,51 dB y llega el 22,3 % de la potencia, sin contar la malla ni el dieléctrico, que en un cable real lo empeoran.
  ]

  #solucion("ej-36.12")[
    a) λ/2π = 3,52 m a 13,56 MHz, y 4 cm es la 88.ª parte: kr = 2π·r/λ = 0,0114, campo cercano profundo. Junto a un bucle, la impedancia de onda es ≈ η#sub[0]·kr = 377 × 0,0114 = 4,28 Ω (el cálculo exacto da lo mismo): un campo casi puramente magnético, el de dos bobinas acopladas. b) A 2,4 GHz, λ/2π = 1,99 cm y a 10 cm kr = 5,03: ya es campo lejano. La impedancia de onda vale 362 Ω si la fuente es eléctrica y 392 Ω si es magnética, a pocos por ciento de los 377 Ω de la onda plana.
  ]

  #solucion("ej-36.13")[
    E = 1,317 × 10⁻¹⁴ × (2 × 10⁸)² × 4 × 10⁻⁴ × 0,02/3 = 1,40 mV/m, 62,95 dBµV/m. A 200 MHz, λ/2π = 23,9 cm, y 3 m es más de doce veces esa distancia: la fórmula de campo lejano vale. Supera los 100 µV/m en 22,95 dB, catorce veces. Como E es proporcional a A·I, hace falta dividir el producto por 14: un bucle de 0,285 cm² con los mismos 20 mA, o el mismo bucle con 1,42 mA. Reducir el área es casi siempre lo más barato: llevar el retorno pegado a la ida, sobre un plano.
  ]

  #solucion("ej-36.14")[
    G = 10#super[0,215] = 1,641, y la potencia equivalente isótropa es 5 × 1,641 = 8,20 W. A 2 km, S = 8,20/(4π × 2 000²) = 163,2 nW/m² y E = √(S·η#sub[0]) = 7,84 mV/m (77,9 dBµV/m). Con λ = 3,00 m, A#sub[e] = 1,641 × 3,00²/(4π) = 1,17 m², y P#sub[r] = S·A#sub[e] = 191,5 nW, −37,2 dBm, que sobre 50 Ω son √(P·R) = 3,09 mV eficaces. Comprobación: la pérdida en espacio libre es 20·log(4π × 2 000/3,00) = 78,47 dB, y 37 dBm + 2,15 + 2,15 − 78,47 = −37,2 dBm.
  ]
]
