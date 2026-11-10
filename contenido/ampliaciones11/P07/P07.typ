// P07 — «Instalaciones y protecciones de baja tensión»: new section 46.8 of chapter 46 (cap47.typ) for «Electrónica
// Práctica Avanzada». Four parts, each to be pasted in its own place (see NOTAS.md):
//   PARTE 1  the section: at the end of 46.7 «Seguridad Eléctrica» <sec-47.7> (after its figure <fig-47.13>) and
//            before «== Seguridad en el Laboratorio <sec-47.8>», which becomes 46.9 (46.8-46.15 become 46.9-46.16).
//   PARTE 2  eight exercises: inside the chapter's #ejercicios[…], after the exercise labelled <ej-47.5>.
//   PARTE 3  their solutions: inside #soluciones[…], after #solucion("ej-47.5")[…].
//   PARTE 4  (comments only) proposals for the chapter's summary 46.12 (46.13 after the insertion) and the formula card.
// Numbers: section 46.8; figures 46.14-46.17 (the old 46.14-46.21 become 46.18-46.25); exercises 46.6-46.13;
// equations Ec. 1-2 of the deduction (the chapter has no other «Ec. n»). Every number comes from scripts/calculos.py
// and every simulated value from the ngspice runs (scripts/spice_comprobar.py). Regulatory citations: NOTAS.md lists
// the source checked for each one.

// ============================================================================================ PARTE 1
== Instalaciones y Protecciones de Baja Tensión <sec-new-47-instalaciones>

La sección #nr("sec-47.7") explicó qué le hace la corriente al cuerpo, y la #nr("sec-new-24-trifasica") cómo llega la red de 400/230 V a un taller. Entre las dos queda la instalación: el cuadro, los cables, las protecciones y la toma de tierra, que deciden qué ocurre cuando algo falla. Esta sección la recorre con los criterios del reglamento y con números, hasta dimensionar el circuito de un banco de trabajo; no sustituye al reglamento ni al instalador.

=== El reglamento y lo que toca a un taller

En España, las instalaciones de hasta 1 000 V en alterna y 1 500 V en continua se rigen por el #strong[Reglamento electrotécnico para baja tensión] (REBT, Real Decreto 842/2002, de 2 de agosto). El detalle está en sus instrucciones técnicas complementarias, las ITC-BT, que remiten a normas UNE. Al taller le afectan sobre todo estas:

#tabla(none, columns: 2, align: (left, left),
  [ITC-BT], [Lo que interesa en el taller],
  [03 y 04], [Quién hace o modifica la instalación y cómo se documenta (memoria técnica de diseño, o proyecto en un local industrial de más de 20 kW)],
  [08 y 24], [Esquemas de conexión a tierra y condiciones de disparo frente a contactos],
  [17], [Interruptor general automático, con poder de corte de 4,5 kA como mínimo],
  [18], [Toma de tierra; tensiones de contacto de 24 V y 50 V],
  [19 y 22], [Intensidad admisible de los cables, caída de tensión y su coordinación con la protección],
  [23], [Categorías de sobretensión y cuándo hace falta protección],
  [25 y 47], [Circuitos de vivienda (10 A con 1,5 mm², 16 A con 2,5 mm²) y motores],
)

Una instalación nueva, ampliada o modificada la ejecuta una empresa instaladora habilitada, que la documenta y firma su certificado (ITC-BT-03 e ITC-BT-04): añadir un circuito al cuadro es una modificación; enchufar una regleta, no. Y casi todas las cifras del reglamento salen de dos ideas: ninguna masa debe quedar a una tensión peligrosa el tiempo suficiente para hacer daño, y ningún cable debe calentarse más de lo que soporta su aislamiento.

#nota[
  Está en tramitación una revisión del reglamento, pendiente de publicación a mediados de 2026, que según el borrador retira el diferencial de tipo AC de las instalaciones nuevas de viviendas y del sector terciario y generaliza la protección contra sobretensiones transitorias. Aquí se cita el texto vigente; conviene comprobar la versión en vigor. El reglamento escribe las tensiones con U; se mantiene la V del libro.
]

=== Los esquemas de conexión a tierra

El esquema se nombra con dos letras (ITC-BT-08). La primera dice cómo está la alimentación: T, con un punto (el neutro) unido a tierra; I, aislada o unida a través de una impedancia. La segunda, dónde van las masas de los aparatos de clase I: T, a una toma de tierra propia; N, al punto puesto a tierra de la alimentación, por el conductor de protección. En TN, una tercera letra dice si neutro y conductor de protección van separados (TN-S) o combinados en un conductor, el PEN (TN-C). Cada esquema se entiende siguiendo la corriente de un defecto (figura #nr("fig-new-47-esquemas")).

#figura("instalaciones-esquemas.svg", 100%, [Los tres esquemas de conexión a tierra con un defecto franco entre la fase y la masa de un aparato de clase I, y el camino de la corriente de defecto (flechas). En TT vuelve por el terreno; en TN-S, por el conductor de protección; en IT solo puede volver por las capacidades de la red respecto a tierra. CPA: controlador permanente de aislamiento.]) <fig-new-47-esquemas>

#strong[TT, el de la red pública.] El reglamento lo fija para las instalaciones alimentadas desde la red de distribución pública: el neutro se pone a tierra en el centro de transformación, con su toma R#sub[B], y las masas del taller en la suya, R#sub[A]. Un defecto franco entre fase y masa vuelve por el terreno:

#ec[$ I_"d" = V_0/(R_"A" + R_"B") = 230/(20 + 2) = "10,5 A" $]

La masa queda a V#sub[c] = I#sub[d]·R#sub[A] = 209 V, y quien la toque con 1 kΩ de resistencia corporal recibe 209 mA, cuatro veces el umbral de fibrilación. El magnetotérmico de 16 A no ve nada anormal. En TT la corriente de defecto es demasiado pequeña para el magnetotérmico y demasiado grande para una persona: quien corta es el diferencial. La ITC-BT-24 lo pone como condición sobre la toma de tierra:

#ec[$ R_"A" dot.op I_"Δn" ≤ V_"lím" $]

con I#sub[Δn] la sensibilidad del diferencial y V#sub[lím] = 50 V, o 24 V en locales o emplazamientos conductores (ITC-BT-18). Con 30 mA basta R#sub[A] ≤ 1 667 Ω; con 300 mA, 167 Ω. Confiar el corte al magnetotérmico exigiría, con un C16 (160 A), R#sub[A] ≤ 0,31 Ω, inalcanzable con una pica. La ITC-BT-18 estima la resistencia de una pica vertical como R = ρ/L: una de 2 m da 25 Ω en un terreno cultivable y húmedo (50 Ω·m), 250 Ω en un terraplén poco fértil (500 Ω·m) y 1 500 Ω en arena seca (3 000 Ω·m). Las tres cumplen con 30 mA; con 300 mA, solo la primera.

#strong[TN, cuando el transformador es del taller.] Una nave con centro de transformación propio puede unir las masas al neutro del transformador con un conductor de protección (PE). Un defecto es entonces un cortocircuito por el bucle de defecto, Z#sub[s]: con 0,2 Ω de red, 0,2 Ω de fase y 0,2 Ω de PE, I#sub[d] = 383 A, y el magnetotérmico corta en menos de 0,1 s. La ITC-BT-24 pide Z#sub[s]·I#sub[a] ≤ V#sub[0], con corte en 0,4 s a 230 V; con un C16, Z#sub[s] ≤ 230/160 = 1,44 Ω. La masa queda a 383 × 0,2 = 77 V, tolerables solo porque el corte es rápido. El punto débil es el PEN: si se corta, todas las masas quedan unidas a la fase a través de las cargas.

#strong[IT, continuidad ante el primer defecto.] La alimentación no está unida a tierra y las masas sí. Un primer defecto solo cierra el circuito por las capacidades de los conductores a tierra: con 22 nF por conductor, quien toca una fase con 1 kΩ recibe 1,6 mA. La instalación sigue funcionando y un controlador permanente de aislamiento avisa (ITC-BT-24); el segundo defecto, en el otro conductor, ya es un cortocircuito. Es el esquema de los quirófanos (ITC-BT-38).

#importante[
  El transformador de aislamiento del banco (sección #nr("sec-47.7")) crea una isla IT. Tocar un punto del secundario apenas hace pasar corriente: esa es su protección. Pero el diferencial del cuadro no ve nada de lo que ocurre en el secundario, y basta un primer defecto para que la isla deje de serlo: la pinza de masa de un osciloscopio de sobremesa, unida al PE por su cable de red, conectada a un lado del secundario lo pone a tierra, y tocar el otro lado es tocar 230 V sin diferencial, 230 mA a través de 1 kΩ. Con transformador de aislamiento, como mucho un punto del circuito a tierra, y sabiendo cuál.
]

=== El magnetotérmico: curvas B, C y D

El magnetotérmico reúne un disparador #strong[térmico], un bimetal que actúa ante las sobrecargas con un tiempo inverso a la corriente, y uno #strong[magnético], que actúa en milisegundos ante un cortocircuito. Los de uso doméstico y análogo siguen la UNE-EN 60898-1, que fija los puntos de su característica (figura #nr("fig-new-47-curvas")): con 1,13·I#sub[n] no dispara en una hora; con 1,45·I#sub[n], la corriente convencional de disparo I#sub[2], dispara antes de una hora; con 2,55·I#sub[n] tarda de 1 a 60 s. El magnético no actúa en menos de 0,1 s por debajo del múltiplo inferior de su curva y lo hace por encima del superior: 3 a 5·I#sub[n] en la #strong[B], 5 a 10·I#sub[n] en la #strong[C] y 10 a 20·I#sub[n] en la #strong[D]. Entre los dos, puede disparar o no.

#figura("instalaciones-curvas.svg", 70%, [Zonas de disparo de un magnetotérmico según los puntos de la UNE-EN 60898-1: la térmica es común (gris) y la magnética depende de la curva. El trazado entre los puntos normalizados es esquemático; la curva de cada fabricante cae dentro de la zona.]) <fig-new-47-curvas>

La B dispara con poca corriente de cortocircuito y protege líneas largas; la C, la de uso general, tolera la irrupción de las fuentes conmutadas (sección #nr("sec-10.8")); la D es para transformadores y motores. El motor de 4 kW de la sección #nr("sec-new-maquinas.4") toma 7,89 A y 49,8 A en el arranque directo: con un C10 trifásico (magnético de 50 a 100 A), el arranque cae en el borde de la zona de disparo y el interruptor saltará unas veces sí y otras no. Sirven un C16, si el cable admite 16 A, un D10 o un guardamotor (sección #nr("sec-new-maquinas.7")); sus conductores se dimensionan para el 125 % de la corriente a plena carga (ITC-BT-47), 9,86 A. El #strong[poder de corte] es la mayor corriente de cortocircuito que el aparato interrumpe, como en el fusible (sección #nr("sec-10.3")): 4,5, 6 o 10 kA en los modulares.

=== El cable y su protección

Un circuito se dimensiona con tres corrientes: la de empleo I#sub[B], la asignada de la protección I#sub[n] y la admisible del cable I#sub[Z], la que lo lleva a la temperatura máxima de su aislamiento (70 °C el PVC). La ITC-BT-22 remite a la UNE 20460-4-43, cuya condición contra sobrecargas es

#ec[$ I_"B" ≤ I_"n" ≤ I_"Z" quad quad I_2 ≤ "1,45" dot.op I_"Z" $]

En un magnetotérmico, I#sub[2] = 1,45·I#sub[n] y basta la primera; en un fusible gG, I#sub[2] = 1,6·I#sub[n] y queda I#sub[n] ≤ 0,91·I#sub[Z]. I#sub[Z] se lee en la tabla 1 de la ITC-BT-19, a 40 °C, según el método de instalación y el aislamiento: 2,5 mm² de cobre admiten de 15 a 33 A según la columna, y 1,5 mm², de 11 a 24 A. Por eso 16 A sobre 2,5 mm² cumple en todas las columnas salvo la primera, la del montaje más desfavorable, y 10 A sobre 1,5 mm² en todas. Para un montaje concreto hay que consultar su columna y aplicar los factores de corrección por temperatura y agrupamiento.

La ITC-BT-19 limita además la #strong[caída de tensión], desde el origen de la instalación, al 3 % en alumbrado y al 5 % en los demás usos. En monofásica, despreciando la reactancia del cable,

#ec[$ Δ V = 2 dot.op L dot.op I dot.op R'_θ quad quad R'_θ = R'_20 dot.op (1 + α dot.op (θ - 20)) $]

con α = 0,00393 K#super[−1] en el cobre; en trifásica, √3 en lugar de 2. Un conductor flexible de 2,5 mm² (7,98 Ω/km a 20 °C, IEC 60228) tiene 9,55 Ω/km a 70 °C. Queda una tercera condición, la que más se olvida: que un cortocircuito al final de la línea haga actuar el magnético, y no el térmico al cabo de segundos.

#deduccion[La longitud máxima protegida][
  #eclabel[#strong[Ec. 1 — Corriente de cortocircuito mínima]]
  #ec[$ I_"cc,mín" = V_0/(Z_"red" + 2 dot.op L dot.op R'_θ) $]

  #strong[Origen.] El cortocircuito más pequeño es uno franco entre fase y neutro al final de la línea, con el cable caliente. Z#sub[red] es la impedancia de bucle en el cuadro, que el instalador mide; sumar su módulo y el del cable, en vez de sumarlos como fasores, deja el cálculo del lado seguro.

  #eclabel[#strong[Ec. 2 — Longitud máxima]]
  #ec[$ I_"cc,mín" ≥ I_"m" quad ⟹ quad L_"máx" = (V_0 \/ I_"m" - Z_"red")/(2 dot.op R'_θ) $]

  #strong[Origen.] El disparo magnético exige superar el múltiplo superior de la curva: I#sub[m] = 5, 10 o 20·I#sub[n] en la B, la C o la D.

  #strong[Dominio de validez.] Líneas de poca sección, con reactancia despreciable. Con 2,5 mm² y Z#sub[red] = 0,30 Ω, un C16 protege 59,6 m y un B16, 134,8 m: la curva B se paga en tolerancia a la irrupción y se cobra en longitud.
]

=== La selectividad

Ante un defecto debe abrir solo la protección más próxima. Entre magnetotérmicos, la selectividad #strong[amperimétrica] dura mientras la corriente de cortocircuito no alcance el umbral magnético del de arriba: bajo un C25 (125 a 250 A), un cortocircuito de 296 A al final del banco del ejemplo final puede abrir los dos. Si hace falta asegurarla, la dan las tablas de cada fabricante, un aparato selectivo arriba o fusibles gG de calibres suficientemente separados.

Entre diferenciales, el de arriba no debe dispararse con lo que dispara al de abajo, y como un diferencial puede actuar desde la mitad de su sensibilidad, I#sub[Δn,arriba] ≥ 2·I#sub[Δn,abajo] como mínimo (se escalonan 30, 100 y 300 mA). Y debe esperar: para eso está el #strong[tipo S], con retardo normalizado.

#tabla(none, columns: 4, align: (left, right, right, right),
  [Tiempo de corte], [1·I#sub[Δn]], [2·I#sub[Δn]], [5·I#sub[Δn]],
  [Uso general (máximo)], [300 ms], [150 ms], [40 ms],
  [Tipo S (mínimo–máximo)], [130–500 ms], [60–200 ms], [50–150 ms],
)

Con 30 mA de uso general en el banco y 300 mA tipo S arriba, un defecto de 1,5 A es 50 veces la sensibilidad del primero, que abre en menos de 40 ms, y 5 veces la del segundo, que no abre antes de 50 ms. Con dos de uso general abrirían los dos.

=== El diferencial: sensibilidad y tipos

Los de 10 y 30 mA protegen a las personas; la ITC-BT-24 reconoce los de 30 mA o menos como protección complementaria contra los contactos directos, que no exime de las demás medidas. Los de 100 a 500 mA protegen contra los contactos indirectos en TT y contra el incendio por fugas. Su sensor es un transformador toroidal que abrazan la fase y el neutro, y un transformador solo transmite variaciones de flujo: de ahí que no todos vean todas las corrientes diferenciales.

#tabla(none, columns: 3, align: (center, left, left),
  [Tipo], [Detecta], [Dónde hace falta],
  [AC], [Alterna senoidal], [Cargas lineales],
  [A], [Además, continua pulsante; tolera 6 mA de continua lisa], [Rectificadores monofásicos: fuentes conmutadas, cargadores],
  [F], [Además, frecuencias mixtas hasta 1 kHz; tolera 10 mA de continua lisa], [Variadores monofásicos: lavadoras, bombas],
  [B], [Además, continua lisa y alterna hasta 1 kHz], [Variadores e inversores trifásicos, cargadores de vehículo eléctrico],
)

La razón es la electrónica de potencia, y se ve simulando un defecto de 1 kΩ entre el positivo del bus de continua y la carcasa (figura #nr("fig-new-47-residual")). Tras un puente monofásico, el positivo sigue a la fase en el semiciclo positivo y queda unido al neutro, a tierra, en el negativo: la corriente es #strong[continua pulsante], de 316 mA de pico y 100 mA de media, nula medio periodo, y la detecta el tipo A. Tras un puente trifásico, el positivo sigue a la mayor de las tres fases y nunca baja de la mitad del pico: la corriente oscila entre 159 y 319 mA, una #strong[continua casi lisa] que solo ve el tipo B. Peor aún, esa continua magnetiza el toroidal de un diferencial AC o A y lo ciega también para un defecto de alterna. Por eso un variador trifásico, un cargador o un inversor van protegidos con tipo B (o el que indique su fabricante), sin un AC o un A aguas arriba que esa continua pueda cegar.

#figura("instalaciones-residual.svg", 100%, [Corrientes diferenciales simuladas con ngspice. (a) Fuga permanente de los condensadores Y de los filtros de red de un banco (25,1 nF en total). (b) Defecto de 1 kΩ entre el positivo del bus de continua y la carcasa, detrás de un puente monofásico con condensador. (c) El mismo defecto detrás de un puente trifásico a 400/230 V.]) <fig-new-47-residual>

Queda la #strong[fuga permanente]: por los condensadores Y de los filtros de red (sección #nr("sec-47.10")) circula, sin defecto alguno, I = V·ω·C#sub[Y], 0,34 mA con 4,7 nF. Los fabricantes recomiendan no pasar del 25 al 30 % de I#sub[Δn], unos 9 mA en uno de 30 mA, porque desde 15 mA ya puede disparar. Un equipo informático de clase I puede fugar 3,5 mA: tres en el mismo diferencial lo harían saltar. Se reparten circuitos; nunca se sube la sensibilidad.

=== Las sobretensiones

La ITC-BT-23 clasifica los equipos de una red de 230/400 V por la tensión de impulso que soportan: 6 kV en el origen de la instalación (categoría IV), 4 kV en la instalación fija (III), 2,5 kV en los aparatos conectados a ella (II) y 1,5 kV en los equipos sensibles protegidos (I). Son parientes de las categorías de medida de los instrumentos (sección #nr("sec-47.10")), no las mismas. Exige protección en el origen cuando la instalación se alimenta por una línea aérea, y no con red subterránea. Se hace con protectores escalonados (SPD), como en la sección #nr("sec-10.4"): de tipo 1 donde hay pararrayos, de tipo 2 en el cuadro y de tipo 3, como la regleta con varistor, junto a los equipos y solo eficaz detrás de un tipo 2. Ninguno protege de la sobretensión permanente de un neutro cortado (sección #nr("sec-new-24-trifasica")), que quema el varistor: para eso hace falta un relé de máxima tensión.

=== Un banco de trabajo, con números

Un banco a 25 m del cuadro, con aire caliente (700 VA), soldador (120 VA), fuente doble (400 VA), osciloscopio y generador (100 VA), ordenador con dos monitores (300 VA), transformador de aislamiento para el equipo en prueba (500 VA) y alumbrado, lupa y extractor (80 VA): 2 200 VA, que sumados como si estuvieran en fase dan, del lado seguro, I#sub[B] = 9,57 A. Las decisiones (figura #nr("fig-new-47-banco")):

+ #strong[C16.] I#sub[n] = 16 A ≥ I#sub[B]. Curva C por la irrupción: encender a la vez el ordenador, la fuente, el osciloscopio y un cargador, en el pico de la tensión, da en ngspice 112 A de pico durante algo más de un milisegundo. El magnético de un B16 actúa entre 48 y 80 A eficaces, 68 a 113 A instantáneos, y esa punta cae dentro; el de un C16, entre 113 y 226 A, no.
+ #strong[2,5 mm² de cobre], comprobando I#sub[n] ≤ I#sub[Z] en la columna del montaje.
+ #strong[Caída de tensión]: con I#sub[B], 2 × 25 × 9,57 × 0,00955 = 4,57 V, el 1,99 %; con 16 A, el 3,32 %. Con 1,5 mm² y 16 A sería el 5,54 %.
+ #strong[Cortocircuito al final]: con Z#sub[red] = 0,30 Ω y 0,477 Ω de cable a 70 °C, la Ec. 1 da 296 A, 1,85 veces los 160 A del C16. En el cuadro son 767 A, lejos de los 4,5 kA de poder de corte.
+ #strong[Diferencial de 30 mA, tipo A], propio del banco (tipo B si se prueban variadores, inversores o cargadores). Los ocho filtros de red suman 25,1 nF y 1,81 mA de fuga, lejos de los 9 mA.
+ #strong[Equipo en prueba tras el transformador de aislamiento], y si al encenderlo salta el magnetotérmico, un limitador de irrupción (sección #nr("sec-10.8")), no un calibre mayor. Y un SPD de tipo 2 en el cuadro.

#figura("instalaciones-banco.svg", 100%, [Esquema unifilar del circuito del banco del ejemplo: interruptor general, protector contra sobretensiones de tipo 2, diferencial y magnetotérmico propios del banco en el cuadro, línea de 25 m y, en el banco, las tomas y el transformador de aislamiento que alimenta el equipo en prueba.]) <fig-new-47-banco>

=== En el banco

El botón de prueba del diferencial comprueba el mecanismo, no la protección: no pasa por la toma de tierra ni mide el tiempo. Medir disparo, tierra e impedancia de bucle es trabajo del instalador. Al banco le toca no deshacer la instalación: nada de adaptadores sin toma de tierra (sección #nr("sec-47.10")), mirar el tipo de diferencial antes de probar un variador o un inversor y, si un diferencial salta sin motivo, buscar la fuga desconectando equipos de uno en uno.

// ============================================================================================ PARTE 2
#ejercicios[
  #ejercicio[
    En un taller con esquema TT, la toma de tierra de las masas mide 40 Ω y la del neutro del centro de transformación, 3 Ω. Un aparato de clase I sufre un defecto franco entre la fase y la carcasa. Calcula la corriente de defecto y la tensión que adquiere la carcasa. ¿Dispara el magnetotérmico C16 del circuito? ¿Qué resistencia de tierra máxima admitirían un diferencial de 30 mA y uno de 300 mA, con 50 V y con 24 V de tensión de contacto límite?
  ] <ej-47.6>

  #ejercicio[
    Un circuito protegido con un magnetotérmico de 10 A alimenta un transformador cuya corriente de conexión llega a 70 A eficaces durante el primer semiperiodo. ¿Entre qué corrientes actúa el disparador magnético de un B10, un C10 y un D10? ¿Cuál dispara con seguridad al conectar el transformador, cuál no disparará y cuál queda en duda?
  ] <ej-47.7>

  #ejercicio[
    La toma de tierra de un taller con esquema TT se hace con una pica vertical en un terreno de 500 Ω·m. Calcula su resistencia si mide 2 m y la tensión que alcanzan las masas cuando la fuga llega a la sensibilidad de un diferencial de 30 mA. ¿Qué longitud de pica haría falta para proteger con un diferencial de 300 mA, con 50 V y con 24 V de tensión límite?
  ] <ej-47.8>

  #ejercicio[
    Un calefactor de 3 kW, resistivo, se alimenta a 230 V desde un cuadro situado a 40 m. Calcula la caída de tensión, en voltios y en porcentaje, con conductor flexible de cobre de 1,5, 2,5 y 4 mm² (13,3, 7,98 y 4,95 Ω/km a 20 °C), a la temperatura máxima del PVC, 70 °C. ¿Qué secciones cumplen el 5 %? ¿Hasta qué longitud valdría la de 2,5 mm²?
  ] <ej-47.9>

  #ejercicio[
    La impedancia de bucle medida en un cuadro es 0,5 Ω. Calcula la longitud máxima de una línea monofásica de 2,5 mm² (9,55 Ω/km a 70 °C) protegida con un C16 y con un B16, y la de una línea de 4 mm² (5,92 Ω/km a 70 °C) con un C16.
  ] <ej-47.10>

  #ejercicio[
    Cada equipo de un banco lleva en su filtro de red un condensador Y de 4,7 nF entre fase y tierra. Calcula la corriente de fuga de cada uno a 230 V y 50 Hz. ¿Cuántos pueden compartir un diferencial de 30 mA sin pasar del 30 % de su sensibilidad? ¿A partir de cuántos podría disparar sin ningún defecto? ¿Y cuántos equipos informáticos con 3,5 mA de fuga cabrían en el mismo presupuesto?
  ] <ej-47.11>

  #ejercicio[
    El circuito del banco tiene un diferencial de uso general de 30 mA, y aguas arriba hay uno de 300 mA de tipo S. Analiza qué ocurre con un defecto de 100 mA y con uno de 1 A: cuántas veces su sensibilidad ve cada diferencial y si la protección es selectiva. ¿Qué cambiaría si el de arriba fuera de uso general y de 100 mA?
  ] <ej-47.12>

  #ejercicio[
    Un equipo con un puente rectificador monofásico conectado a la red de un taller con esquema TT (R#sub[A] = 20 Ω, R#sub[B] = 2 Ω) tiene un defecto de aislamiento de 10 kΩ entre el positivo del bus de continua y la carcasa. Estima la forma de onda, el pico y el valor medio de la corriente diferencial. Repite el cálculo para un puente trifásico conectado a 400/230 V con el mismo defecto. ¿Qué tipo de diferencial ve cada una? Comprueba los resultados con ngspice.
  ] <ej-47.13>
]

// ============================================================================================ PARTE 3
#soluciones[
  #solucion("ej-47.6")[
    I#sub[d] = 230/(40 + 3) = 5,35 A, y la carcasa queda a 5,35 × 40 = 214 V respecto al suelo. El C16 no dispara: 5,35 A está por debajo de su corriente asignada, así que ni siquiera actúa el térmico. Con R#sub[A]·I#sub[Δn] ≤ V#sub[lím]: con 50 V, R#sub[A] ≤ 50/0,03 = 1 667 Ω (30 mA) y 50/0,3 = 167 Ω (300 mA); con 24 V, 800 Ω y 80 Ω. Los 40 Ω cumplen en los cuatro casos: lo que falta es el diferencial. ngspice: 5,35 A.
  ]

  #solucion("ej-47.7")[
    B10: entre 3 y 5 veces 10 A, de 30 a 50 A; C10: de 50 a 100 A; D10: de 100 a 200 A. Con 70 A, el B10 dispara con seguridad, porque supera su múltiplo superior; el D10 no dispara magnéticamente, porque no llega a su múltiplo inferior; el C10 queda entre sus dos múltiplos y puede disparar o no según el ejemplar y el instante de conexión. La opción segura es la curva D, o un limitador de irrupción si se quiere mantener la C.
  ]

  #solucion("ej-47.8")[
    R = ρ/L = 500/2 = 250 Ω. Con 30 mA de fuga, las masas quedan a 250 × 0,03 = 7,5 V. Con 300 mA y 50 V hace falta R ≤ 50/0,3 = 167 Ω, es decir, L ≥ 500/167 = 3,0 m; con 24 V, R ≤ 80 Ω y L ≥ 6,25 m. En la práctica se ponen varias picas en paralelo, separadas, en lugar de una muy larga.
  ]

  #solucion("ej-47.9")[
    I = 3 000/230 = 13,04 A. R′ a 70 °C = R′#sub[20]·(1 + 0,00393 × 50) = 1,1965·R′#sub[20]: 15,91, 9,55 y 5,92 Ω/km. ΔV = 2 × 40 × 13,04 × R′: 1,5 mm², 16,6 V (7,22 %); 2,5 mm², 9,96 V (4,33 %); 4 mm², 6,18 V (2,69 %). Cumplen 2,5 y 4 mm². La de 2,5 mm² vale hasta L = 0,05 × 230/(2 × 13,04 × 0,00955) = 46,2 m. Si el cuadro ya tiene caída aguas arriba, el margen es menor, porque el límite se cuenta desde el origen de la instalación.
  ]

  #solucion("ej-47.10")[
    Ec. 2 con I#sub[m] = 160 A (C16): L#sub[máx] = (230/160 − 0,5)/(2 × 0,00955) = 0,9375/0,0191 = 49,1 m. Con un B16, I#sub[m] = 80 A: (2,875 − 0,5)/0,0191 = 124,4 m. Con 4 mm² y C16: 0,9375/(2 × 0,00592) = 79,1 m. Más sección o una curva más baja alargan la línea protegida; la impedancia de la red, que no se puede cambiar, la acorta.
  ]

  #solucion("ej-47.11")[
    I = 230 × 2π × 50 × 4,7·10#super[−9] = 0,340 mA por equipo. El 30 % de 30 mA son 9 mA: caben 26 equipos (9/0,340 = 26,5). El diferencial puede disparar desde 0,5·I#sub[Δn] = 15 mA, lo que se alcanza con 45 equipos. Con equipos informáticos de 3,5 mA solo caben 2 en el presupuesto de 9 mA, y con 5 se pasa de 15 mA: por eso se reparten en varios circuitos.
  ]

  #solucion("ej-47.12")[
    Defecto de 100 mA: el de 30 mA lo ve como 3,3·I#sub[Δn] y abre en menos de 150 ms (más de 2·I#sub[Δn]); el de 300 mA lo ve como 0,33·I#sub[Δn], por debajo de la mitad de su sensibilidad, y no abre nunca: selectividad amperimétrica. Defecto de 1 A: el de abajo lo ve como 33·I#sub[Δn] y abre en menos de 40 ms; el de arriba, como 3,3·I#sub[Δn], y siendo de tipo S no abre antes de 50 ms (el mínimo de 5·I#sub[Δn]\; a 2·I#sub[Δn] son 60 ms): selectividad cronométrica. Con uno de 100 mA de uso general arriba, la relación de sensibilidades, 3,3, sigue dando selectividad con defectos pequeños, pero con 1 A los dos ven más de 5 veces su sensibilidad (33 y 10) y los dos pueden abrir en menos de 40 ms: se pierde la selectividad.
  ]

  #solucion("ej-47.13")[
    Monofásico: el positivo del bus sigue a la fase en el semiciclo positivo y queda unido al neutro en el negativo, así que la corriente es una media onda (continua pulsante) de pico 325,3/(10 000 + 20 + 2) = 32,5 mA y media 32,5/π = 10,3 mA. Trifásico: el positivo sigue a la mayor de las tensiones de fase, entre la mitad del pico y el pico: entre 16,3 y 32,6 mA, con media 32,6 × 3√3/(2π) = 27,0 mA, una continua casi lisa con rizado de 150 Hz. La primera la detectan los tipos A, F y B; la segunda, solo el B, y además supera los 6 mA de continua lisa que tolera un tipo A, que puede quedar cegado. ngspice, con diodos reales: 32,3 mA de pico y 10,2 mA de media en monofásica; entre 16,2 y 32,5 mA, con 26,8 mA de media, en trifásica.
  ]
]

// ============================================================================================ PARTE 4
// (optional, comments only) For the chapter's summary 46.12 (46.13 after the insertion), «Herramientas Adicionales y
// Resumen», a block after «Distancias de aislamiento»:
//
//   === Protecciones de la instalación
//   En TT (la red pública) la corriente de un defecto franco, V#sub[0]/(R#sub[A] + R#sub[B]), es demasiado pequeña
//   para el magnetotérmico y demasiado grande para una persona: protege el diferencial, con R#sub[A]·I#sub[Δn] ≤ 50 V.
//   El magnetotérmico protege el cable: I#sub[B] ≤ I#sub[n] ≤ I#sub[Z], curva B, C o D según la irrupción y la longitud,
//   y un cortocircuito al final de la línea debe superar su múltiplo magnético superior. El tipo de diferencial lo
//   decide la electrónica de potencia: A para rectificadores monofásicos, F para variadores monofásicos, B para
//   continua lisa.
//
// …and for the #tarjeta (formula card):
//   #formula($ R_"A" dot.op I_"Δn" ≤ "50 V" quad quad I_"B" ≤ I_"n" ≤ I_"Z" $)
//   #formula($ Δ V = 2 dot.op L dot.op I dot.op R' quad quad L_"máx" = (V_0 \/ I_"m" - Z_"red")/(2 dot.op R') $)
