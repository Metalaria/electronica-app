// P06 — «Modelado de sistemas físicos y simulación por diagramas de bloques»: one new section of chapter 30
// (cap31.typ) for «Electrónica Práctica Avanzada», written after P05 (sections 30.10-30.12, labels sec-new-31-*).
// Four parts, each to be pasted in its own place (see NOTAS.md):
//   PARTE 1  the section: at the end of «Sintonía del PID: el Método de Ziegler-Nichols» <sec-31.11> (after its
//            figure <fig-31.20>) and before «== Ampliación: Control en Espacio de Estados <sec-31.12>».
//   PARTE 2  eight exercises: inside the chapter's #ejercicios[…], after <ej-31.17> (the last one of P05).
//   PARTE 3  their solutions: inside #soluciones[…], after #solucion("ej-31.17")[…].
//   PARTE 4  (comments only) proposals for the chapter's summary, formula card and key terms (paratexto).
// Numbers with P05 in place: section 30.15 (Espacio de estados, Detección de errores and Problemas de diseño become
// 30.16-30.18); figures 30.27-30.30 (the old 30.21-30.22 become 30.31-30.32); equations Ec. 8-11 (P05 has 1-7);
// exercises 30.18-30.25. Every number comes from scripts/calculos.py and every simulated value from the ngspice
// runs (scripts/spice_comprobar.py).

// ============================================================================================ PARTE 1
== Modelado de Sistemas Físicos y Simulación por Diagramas de Bloques <sec-new-31-modelado>

Todo el diseño de las secciones anteriores parte de una función de transferencia de la planta. La sección #nr("sec-31.2") la obtiene midiendo un escalón; esta la obtiene de la física, antes de tener la planta en el banco: con las ecuaciones de sus elementos, un diagrama de bloques y una simulación. Las tres cosas sirven también al revés, para comprobar que lo medido es lo que se esperaba.

=== Masa, muelle y amortiguador frente a L, C y R

Un sistema mecánico se describe con tres elementos, igual que un circuito: la #strong[masa] m almacena energía cinética, el #strong[muelle] de constante k almacena energía elástica y el #strong[amortiguador] de constante b la disipa con una fuerza proporcional a la velocidad (rozamiento viscoso). Una masa sujeta a una pared por un muelle y un amortiguador y empujada por una fuerza F cumple m·ẍ + b·ẋ + k·x = F, la misma ecuación del RLC de la sección #nr("sec-0.8"). Hay dos maneras de emparejar las magnitudes:

- #strong[Fuerza ↔ tensión] (analogía de impedancia): la velocidad es la corriente, la posición la carga, m ↔ L, b ↔ R y 1/k ↔ C. Los elementos que comparten velocidad quedan en serie: un RLC serie.
- #strong[Fuerza ↔ corriente] (analogía de movilidad, propuesta por Floyd Firestone en 1933): la velocidad es la tensión, m ↔ C, 1/b ↔ R y 1/k ↔ L. Los elementos que comparten velocidad cuelgan del mismo nudo, así que el circuito conserva la forma del sistema; y la masa va siempre a masa eléctrica, porque su velocidad se mide respecto al suelo.

La segunda es la que se usa en este libro, porque es la del modelo térmico de la sección #nr("sec-47.4"): una magnitud que se mide entre dos puntos (velocidad, temperatura) es una tensión, y una que atraviesa el elemento (fuerza, flujo de calor), una corriente.

#deduccion[La analogía de movilidad][
  #eclabel[#strong[Ec. 8 — El nudo y la masa]]
  #ec[$ m (d v)/(d t) + b dot.op v + k integral v thin d t = F quad arrow.l.r.double quad C (d V)/(d t) + V/R + 1/L integral V thin d t = I $]

  #strong[Origen.] A la izquierda, Newton para la masa con v = ẋ (el muelle hace k·x, con x la integral de v); a la derecha, Kirchhoff en el nudo de un RLC paralelo alimentado por una fuente de corriente. Término a término, V = v, I = F, C = m, R = 1/b y L = 1/k; la corriente de la bobina es la fuerza del muelle, y su energía ½·L·i#super[2] = ½·k·x#super[2], la elástica.

  #strong[Dominio de validez.] Muelle lineal (sin llegar al tope), rozamiento viscoso (el seco, de Coulomb, no es una resistencia) y masa rígida.
]

#tabla(none, columns: 5, align: (left, left, left, left, left),
  [Circuito], [Traslación], [Rotación], [Térmico], [Hidráulico],
  [tensión V], [velocidad v (m/s)], [velocidad angular ω (rad/s)], [temperatura (°C)], [presión p (Pa)],
  [corriente I], [fuerza F (N)], [par T (N·m)], [potencia P (W)], [caudal Q (m³/s)],
  [resistencia R], [1/b (b en N·s/m)], [1/B (B en N·m·s/rad)], [R#sub[th] (°C/W)], [estrechamiento],
  [condensador C], [masa m (kg)], [inercia J (kg·m²)], [C#sub[th] (J/°C)], [depósito],
  [bobina L], [1/k (k en N/m)], [1/k#sub[θ] (k#sub[θ] en N·m/rad)], [no existe], [inercia del fluido],
)

La casilla que no existe dice algo útil: el calor no tiene inercia, una red térmica pasiva solo tiene resistencias y condensadores, sus polos son todos reales y #strong[una temperatura no oscila ni se pasa por sí sola]. Si un horno se pasa de la consigna, el sobreimpulso lo pone el lazo de control. Un disipador de 2 °C/W y 150 J/°C (unos 167 g de aluminio) es un RC con τ = 300 s: cinco minutos para llegar al 63 % de su temperatura final, que es lo que la sección #nr("sec-47.5") llama impedancia térmica transitoria.

#ejemplo[
  Una masa de 0,5 kg con un muelle de 200 N/m y un amortiguador de 4 N·s/m recibe un escalón de 10 N. Sus parámetros, con la notación de la sección #nr("sec-24.3"): ω#sub[n] = √(k/m) = 20 rad/s (3,18 Hz) y ζ = b/(2·√(k·m)) = 0,2. En reposo el muelle se estira F/k = 5 cm; con ζ = 0,2 se pasa un 52,7 %, hasta 7,63 cm a los 0,160 s.

  Como RLC serie: L = 0,5 H, R = 4 Ω y C = 5 mF, con ζ = (R/2)·√(C/L) = 0,2 y un escalón de 10 V; la carga del condensador es la posición. Como RLC paralelo: C = 0,5 F, R = 0,25 Ω, L = 5 mH y un escalón de 10 A; la corriente de la bobina dividida por k es la posición. ngspice da en los dos 52,66 % a los 0,1603 s, y la velocidad (la corriente del serie, la tensión del paralelo) coincide con la de la ecuación mecánica en cinco cifras (figura #nr("fig-new-31-analogias")).

  Al final el muelle guarda ½·k·x² = 0,25 J de los F·x = 0,5 J de trabajo: la otra mitad se la lleva el amortiguador, sea cual sea b, como al cargar un condensador desde una fuente de tensión.
]

#figura("modelado-analogias.svg", 100%, [Arriba, el sistema de masa, muelle y amortiguador y sus dos circuitos análogos: el RLC serie (fuerza ↔ tensión) y el RLC paralelo (fuerza ↔ corriente, la analogía de movilidad). Abajo, la posición ante un escalón de 10 N obtenida de los dos circuitos con ngspice y de la ecuación mecánica: las tres curvas coinciden.]) <fig-new-31-analogias>

=== El motor de continua con su carga

La sección #nr("sec-33.13") describió el motor en régimen permanente con V = E + I·R, E = k·ω y T = k·I. Para el transitorio faltan los dos elementos que almacenan energía: la inductancia L del bobinado y la inercia J del rotor con su carga, además del rozamiento viscoso B y el par de carga T#sub[L]:

#ec[$ V = R dot.op I + L (d I)/(d t) + k dot.op ω quad quad J (d ω)/(d t) = k dot.op I - B dot.op ω - T_"L" $]

La primera es Kirchhoff en el inducido; la segunda, Newton para la rotación. El acoplamiento son dos fuentes controladas: el inducido ve una tensión k·ω que depende de la parte mecánica, y la parte mecánica ve un par k·I que depende de la eléctrica. Con la analogía de movilidad, el motor entero es un circuito (figura #nr("fig-new-31-motor")): una fuente controlada de tensión E = k·ω en serie con R y L, y una fuente controlada de corriente k·I que carga un condensador J en paralelo con una resistencia 1/B. (Aquí k vuelve a ser la constante del motor de la sección #nr("sec-33.13"), no la del muelle.)

#deduccion[La función de transferencia del motor][
  #eclabel[#strong[Ec. 9 — Velocidad frente a tensión y par de carga]]
  #ec[$ ω(s) = (k dot.op V(s) - (L s + R) dot.op T_"L" (s))/((L s + R)(J s + B) + k^2) $]

  #strong[Origen.] Con condiciones iniciales nulas, d/dt → s (sección #nr("sec-0.10")): de la primera ecuación, I = (V − k·ω)/(L·s + R); sustituida en la segunda, (J·s + B)·ω = k·(V − k·ω)/(L·s + R) − T#sub[L]. Multiplicando por (L·s + R) y despejando ω sale la Ec. 9.

  #strong[Dominio de validez.] k constante (flujo de imanes, sin saturar), sin caída en las escobillas, rozamiento solo viscoso y un driver que da la tensión V que se le pide: lineal y sin límites.
]

Con el motor de la sección #nr("sec-33.13") (R = 0,5 Ω, k = 0,05 V·s/rad), L = 1 mH, J = 5·10#super[−4] kg·m² (rotor y volante de carga) y B = 2·10#super[−5] N·m·s/rad, el denominador de la Ec. 9 tiene dos polos reales, en −10,25 y −489,8 s#super[−1] (97,6 ms y 2,04 ms), muy cerca de las dos constantes de tiempo que se pueden calcular por separado: la #strong[eléctrica], τ#sub[e] = L/R = 2 ms, y la #strong[mecánica], τ#sub[m] = J·R/k² = 100 ms. La ganancia en continua es k/(R·B + k²) = 19,92 rad/s por voltio: a 24 V, 478 rad/s (4 565 rpm). Sin rozamiento serían los 4 584 rpm de la tabla de la sección #nr("sec-33.13")\; B solo resta un 0,4 % y deja una corriente en vacío de 0,19 A. Ante un par de carga de 0,1 N·m, la velocidad cae R/(R·B + k²) × 0,1 = 19,9 rad/s (190 rpm) y la corriente sube 2 A: también los números de aquella tabla.

Al arrancar a 24 V, la corriente sube hasta 45,1 A a los 8,1 ms (sin L serían los 48 A de la sección #nr("sec-33.13")) y cae a medida que crece la fuerza contraelectromotriz; la velocidad llega al 63 % a los 99,6 ms (figura #nr("fig-new-31-arranque")). Simulado de las dos maneras de la figura #nr("fig-new-31-motor"), como bloques y como circuito, ngspice da lo mismo que la Ec. 9 con menos de un 0,01 % de diferencia.

#importante[
  El modelo reducido, con τ#sub[e] ≪ τ#sub[m] y B despreciable, es ω/V ≈ (1/k)/(τ#sub[m]·s + 1) = 20/(0,1·s + 1); con un reductor 2:1 y la posición como salida da 10/(s·(0,1·s + 1)), el servo de la sección #nr("sec-new-31-compensacion"). Para la ganancia y la constante de tiempo el reducido acierta, pero no para la fase cerca del cruce: con L = 1 mH, el polo de 490 s#super[−1] resta 5,2° a 47 rad/s, y el adelanto que allí daba 54,5° deja #strong[49,0°] (ngspice, con los dos modelos), por debajo de los 50° pedidos. Un polo diez veces por encima del cruce no se puede despreciar si el margen va justo.
]

#figura("modelado-motor.svg", 100%, [El motor de continua con su carga. Arriba, su diagrama de bloques: la parte eléctrica, 1/(L·s + R), y la mecánica, 1/(J·s + B), unidas por k en los dos sentidos; la fuerza contraelectromotriz cierra un lazo de realimentación interno, y el par de carga T#sub[L] entra como perturbación. Abajo, el mismo modelo como circuito, con una fuente controlada de tensión (E = k·ω) y una de corriente (k·I).]) <fig-new-31-motor>

#figura("modelado-arranque.svg", 100%, [A la izquierda, el arranque del motor a 24 V y un par de carga de 0,1 N·m a los 0,5 s, simulado con ngspice como circuito y como diagrama de bloques: velocidad y corriente. A la derecha, el lazo PI de velocidad con una consigna de 200 rad/s: sin límite de tensión (lo que da el análisis lineal), con el driver limitado a ±24 V y con integración condicional; los círculos son la última simulación con el motor como circuito.]) <fig-new-31-arranque>

=== Linealización alrededor de un punto de trabajo

La Ec. 9 es lineal porque el modelo lo es. Muchas plantas no lo son, y se linealizan como el diodo de la sección #nr("sec-0.14"): se busca el punto de trabajo y se sustituye cada función por su tangente. Con el modelo escrito en forma de estado, ẋ = f(x, u), como en la sección #nr("sec-31.12"):

#deduccion[Linealizar un modelo][
  #eclabel[#strong[Ec. 10 — Modelo de pequeña señal]]
  #ec[$ f(x_0, u_0) = 0 quad quad Δ dot(x) = (∂ f)/(∂ x) |_0 dot.op Δ x + (∂ f)/(∂ u) |_0 dot.op Δ u $]

  #strong[Origen.] El punto de trabajo (x#sub[0], u#sub[0]) es un equilibrio: nada cambia. Desarrollando f por Taylor alrededor de él y quedándose con el término lineal, como en la sección #nr("sec-0.14"), las derivadas parciales en el punto son coeficientes constantes; con varias variables forman las matrices A y B del espacio de estados.

  #strong[Dominio de validez.] Desviaciones pequeñas frente a la curvatura de f: el error crece con el cuadrado de la desviación.
]

El ejemplo clásico es el #strong[levitador magnético]: un electroimán sostiene una bola de acero de m = 20 g a x#sub[0] = 10 mm por debajo, con una fuerza K·(I/x)² que crece con la corriente y cae con la distancia. Con m·ẍ = m·g − K·(I/x)² (x hacia abajo), el equilibrio con I#sub[0] = 0,5 A fija K = 7,85·10#super[−5] N·m²/A², y las dos derivadas parciales dan

#ec[$ m dot.op Δ dot.double(x) = (2 m g)/(x_0) dot.op Δ x - (2 m g)/(I_0) dot.op Δ I quad arrow.r.double quad (Δ X(s))/(Δ I(s)) = (-"39,2")/(s^2 - 1962) $]

Los dos coeficientes, 39,2 N/m y 0,785 N/A, son un muelle #strong[negativo] (si la bola se acerca, la fuerza crece y la acerca más) y la sensibilidad a la corriente. Los polos están en ±√(2g/x#sub[0]) = ±44,3 s#super[−1]: uno en el semiplano derecho, de modo que una desviación se duplica cada 15,6 ms. Es la planta inestable de la sección #nr("sec-new-31-estabilidad"), que solo se controla con una ganancia mínima y un adelanto (lo diseña uno de los ejercicios).

El modelo vale mientras la desviación sea pequeña, y aquí se puede medir cuánto: con ΔI/I#sub[0] = 0,1 la fuerza lineal se equivoca un 4,8 %, pero con Δx/x#sub[0] = 0,1 (1 mm), un 15,2 %, porque 1/x² se curva más que I² (con 0,05, un 2,4 % y un 7,6 %). Es la regla de la sección #nr("sec-0.14") con números propios: el modelo del levitador es bueno para una fracción de milímetro, y el controlador debe recuperar la bola antes.

La linealización también dice que #strong[los parámetros dependen del punto de trabajo] (la ganancia de lazo que cambia de la sección #nr("sec-31.8")). Si el motor anterior mueve un ventilador, con un par c·ω² (c = 2·10#super[−6] N·m·s²), a 12 V gira a 219,8 rad/s y el ventilador equivale a un rozamiento B#sub[eq] = B + 2·c·ω#sub[0], 45 veces el propio: la ganancia baja de 19,9 a 16,95 rad/s por voltio y la constante de tiempo de 99,6 a 84,8 ms. El modelo lineal acierta un escalón de 1 V con un 0,6 % de error, y uno de 12 V con un 6,5 %.

=== Diagramas de bloques y su álgebra

Un #strong[diagrama de bloques] dibuja el modelo como señales que van de un bloque a otro: cada bloque multiplica su entrada por una función de transferencia, cada #strong[sumador] suma o resta, y un #strong[punto de bifurcación] copia una señal sin cargarla. A diferencia de un circuito, las flechas tienen sentido y un bloque no carga al anterior: si lo carga, como un divisor seguido de otro, hay que calcular el conjunto como un solo bloque. Cinco reglas reducen cualquier diagrama lineal:

#tabla(none, columns: 2, align: (left, left),
  [Configuración], [Equivale a],
  [Bloques en cascada, G#sub[1] y G#sub[2]], [Un bloque G#sub[1]·G#sub[2]],
  [Bloques en paralelo, sumados], [Un bloque G#sub[1] ± G#sub[2]],
  [Lazo: G hacia delante, H en la realimentación, sumador con −], [G/(1 + G·H) (con +: G/(1 − G·H))],
  [Sumador después de G movido antes de G], [La entrada que se mueve pasa por 1/G],
  [Bifurcación antes de G movida después de G], [La señal tomada pasa por 1/G],
)

Con varias entradas se aplica la superposición: se anulan todas menos una, se reduce, y se suman los resultados. En el motor de la figura #nr("fig-new-31-motor"), con T#sub[L] = 0, la cadena 1/(L·s + R), k, 1/(J·s + B) con k en la realimentación es un lazo, y G/(1 + k·G) da el primer término de la Ec. 9. Con V = 0, el bloque mecánico va hacia delante con signo − y el resto del diagrama, k²/(L·s + R), en la realimentación: sale el segundo. Dos caminos, la ecuación y el diagrama, al mismo resultado; con diagramas grandes, la #strong[regla de Mason] da la transferencia de una vez sin ir reduciendo.

El diagrama enseña algo que la ecuación esconde: la fuerza contraelectromotriz es una #strong[realimentación negativa interna]. Por ella el motor se comporta como un primer orden de 100 ms, aunque la inercia sola, frenada solo por B, tendría una constante de tiempo J/B = 25 s; y por ella una carga apenas lo frena, porque al bajar la velocidad baja E, sube la corriente y sube el par.

=== Simulación numérica: paso fijo, paso variable y rigidez

Con no linealidades, saturaciones o entradas arbitrarias, el modelo se integra numéricamente. El método más simple, #strong[Euler explícito], avanza con la pendiente del instante actual: x#sub[n+1] = x#sub[n] + h·f(x#sub[n], u#sub[n]), con paso h. El implícito usa la del instante siguiente, y el trapecial, la media de las dos. Su comportamiento se juzga con un solo modo, ẋ = λ·x (λ = −1/τ):

#deduccion[Estabilidad de un integrador][
  #eclabel[#strong[Ec. 11 — Factor por paso de tres métodos]]
  #ec[$ "explícito:" thin 1 + h λ quad quad "implícito:" thin 1/(1 - h λ) quad quad "trapecial:" thin (1 + h λ \/ 2)/(1 - h λ \/ 2) $]

  #strong[Origen.] Cada paso multiplica x por ese factor; el exacto es e#super[hλ]. Los tres coinciden con su desarrollo de Taylor hasta el término en h (los dos de Euler, método de primer orden) o en h² (el trapecial, de segundo orden). El método es estable si el factor no supera 1 en módulo: el explícito exige h ≤ 2·τ, y los otros dos lo son con cualquier h.

  #strong[Dominio de validez.] Un sistema lineal se descompone en modos como este (sección #nr("sec-0.8")); uno no lineal, alrededor de cada punto (Ec. 10). Con λ complejo vale lo mismo con el módulo de un número complejo.
]

La figura #nr("fig-new-31-integracion") muestra Euler explícito con varios pasos: con h = 0,2·τ sigue a la exponencial; con 1,9·τ alterna de signo, aunque decae; con 2,2·τ crece, una oscilación que solo existe en el cálculo. La precisión es otra cosa: en t = τ, con h = τ/10, el explícito se equivoca un −5,2 %, el implícito un +4,8 % y el trapecial un −0,08 %; con h = τ/100, ±0,50 % y −0,0008 %. La ecuación en diferencias del filtro RC de la sección #nr("sec-30.7") es Euler implícito, y el filtro de la derivada de la sección #nr("sec-31.3") también.

En el motor, el modo eléctrico (λ = −490 s#super[−1]) limita a Euler explícito a h ≤ 4,08 ms: con 1 ms la velocidad a los 0,5 s sale con un 0,02 % de error; con 4,2 ms, el cálculo diverge. El Runge-Kutta clásico de cuarto orden (RK4) acierta en seis cifras con 5 ms y diverge con 6 ms (su límite es 5,69 ms): el paso no lo limita la precisión, sino la estabilidad del modo más rápido.

Un modelo es #strong[rígido] cuando sus modos tienen escalas de tiempo muy distintas. Si el motor tuviera L = 10 µH, su modo eléctrico duraría 20 µs y el mecánico 100 ms, una relación de casi 5 000. El transitorio eléctrico se acaba en 0,1 ms, pero un método explícito sigue limitado por él durante todo el arranque: Euler necesitaría 12 500 pasos para medio segundo. Los métodos de #strong[paso variable] ajustan h para que el error estimado no pase de una tolerancia, y aun así un explícito no lo puede subir por encima de su límite de estabilidad. Los implícitos sí:

#tabla(none, columns: 4, align: (left, left, right, right),
  [Método (SciPy, tolerancia 10#super[−6])], [Tipo], [Pasos, L = 1 mH], [Pasos, L = 10 µH],
  [RK45 (Dormand-Prince)], [explícito, 5.º orden], [99], [7 573],
  [Radau], [implícito, 5.º orden], [103], [107],
  [BDF], [implícito, orden variable], [150], [160],
  [LSODA], [cambia solo entre los dos], [136], [136],
)

Con 1 mH los cuatro trabajan parecido. Con 10 µH, RK45 da 7 573 pasos (53 042 evaluaciones del modelo) clavado en su límite de estabilidad, 3,31/|λ| = 66 µs; Radau, 107. Los cuatro coinciden en seis cifras en la velocidad a los 0,5 s (474,93 rad/s con 10 µH). SPICE integra con el trapecial o con fórmulas de Gear (BDF), implícitos y de paso variable, y por eso resuelve sin esfuerzo los circuitos rígidos que son casi todos los de electrónica: ngspice hace el arranque con L = 10 µH en 555 puntos.

#precaucion[
  El trapecial es estable, pero con h mucho mayor que τ su factor tiende a −1 (con h = 10·τ, −0,67): el modo rápido, en lugar de desaparecer, alterna de signo en cada paso. Es la oscilación espuria de punto a punto que a veces aparece en SPICE en las corrientes de bobinas conmutadas; con `.options method=gear`, ngspice usa Gear y la amortigua. Y la regla de la sección #nr("sec-42.6") vale para cualquier simulador: un resultado solo es fiable si no cambia al apretar la tolerancia o reducir el paso.
]

#figura("modelado-integracion.svg", 100%, [A la izquierda, Euler explícito sobre ẋ = −x/τ con cuatro pasos: estable y preciso con h = 0,2·τ; con 1,9·τ, oscila y decae; con 2,2·τ, diverge. A la derecha, el paso que eligen dos métodos de paso variable en el arranque del motor con L = 10 µH: el explícito (RK45) queda clavado en su límite de estabilidad, 66 µs, durante todo el arranque; el implícito (Radau) lo alarga hasta decenas de milisegundos.]) <fig-new-31-integracion>

=== Herramientas: Octave, Scilab, Python o SPICE

Cualquiera de estas herramientas libres integra un modelo como los de esta sección; cambian la forma de describirlo y lo que se tiene alrededor:

#tabla(none, columns: 3, align: (left, left, left),
  [Herramienta], [Cómo se describe el modelo], [Integradores y para qué],
  [GNU Octave], [Función ẋ = f(t, x); paquete control: tf, step, bode, lsim], [ode45 y ode15s (rígidos); compatible con MATLAB],
  [Scilab y Xcos], [Xcos dibuja el diagrama de bloques, como Simulink], [Explícitos e implícitos; para dibujar en vez de escribir],
  [Python con SciPy], [Función para solve_ivp; scipy.signal para transferencias], [RK45, Radau, BDF, LSODA; cuentas y gráficas en el mismo script],
  [SPICE (ngspice)], [Netlist: el circuito análogo o bloques con fuentes B], [Trapecial y Gear; la planta junto a su electrónica real],
)

En Python, el arranque del motor con el escalón de carga cabe en unas líneas; el `max_step` impide que el integrador salte por encima del escalón de 0,5 s:

#codigo[```python
# DC motor with load: state x = [I, w]
from scipy.integrate import solve_ivp

R, L, k, J, B = 0.5, 1e-3, 0.05, 5e-4, 2e-5

def motor(t, x, V=24.0):
    I, w = x
    TL = 0.1 if t >= 0.5 else 0.0      # load torque step at 0.5 s
    return [(V - R*I - k*w) / L, (k*I - B*w - TL) / J]

s = solve_ivp(motor, (0, 1), [0, 0], method='Radau',
              rtol=1e-6, atol=1e-9, max_step=1e-3)
print(round(s.y[1, -1], 2))            # speed at 1 s: 458.27 rad/s
```]

En SPICE hay dos caminos. El #strong[análogo físico] es el circuito de la figura #nr("fig-new-31-motor"): VI, de 0 V, mide la corriente del inducido; E1 es la fuerza contraelectromotriz y F1 (corriente controlada por corriente) el par que carga la inercia CJ:

#codigo[```spice
* DC motor and load: v(w) is the speed in rad/s
V1 va 0 PWL(0 0 1u 24)
R1 va a 0.5
L1 a b 1m
VI b c 0
E1 c 0 w 0 0.05
F1 0 w VI 0.05
CJ w 0 5e-4
RB w 0 50k
IL w 0 PWL(0 0 0.5 0 0.500001 0.1)
.tran 0.1m 1 uic
.end
```]

El otro camino es el #strong[diagrama de bloques] con fuentes de comportamiento (B): un integrador es un condensador de 1 F cargado por una fuente B de corriente igual a su entrada (C·dx/dt = I), con una resistencia de 1 TΩ a masa para el punto de trabajo; un bloque de primer orden k/(τ·s + 1) es un condensador de valor τ con I = k·u − x; un sumador, una ganancia o una saturación, una fuente B de tensión con su expresión (`min(max(V(u),-24),24)`). El modelo `s_xfer` de XSPICE describe una función de transferencia directamente, pero con lazos rígidos puede atascarse; los bloques hechos con condensadores no dan ese problema.

#comprobacion[
  El motor con un PI de velocidad: T#sub[i] = 97,6 ms, que cancela el polo lento, y K#sub[p] = 1,60 V por rad/s para 60° de margen (cruce en 283 rad/s). Consigna de 200 rad/s y 0,1 N·m de carga a los 0,3 s, simulado con SciPy, con ngspice en bloques y con ngspice usando el motor como circuito: las tres simulaciones coinciden en cinco cifras (figura #nr("fig-new-31-arranque")). El análisis lineal promete un 8,8 % de sobreimpulso y 15 ms de establecimiento, pero pide al driver hasta #strong[395 A]. Con el driver limitado a ±24 V la corriente no pasa de 45,1 A, el integrador se carga mientras el motor acelera (el #strong[windup] de la sección #nr("sec-31.3")) y el sobreimpulso sube al 21,6 %; a los 0,29 s aún va un 2,3 % por encima. Con integración condicional, no se pasa y entra en el ±2 % a los 92 ms.
]

Esa es la razón de simular en el tiempo un modelo que ya se sabe analizar en frecuencia: el Bode no ve la saturación, el rozamiento seco ni la cuantificación de la sección #nr("sec-31.5"), y una simulación los incluye con una línea cada uno. Por eso la sección #nr("sec-new-31-respuesta") pide comprobar sus especificaciones con un escalón pequeño.

=== En el banco

Los cinco parámetros de un motor se miden con un polímetro, una fuente y el osciloscopio. #strong[R], con el rotor bloqueado y tensión baja, en tres o cuatro posiciones (cambia con las escobillas). #strong[k], en vacío: k = (V − R·I#sub[0])/ω#sub[0], con la velocidad del encoder (sección #nr("sec-20.10")); o haciéndolo girar con otro motor, porque la tensión en bornes es E = k·ω. #strong[B], de la corriente en vacío: B = k·I#sub[0]/ω#sub[0]\; si I#sub[0] apenas cambia con la velocidad, el rozamiento es seco y se modela mejor como un par constante. #strong[J], del escalón de velocidad: J = τ#sub[m]·(R·B + k²)/R. Y #strong[L], con un medidor LCR con el rotor bloqueado, o de la pendiente inicial de la corriente, dI/dt = V/L.

Con ellos, el modelo se compara con un arranque real capturado en disparo único. Si discrepa, suele faltar la caída de las escobillas, el rozamiento seco (el motor no arranca por debajo de cierta tensión), el límite de corriente del driver o el rizado del PWM (sección #nr("sec-33.9")); como en la sección #nr("sec-42.7"), la discrepancia enseña qué faltaba.

// ============================================================================================ PARTE 2
#ejercicios[
  #ejercicio[
    Un eje con inercia J = 2·10#super[−3] kg·m² está unido a un resorte de torsión de 0,5 N·m/rad y frenado por un rozamiento viscoso de 0,01 N·m·s/rad. Calcula su frecuencia natural y su factor de amortiguamiento, y dibuja el circuito análogo con la analogía de movilidad, con los valores de sus componentes.
  ] <ej-31.18>

  #ejercicio[
    Un transistor que disipa 10 W va en un disipador de 2 °C/W y 150 J/°C. Con el modelo RC de primer orden, ¿cuánto sube su temperatura en régimen, cuánto ha subido a los 5 minutos y cuánto tarda en llegar al 95 %? ¿Puede pasarse de su temperatura final?
  ] <ej-31.19>

  #ejercicio[
    En un diagrama de bloques, G#sub[1]\(s) = 10/(s + 1) va en cascada con un lazo interno formado por G#sub[2]\(s) = 1/(s + 5) y una realimentación negativa de ganancia 0,5; el conjunto se cierra con realimentación unitaria negativa. Reduce el diagrama a una función de transferencia, y calcula su ganancia en continua, ζ, ω#sub[n] y el sobreimpulso.
  ] <ej-31.20>

  #ejercicio[
    De un motor de 12 V se mide: con el rotor bloqueado, 8 A; en vacío, 2 350 rpm y 0,15 A; y, ante un escalón de tensión en vacío, la velocidad llega al 63 % de la final en 80 ms. Calcula R, k, B y J. ¿Cuánto cambia J si se desprecia B?
  ] <ej-31.21>

  #ejercicio[
    Un filtro RC con τ = 1 ms se simula con Euler explícito y paso h = 0,25 ms. Calcula el valor de la descarga desde 1 V tras cuatro pasos y compáralo con el exacto. Repite con el método trapecial. ¿Qué paso máximo admite Euler explícito, y qué ocurre con h = 2,5 ms?
  ] <ej-31.22>

  #ejercicio[
    El motor de la sección #nr("sec-new-31-modelado") con el ventilador (c = 2·10#super[−6] N·m·s²) se alimenta a 24 V. Calcula el punto de trabajo (velocidad y corriente), el rozamiento equivalente, la ganancia de pequeña señal y la constante de tiempo, y compáralos con los de 12 V.
  ] <ej-31.23>

  #ejercicio[
    El levitador de la sección #nr("sec-new-31-modelado") se estabiliza con un control PD de la corriente, ΔI = K#sub[p]·Δx + K#sub[d]·dΔx/dt (si la bola cae, más corriente). Obtén el polinomio característico, la K#sub[p] mínima para que sea estable y los valores de K#sub[p] y K#sub[d] que colocan los polos en −50 ± j50 s#super[−1].
  ] <ej-31.24>

  #ejercicio[
    El motor de la sección #nr("sec-new-31-modelado") (J = 5·10#super[−4] kg·m², R = 0,5 Ω, k = 0,05 V·s/rad) mueve un tambor de 0,02 kg·m² a través de un reductor 10:1. ¿Qué inercia ve el motor y cuál es la nueva constante de tiempo mecánica? ¿Y si el tambor fuera acoplado directamente?
  ] <ej-31.25>
]

// ============================================================================================ PARTE 3
#soluciones[
  #solucion("ej-31.18")[
    ω#sub[n] = √(k#sub[θ]/J) = √(0,5/0,002) = 15,8 rad/s (2,52 Hz). ζ = B/(2·√(k#sub[θ]·J)) = 0,01/(2·√0,001) = 0,158: muy subamortiguado, oscilará varios ciclos. Con la analogía de movilidad, un RLC paralelo alimentado por una fuente de corriente (el par): C = J = 2 mF, R = 1/B = 100 Ω y L = 1/k#sub[θ] = 2 H; la tensión del nudo es la velocidad angular y la corriente de la bobina, el par del resorte.
  ]

  #solucion("ej-31.19")[
    En régimen, ΔT = P·R#sub[th] = 10 × 2 = 20 °C. τ = R#sub[th]·C#sub[th] = 300 s (5 min). A los 5 minutos ha subido 20·(1 − e#super[−1]) = 12,6 °C; el 95 % (19 °C) lo alcanza en 3·τ = 900 s, 15 minutos. No puede pasarse: una red térmica pasiva solo tiene resistencias y capacidades, sin nada que haga de inductancia, y su respuesta al escalón sube sin oscilar.
  ]

  #solucion("ej-31.20")[
    El lazo interno: G#sub[2]/(1 + 0,5·G#sub[2]) = 1/(s + 5,5). En cascada con G#sub[1]: 10/((s + 1)(s + 5,5)). Con realimentación unitaria: T(s) = 10/(s² + 6,5·s + 15,5). Ganancia en continua 10/15,5 = 0,645 (un 35,5 % de error, porque el lazo es de tipo 0). ω#sub[n] = √15,5 = 3,94 rad/s y ζ = 6,5/(2 × 3,94) = 0,826: el sobreimpulso es de apenas un 1,0 %.
  ]

  #solucion("ej-31.21")[
    R = 12 V/8 A = 1,5 Ω. En vacío, ω#sub[0] = 2 350 × 2π/60 = 246,1 rad/s y k = (12 − 1,5 × 0,15)/246,1 = 0,0478 V·s/rad. B = k·I#sub[0]/ω#sub[0] = 2,92·10#super[−5] N·m·s/rad. J = τ#sub[m]·(R·B + k²)/R = 0,080 × (4,37·10#super[−5] + 2,29·10#super[−3])/1,5 = 1,24·10#super[−4] kg·m². Sin B, J = τ#sub[m]·k²/R = 1,22·10#super[−4] kg·m²: un 1,9 % menos, porque k² pesa mucho más que R·B.
  ]

  #solucion("ej-31.22")[
    Cada paso multiplica por 1 − h/τ = 0,75; tras cuatro pasos (t = 1 ms), 0,75⁴ = 0,316 V frente a e#super[−1] = 0,368 V: un −14,0 %. Con el trapecial, el factor es (1 − 0,125)/(1 + 0,125) = 0,778 y tras cuatro pasos 0,366 V: un −0,52 %, porque es de segundo orden. Euler explícito admite h ≤ 2·τ = 2 ms. Con h = 2,5 ms el factor es −1,5: la tensión cambia de signo en cada paso y crece un 50 % cada vez, una oscilación que no existe en el circuito.
  ]

  #solucion("ej-31.23")[
    El equilibrio cumple k·(24 − k·ω)/R = B·ω + c·ω², de segundo grado: ω#sub[0] = 410,8 rad/s (3 923 rpm) e I#sub[0] = (24 − 0,05 × 410,8)/0,5 = 6,92 A. B#sub[eq] = B + 2·c·ω#sub[0] = 1,66·10#super[−3] N·m·s/rad. Ganancia de pequeña señal k/(R·B#sub[eq] + k²) = 15,0 rad/s por voltio y τ = R·J/(R·B#sub[eq] + k²) = 75,0 ms. A 12 V eran 16,95 rad/s por voltio y 84,8 ms (y sin ventilador, 19,9 y 99,6 ms): un controlador ajustado a 12 V ve a 24 V un 11,5 % menos de ganancia y una constante de tiempo un 11,5 % menor.
  ]

  #solucion("ej-31.24")[
    Con Δẍ = 1962·Δx − 39,24·ΔI y ΔI = K#sub[p]·Δx + K#sub[d]·sΔx: s² + 39,24·K#sub[d]·s + (39,24·K#sub[p] − 1962) = 0. Es estable si los dos coeficientes son positivos: K#sub[d] > 0 y K#sub[p] > 1962/39,24 = 50 A/m (0,05 A por milímetro). Para (s + 50)² + 50² = s² + 100·s + 5 000: K#sub[d] = 100/39,24 = 2,55 A·s/m y K#sub[p] = (5 000 + 1 962)/39,24 = 177 A/m, es decir, 0,18 A por milímetro de desviación. Es un PD, un adelanto (sección #nr("sec-new-31-compensacion")) con el polo muy alto; en la práctica el derivativo se filtra y la inductancia del electroimán añade un polo que hay que incluir en el modelo.
  ]

  #solucion("ej-31.25")[
    Una inercia detrás de un reductor N:1 se ve dividida por N²: 0,02/100 = 2·10#super[−4] kg·m², y el motor ve J = 5·10#super[−4] + 2·10#super[−4] = 7·10#super[−4] kg·m². τ#sub[m] = J·R/k² = 7·10#super[−4] × 0,5/0,0025 = 140 ms, frente a 100 ms sin el tambor. Acoplado directamente, J = 0,0205 kg·m² y τ#sub[m] = 4,1 s: cuarenta veces más que el motor solo, y por eso un motor rápido y un reductor mueven mejor una carga pesada que un motor grande sin él.
  ]
]

// ============================================================================================ PARTE 4
// (optional, comments only) for the chapter's paratexto (cap31.typ of paratexto/: resumen-capitulo,
// formulas-capitulo, terminos-clave). Proposed sentence for the summary, after P05's:
//   «Un sistema mecánico o térmico se modela como un circuito: con la analogía de movilidad la velocidad es una
//   tensión, la fuerza una corriente, la masa un condensador y el muelle una bobina, y el calor, sin inercia, no
//   oscila. El motor de continua es un circuito con dos fuentes controladas, k·ω y k·I; una planta no lineal se
//   linealiza en su punto de trabajo, y sus parámetros cambian con él. Los diagramas de bloques se reducen con cinco
//   reglas, y se simulan con integradores de paso variable: los implícitos, como los de SPICE, resuelven los modelos
//   rígidos que a los explícitos les cuestan miles de pasos.»
// Formula card (three entries, label, formula, section):
//   [Motor de continua: velocidad]          $ ω(s) = (k V(s) - (L s + R) T_"L" (s))/((L s + R)(J s + B) + k^2) $
//   [Constantes de tiempo del motor]        $ τ_"e" = L/R quad τ_"m" = (J R)/(k^2) $
//   [Estabilidad de Euler explícito]        $ |1 + h λ| <= 1 quad arrow.r.double quad h <= 2 τ $
// Key terms: «Analogía de movilidad», «Diagrama de bloques», «Punto de trabajo», «Linealización»,
//   «Sistema rígido», «Paso variable», «Fuerza contraelectromotriz».
