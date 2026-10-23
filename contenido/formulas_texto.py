"""«Qué significa» of every calculator formula, from the book's own text (ESQUEMA.md, «Calculadoras»).

Each entry has up to four short parts (HTML: sub, sup, em, strong, br):
  significa  what the formula means physically;
  aplica     when it holds: the assumptions and limits the book states;
  valores    typical values the book gives;
  error      the common mistake the book warns about.
Fragments between «…» are quotes: formulas_enriquecer.py checks that each one appears word for word in the
book's section `ref` (by default, the formula's own section), as the quiz generator does («[…]» joins pieces in
order). Everything else is a faithful paraphrase of that section.
"""

T = {}
TEXTOS = T


def X(id, ref=None, **partes):
    if ref:
        partes['ref'] = ref
    T[id] = partes


# ---------------------------------------------------------------- cap00 — mathematics
X('senoide',
  significa='La tensión alterna más común: oscila entre +V<sub>p</sub> y −V<sub>p</sub>, donde «Vₚ es la amplitud (valor de pico), ω = 2π·f es la frecuencia angular en radianes por segundo» y φ la fase inicial.',
  aplica='El ángulo va en radianes; aquí la fase se escribe en grados y se convierte. El periodo, «tiempo que tarda en repetirse, es T = 1/f».')
X('carga-rc',
  significa='La exponencial describe «los procesos que crecen o decaen a un ritmo proporcional a su valor actual: exactamente lo que hace un condensador al cargarse o descargarse».',
  valores='En una constante de tiempo la tensión llega al 63,2 % de la final; en cinco constantes, prácticamente al final.')
X('tau-rc',
  significa='La constante de tiempo marca el ritmo de la carga y la descarga: la resistencia limita la corriente y el condensador la acumula, así que el producto R·C es el tiempo característico del circuito.',
  aplica='Es el τ de la curva exponencial, que describe «lo que hace un condensador al cargarse o descargarse»; con R en ohmios y C en faradios sale en segundos.')
X('db-tension',
  significa='El decibelio «es una medida logarítmica de relación entre dos potencias o tensiones»; para tensiones se multiplica por 20 el logaritmo decimal del cociente.',
  valores='«Una caída a la mitad de tensión son −6 dB, y la frecuencia de corte de un filtro es donde la salida cae a −3 dB (el 70,7 % de la entrada)».')
X('ic-cdvdt',
  significa='«La corriente por un condensador es proporcional a la rapidez con que cambia su tensión»: no depende del valor de la tensión, sino de lo deprisa que varía.',
  aplica='De ahí que «un condensador se opone a los cambios bruscos de tensión»: con tensión constante no circula corriente.')
X('vl-ldidt',
  significa='«La tensión en una bobina es proporcional a la rapidez con que cambia su corriente»: una corriente constante no produce tensión en una bobina ideal.',
  aplica='Por eso una bobina se opone a los cambios bruscos de corriente; cortar la corriente de golpe produce una tensión muy grande.')
X('descarga-rc',
  significa='Un circuito con una sola reactancia da «una ecuación de primer orden cuya solución es siempre una exponencial»; para un RC que se descarga, la tensión cae desde V<sub>0</sub> hacia cero.',
  valores='«La constante de tiempo τ = R·C marca el ritmo»: en 0,693·τ queda la mitad; en una constante de tiempo, el 37 %.')
X('error-peor-caso',
  significa='Propagación del error de P = V²/R suponiendo que todos los errores se suman en el peor sentido: el de la tensión cuenta doble porque está al cuadrado.',
  aplica='Es la regla de peor caso, «la correcta para garantizar un límite»: se usa «para lo que no puede fallar nunca».',
  valores='Con δV = 0,9 % y δR = 1 %: «peor caso 2,80 %, cuadrático 2,06 %».')
X('error-cuadratico',
  significa='Si los errores son independientes, «las varianzas se suman»: el error total es la raíz de la suma de los cuadrados de cada contribución.',
  aplica='«La cuadrática es la que describe lo que realmente se mide»: sirve para estimar lo que se verá en el banco o en producción, no para garantizar un límite.',
  valores='Con δV = 0,9 % y δR = 1 % sale 2,06 %, frente al 2,80 % del peor caso.')
X('bode-polo',
  significa='El módulo de un polo simple en decibelios: plano por debajo del corte y, por encima, «una recta que cae 20 dB por década (6 dB por octava)».',
  valores='El error de las asíntotas es máximo en el codo: en f = f<sub>c</sub> la curva real está en −3,01 dB.',
  aplica='Es la pieza con la que se construye cualquier diagrama de Bode asintótico.')

# ---------------------------------------------------------------- cap01 — fundamental laws
X('corriente-carga',
  significa='«La corriente es la cantidad de carga que atraviesa una sección transversal del conductor por unidad de tiempo».',
  aplica='La forma I = Q/t es «para el caso habitual de una corriente constante en el tiempo».',
  valores='«Un LED indicador consume unos 10-20 miliamperios (mA), un teléfono móvil cargando puede demandar 1-2 amperios».')
X('tension-trabajo',
  significa='La tensión es «la energía potencial eléctrica por unidad de carga entre dos puntos»: el trabajo necesario para mover una carga unidad de un punto a otro.',
  error='«La tensión es siempre una magnitud relativa: se mide entre dos puntos». Al medir, conectar mal la referencia es una fuente habitual de errores.')
X('potencia-vi',
  significa='«La potencia eléctrica es la velocidad a la que se transfiere o se transforma la energía en un circuito»: el producto de la tensión por la corriente.',
  aplica='Vale en cualquier elemento: en una resistencia esa potencia se disipa en forma de calor.')
X('potencia-i2r',
  significa='Combinando P = V·I con la ley de Ohm, la potencia en una resistencia crece con el cuadrado de la corriente: doblar la corriente cuadruplica el calor.',
  aplica='Una resistencia por la que circula mucha corriente «disipará mucha potencia en forma de calor»: hay que elegir su potencia nominal con margen.')
X('potencia-v2r',
  significa='La misma potencia escrita con la tensión: con R fija, crece con el cuadrado de la tensión aplicada.',
  valores='En el ejemplo del libro, 220 Ω a 12 V disipan «P = V²/R = 144/220 = 0,655 W», así que hace falta una resistencia de más de medio vatio.')
X('energia-pt',
  significa='«La energía total consumida es la potencia multiplicada por el tiempo durante el cual se consume».',
  valores='«Un kWh es la energía consumida por un aparato de 1000 W funcionando durante una hora, y equivale a 3,6 millones de julios».')
X('ohm',
  significa='Para un conductor metálico a temperatura constante, «la corriente que circula por él es directamente proporcional a la tensión aplicada entre sus extremos»; la constante es la resistencia.',
  aplica='Solo vale para resistencias propiamente dichas, o para pequeñas variaciones alrededor de un punto de trabajo en componentes no lineales.')
X('resistencia-geometria',
  significa='La resistencia crece con la longitud y baja con la sección: «a mayor longitud, mayor resistencia», «a mayor sección, menor resistencia», y ρ es propia del material.',
  aplica='Vale «para un conductor homogéneo de sección uniforme».',
  valores='«La resistividad del cobre a 20 °C es de apenas 1,72 × 10⁻⁸ Ω·m»; la del aluminio, 2,82 × 10⁻⁸ Ω·m.')
X('resistencia-temperatura',
  significa='En los metales, al calentarse, la red cristalina vibra más y estorba a los electrones: la resistencia aumenta casi linealmente con la temperatura.',
  aplica='La relación lineal vale «en un rango moderado de temperaturas»; en los semiconductores el coeficiente es negativo.',
  valores='«Para el cobre, α ≈ +0,00393 por grado Celsius»: casi un 0,4 % por grado.')
X('serie-3',
  significa='«Componentes en serie comparten la misma corriente», y sus resistencias se suman.',
  valores='«La resistencia total es siempre mayor que la mayor de las asociadas»; con 100, 220 y 470 Ω, 790 Ω.')
X('divisor',
  significa='Como la corriente es común, «la tensión se reparte en proporción a las resistencias»: la salida es la fracción R<sub>2</sub>/(R<sub>1</sub> + R<sub>2</sub>) de la entrada.',
  aplica='«La fórmula solo vale en vacío»: el divisor es una fuente con resistencia interna R<sub>1</sub> ∥ R<sub>2</sub>.',
  error='Una carga comparable a esa resistencia lo hunde: la regla es que «la carga debe ser al menos diez veces la resistencia equivalente del divisor».')
X('paralelo-2',
  significa='«Componentes en paralelo comparten la misma tensión»; se suman las conductancias, y para dos resistencias queda R<sub>1</sub>·R<sub>2</sub>/(R<sub>1</sub> + R<sub>2</sub>).',
  error='«La resistencia total es siempre menor que la menor de las asociadas»: si el resultado sale mayor que la más pequeña, está mal.')
X('vrms-seno',
  significa='«El valor RMS de una señal alterna es el valor de tensión continua que produciría exactamente la misma disipación de calor en una resistencia».',
  aplica='La relación 0,707 vale para una onda sinusoidal pura; los multímetros que no son de verdadero valor eficaz se equivocan con otras formas de onda.',
  valores='Los 230 V de la red son eficaces: «el valor de pico real alcanza 230 × √2 ≈ 325 V».')
X('f0-lc',
  significa='A la frecuencia de resonancia «las reactancias inductiva y capacitiva se cancelan mutuamente», y el circuito presenta una impedancia máxima o mínima según la configuración.',
  aplica='Es la base de la sintonización de radios, de los filtros selectivos y de muchos osciladores; la agudeza la da el factor de calidad Q.')
X('bateria-energia',
  significa='«Una pila no almacena vatios, almacena carga»: la energía es la capacidad en amperios-hora (por 3600 para pasar a culombios) por la tensión.',
  valores='Una AA alcalina de 2000 mAh a 1,5 V contiene 3,0 Wh, 10 800 J.',
  error='La autonomía real es peor que la teórica: por el efecto Peukert, «una batería entrega menos capacidad cuanto mayor es la corriente».')
X('fuente-real',
  significa='«Toda fuente real tiene una resistencia interna que produce una caída proporcional a la corriente entregada»: es el equivalente Thévenin de la fuente.',
  valores='Una pila de 9 V con 5 Ω internos alimentando 45 Ω da 180 mA y la tensión en bornes «cae a 8,1 V, un 10 % menos».',
  error='«La tensión en vacío no dice nada del estado de una batería»: hay que medirla con carga.')
X('regulacion-carga',
  significa='«La regulación se define como la caída relativa entre vacío y plena carga»: cuanto menor, más se parece la fuente a una ideal.',
  valores='«En una fuente de alimentación de laboratorio ronda el 0,01 %, en una fuente lineal sencilla el 5 %».',
  aplica='Referida a la tensión en vacío sale otra cifra: conviene decir siempre qué convención se usa.')
X('error-carga-divisor',
  significa='Al colgar una carga de un divisor se forma un segundo divisor con su resistencia de Thévenin: la tensión cae en la proporción R<sub>Th</sub>/(R<sub>L</sub> + R<sub>Th</sub>).',
  aplica='«El error por carga no depende de los valores del divisor, sino de su resistencia equivalente frente a la de la carga».',
  error='Bajar R<sub>Th</sub> reduce el error pero exige más corriente en reposo: ese es el conflicto de diseño.')
X('divisor-cargado',
  significa='El divisor se sustituye por «su equivalente Thévenin», una fuente V<sub>0</sub> en serie con R<sub>1</sub> ∥ R<sub>2</sub>; con la carga forma un segundo divisor.',
  aplica='Es la forma limpia de calcular cuánto baja la tensión de un divisor en cuanto se le conecta algo.')
X('cable-seccion',
  significa='La caída admisible fija la resistencia máxima del cable y de ahí la sección: «la sección necesaria crece con la corriente y con la longitud, y crece inversamente con la tensión de alimentación».',
  error='«El primer error que hay que evitar es contar solo la ida: la corriente va y vuelve»; la longitud efectiva es el doble.',
  valores='Por eso los sistemas de 12 V exigen cables gruesos y los de 48 V no.')
X('carga-matriz',
  significa='Una matriz cuadrada de n resistencias en serie por n ramas en paralelo conserva el valor («el valor no cambia sea cual sea n») mientras la potencia admisible se multiplica por n².',
  aplica='Cada rama lleva la corriente total dividida por n, y cada resistencia disipa la n²-ésima parte.',
  valores='Para 10 W con resistencias de 2 W derateadas al 50 % hacen falta 16 (4 × 4), y a cada una le tocan 0,625 W.')
X('profundidad-pelicular',
  significa='En alterna las corrientes parásitas empujan la corriente hacia la superficie: «la densidad de corriente decae exponencialmente hacia el interior», con una constante δ, la profundidad de penetración.',
  valores='En cobre, 9,33 mm a 50 Hz y 66 µm a 1 MHz: «a 1 MHz solo conducen las 66 micras exteriores».',
  aplica='Por eso a 50 Hz el efecto es despreciable salvo en conductores muy gruesos.')
X('rac-rdc',
  significa='Si el radio es mucho mayor que δ, la corriente circula por una corona de espesor δ y la resistencia crece en la proporción entre el área total y la de esa corona.',
  aplica='Vale para a ≫ δ.',
  error='«Engordar el hilo deja de servir»: a 1 MHz duplicar el diámetro solo divide la resistencia efectiva por dos; la solución es el hilo de Litz.')
X('wheatstone-salida',
  significa='Fuera del equilibrio, la salida del puente es proporcional a la variación relativa de la resistencia activa, ΔR/R, y a la excitación dividida por cuatro.',
  aplica='Es una aproximación lineal para ΔR ≪ R: «empieza a notarse a partir del 1 % de desequilibrio».',
  valores='Con R = 1 kΩ y 5 V, ΔR = 1 Ω da 1,25 mV (exacto: 1,2494 mV).')
X('parasito-l',
  significa='A frecuencias altas una resistencia es un circuito de tres elementos; su inductancia serie empieza a pesar cuando su reactancia iguala a R.',
  valores='«Valores típicos: 5 a 20 nH de inductancia en una axial con patillas cortas»; con 10 nH, una de 100 Ω se vuelve inductiva desde 1,6 GHz.',
  aplica='«Las resistencias pequeñas se vuelven inductivas y las grandes, capacitivas.»')
X('parasito-c',
  significa='La capacidad paralelo de una resistencia forma con ella un filtro: por encima de esta frecuencia la resistencia deja de comportarse como tal.',
  valores='Con 0,3 pF, «una de 1 MΩ deja de comportarse como resistencia por encima de medio megahercio».',
  aplica='Importa sobre todo en las resistencias de valor alto, como las de entrada de un amplificador de alta impedancia.')
X('error-divisor-tol',
  significa='La tolerancia de las resistencias pasa al cociente del divisor con una sensibilidad (1 − k): «la sensibilidad vale (1−k), no 1».',
  aplica='Es un desarrollo de primer orden; si las dos resistencias se desvían en la misma proporción, «el divisor no cambia».',
  valores='Con el criterio de peor caso, |Δk/k| = 2·(1 − k)·tol; con el estadístico, √2·(1 − k)·tol.')
X('shunt',
  significa='El shunt convierte la corriente en una tensión pequeña por la ley de Ohm: su valor es la tensión de fondo de escala dividida por la corriente máxima.',
  aplica='Bajar la tensión de shunt reduce la potencia perdida pero acerca la señal al ruido y al offset; «los 50 mV son el compromiso habitual».',
  valores='Para 10 A y 50 mV, 5 mΩ, que disipan 0,5 W a fondo de escala.')
X('shunt-error-termico',
  significa='La potencia calienta el shunt, el calor cambia su resistencia según su TCR, y ese cambio es el error: tres efectos encadenados.',
  error='«El error crece con el cuadrado de la corriente»: un shunt que mide bien a media escala puede estar fuera de especificación a fondo de escala.')
X('db-a-relacion',
  significa='Para pasar de decibelios de tensión a relación se deshace el logaritmo: G = 10^(dB/20).',
  valores='«Diez decibelios de tensión» son una ganancia de 3,1623.',
  aplica='En potencia el divisor sería 10 en lugar de 20.')
X('rss-errores',
  significa='Dos errores independientes se combinan en cuadratura (RSS): la raíz de la suma de sus cuadrados.',
  valores='El error de serie E24 del 0,79 % con la tolerancia RSS del 1,41 % da 1,62 %.',
  error='«Antes de comprar una serie más fina, comprueba cuál de los dos términos domina».')
X('densidad-ruido-termico',
  significa='El ruido de Johnson-Nyquist es la «agitación térmica de los portadores en cualquier resistencia», con densidad espectral plana (ruido blanco).',
  valores='4,07 nV/√Hz con 1 kΩ y 12,87 nV/√Hz con 10 kΩ: «multiplicar la resistencia por 100 solo multiplica el ruido por 10».')
X('ruido-disparo',
  significa='El ruido de disparo «aparece siempre que una corriente atraviesa una barrera de potencial»: la carga es discreta y la corriente es un goteo de electrones.',
  valores='Es blanco y crece con la raíz de la corriente: 0,566 pA/√Hz con 1 µA y 17,90 pA/√Hz con 1 mA.',
  aplica='En una resistencia no hay ruido de disparo; en una unión PN, sí.')
X('ruido-flicker',
  significa='El ruido de parpadeo «crece al bajar la frecuencia como 1/f en potencia, es decir, 1/√f en tensión»; se modela con una frecuencia de esquina por debajo de la cual domina sobre el ruido blanco.',
  valores='En la esquina la densidad es √2 veces el suelo blanco; con 4 nV/√Hz y esquina en 1 kHz, a 1 Hz son 126,6 nV/√Hz.',
  aplica='Por eso medir continuas muy pequeñas es difícil, y existen los amplificadores chopper.')
X('ruido-suma',
  significa='Las fuentes de ruido independientes suman sus potencias: «sus tensiones se suman en cuadratura».',
  valores='«Una fuente tres veces menor que la dominante solo añade un 5 % al total».',
  aplica='«La suma en cuadratura exige independencia»: dos fuentes correlacionadas se suman linealmente.')
X('tcr', ref='sec-2.3',
  significa='«El TCR se expresa en partes por millón por grado»: multiplicado por el salto de temperatura da la variación relativa de la resistencia.',
  valores='«Con 100 ppm/°C, una resistencia de 10 kΩ cambia 50 Ω al calentarse 50 °C»; la película metálica de precisión baja a ±10 a ±25 ppm/°C.',
  error='«El autocalentamiento cuenta»: el TCR actúa sobre la temperatura de la propia resistencia, no sobre la de la habitación.')
X('ntc-beta', ref='sec-2.6',
  significa='Una NTC tiene coeficiente de temperatura negativo: su resistencia baja al calentarse, «siguiendo aproximadamente una ley exponencial con un parámetro B característico».',
  aplica='La temperatura entra en kelvin (se suman 273,15 a los grados Celsius); R<sub>25</sub> es su valor a 25 °C.',
  error='Como limitadora de arranque, «si el equipo se reconecta enseguida, la NTC todavía está caliente» y no limita nada.')
X('capacidad-placas',
  significa='«El área de las placas y la distancia entre ellas son geometría; la permitividad relativa εr es el material».',
  valores='Con 1 cm² y 10 µm: 88,5 pF en aire, 310 pF en poliéster y 88,5 nF en cerámica X7R.',
  aplica='La energía no está en las placas sino «en el campo del dieléctrico».')
X('energia-condensador',
  significa='La energía está «en el campo del dieléctrico» y crece con el cuadrado de la tensión.',
  valores='Con 470 µF cargados a 400 V, 38 julios: «energía suficiente para causar daño grave»; un supercondensador de 1 F a 2,7 V solo guarda 3,6 J.',
  error='Al cargar a través de una resistencia «exactamente la mitad de la energía se disipa en la resistencia», sea cual sea su valor.')
X('carga-cv',
  significa='La carga separada en las placas es proporcional a la tensión: la capacidad es esa constante de proporcionalidad.',
  aplica='Lo que se almacena «es la separación de esas cargas»: la carga total del componente es cero.')
X('carga-rc-vcc',
  significa='«La tensión entre sus placas no puede cambiar instantáneamente»: a través de una resistencia crece exponencialmente hacia la tensión de la fuente.',
  valores='τ = R·C es el tiempo que tarda en alcanzar el 63,2 % de su carga; «tras un tiempo de 5τ» se considera cargado del todo (99,3 %).')
X('descarga-rc-rc',
  significa='Al descargarse, la tensión «decae exponencialmente desde su valor inicial», al ritmo que marca τ = R·C.',
  valores='En una constante de tiempo pierde el 63,2 %; en 5τ queda prácticamente descargado.')
X('reactancia-capacitiva',
  significa='Ante la alterna, el condensador se opone a la corriente tanto menos cuanto mayor es la frecuencia: «bloquear lo lento y dejar pasar lo rápido».',
  aplica='En continua la reactancia es infinita y a frecuencias muy altas tiende a cero.',
  error='«A diferencia de una resistencia, la reactancia no disipa potencia»: la energía se almacena y se devuelve en cada ciclo.')
X('autorresonancia',
  significa='Un condensador real es C con su ESR y su ESL en serie; su impedancia baja, toca la ESR y vuelve a subir: el mínimo es la autorresonancia.',
  valores='Un electrolítico de 100 µF con 10 nH resuena a 0,16 MHz; un cerámico de 100 nF en 0805, a 13 MHz.',
  error='«Por encima de su autorresonancia, un condensador es una bobina»: la causa de la mayor parte de los problemas de desacoplo.')
X('rizado-esr',
  significa='En la salida de un convertidor el rizado tiene dos componentes, la de la capacidad y la de la corriente por la ESR, y «en la mayoría de los diseños domina el segundo».',
  valores='0,6 A de rizado en 0,5 Ω dan 300 mV, cuando la capacidad sola daría 1,6 mV.',
  error='Un condensador seco tiene la capacidad correcta y la ESR disparada: «el capacímetro no lo detecta».')
X('fc-rc',
  significa='La frecuencia de corte es aquella «donde la señal se atenúa a 0,707 (−3 dB) de su valor».',
  aplica='Para filtros RC de primer orden, paso bajo o paso alto; fuera de la banda de paso la pendiente es de 20 dB por década.')
X('vida-electrolitico',
  significa='La regla de Arrhenius de los electrolíticos: «cada diez grados menos doblan la vida».',
  valores='Uno de 2000 h a 105 °C dura unas 32 000 h (3,7 años) a 65 °C y 128 000 h a 45 °C.',
  aplica='Por eso conviene colocarlos «lejos de los focos de calor» y dimensionar la corriente de rizado con margen.')
X('impedancia-condensador-real',
  significa='«Un condensador real no es una capacidad: es un circuito RLC serie», con su ESR y la inductancia parásita del componente y su conexión.',
  aplica='Por debajo de la resonancia baja con la frecuencia; en ella es mínima e igual a la ESR; por encima, «la impedancia vuelve a subir».',
  valores='100 nF en 0603 con 0,8 nH resuenan a 17,8 MHz.')
X('descarga-lineal',
  significa='Con corriente constante, la tensión de un condensador baja en línea recta: ΔV = I·Δt/C.',
  aplica='Si la carga es un regulador, «la descarga es una recta exacta»; con una resistencia es el primer término de la exponencial, válido mientras t ≪ RC.')
X('rizado-tcond',
  significa='Durante el tiempo de recarga el condensador no se descarga, así que la descarga dura algo menos que el semiperiodo.',
  aplica='Como t<sub>cond</sub> depende de ΔV, «el problema es autoconsistente» y se resuelve por iteración.',
  error='La fórmula simple «sobrestima el rizado un 12,5 %»: va del lado seguro, pero no es exacta.')
X('pico-puente',
  significa='Tras el puente, el condensador se carga al pico del secundario menos la caída de los dos diodos que conducen a la vez.',
  valores='Con 12 V eficaces: 12·√2 − 1,4 = 15,57 V.',
  error='«Un diseño honesto debería partir de la tensión de red mínima, no de la nominal»: la red fluctúa ±10 %.')
X('tiempo-conduccion',
  significa='«El condensador solo se recarga mientras la tensión rectificada supera a la suya»: un ángulo pequeño alrededor del pico, cuyo coseno es V<sub>min</sub>/V<sub>p</sub>.',
  valores='Con 14,63 V de mínimo y 15,57 V de pico, θ = 20,07° y la recarga dura 1,115 ms de cada 10 ms.',
  error='Toda la carga entra en ese intervalo: la corriente media durante la conducción ronda 4 A con 0,5 A de carga, y «este número no es el pico».')
X('rizado-buck',
  significa='Con el condensador dominado por su capacidad, el rizado de salida de un reductor es el rizado de corriente de la bobina dividido por 8·f<sub>sw</sub>·C: «el rizado es inversamente proporcional a C».',
  error='Los cerámicos de clase 2 pierden capacidad al polarizarlos: «un 10 µF/16 V en 0603 puede quedarse en la mitad a 5 V de trabajo», y el rizado se dobla.')
X('inductancia-solenoide',
  significa='La inductancia de un solenoide largo «va con el cuadrado del número de espiras», con la permeabilidad del núcleo y con la geometría: área partida por longitud.',
  valores='100 espiras, 5 cm y 1 cm² dan 25,1 µH en aire y 50,3 mH con ferrita de µ<sub>r</sub> = 2000.',
  aplica='No depende de la corriente, «siempre que el núcleo no sature».')
X('energia-bobina',
  significa='Como en el condensador, «la energía no está en el cobre sino en el campo», y crece con el cuadrado de la corriente.',
  valores='La bobina de ferrita de 50,3 mH con 1 A almacena 25 mJ.',
  error='Al cortar la corriente esa energía «no puede desaparecer»: o se disipa en un diodo, o en un arco, o destruye algo.')
X('corriente-rl',
  significa='Al conectar un RL a una fuente, «la corriente no aparece de golpe: la bobina se opone a su crecimiento»; sube exponencialmente hacia V/R.',
  valores='«63,2 % en 1τ, 95 % en 3τ, 99,3 % en 5τ».')
X('tau-rl',
  significa='La constante de tiempo de un RL es «L partido por R, no el producto como en el RC».',
  error='«Cuanta menos resistencia, más lento»: lo contrario de la intuición de quien viene del RC.',
  valores='Con 10 mH y 100 Ω, τ = 100 µs; con 10 Ω, 1 ms.')
X('sobretension-inductiva',
  significa='«Al abrir el circuito, la bobina genera la tensión que haga falta para mantener su corriente»: v = L·di/dt con una caída de corriente muy rápida.',
  valores='100 mH cortando 0,1 A en 1 µs darían 10 000 V.',
  error='En la práctica algo rompe antes, el arco del contacto o el transistor, y eso que rompe «es precisamente lo que se destruye».')
X('transformador-tension',
  significa='El flujo variable del primario induce tensión en el secundario: «la relación entre las tensiones es igual a la relación entre el número de espiras».',
  aplica='Solo con corriente alterna: es la variación del flujo la que induce tensión.')
X('transformador-corriente',
  significa='«Las corrientes se relacionan de forma inversa, ya que la potencia se conserva (idealmente)»: si la tensión baja a la mitad, la corriente disponible se duplica.',
  aplica='Es la relación del transformador ideal, sin pérdidas.')
X('rizado-bobina-buck',
  significa='El rizado de corriente de la bobina sale del balance voltios-segundo: durante la conducción soporta V<sub>in</sub> − V<sub>out</sub> y su corriente crece linealmente.',
  valores='«Se elige L para que ese rizado quede entre el 20 y el 40 % de la corriente de carga».')
X('corriente-pico-bobina',
  significa='La corriente de pico es la media más la mitad del rizado.',
  error='«La saturación no depende de la corriente media sino de la de pico»: es la cifra que hay que comparar con la corriente de saturación del catálogo.')
X('rendimiento-max-trafo',
  significa='Las pérdidas del cobre crecen con el cuadrado de la corriente y las del hierro son casi constantes; el rendimiento es máximo cuando se igualan.',
  valores='Con 1,2 W de hierro y 4,1 W de cobre a plena carga, el máximo está al 54 %: el transformador «rinde más al 54 % de su carga nominal».')
X('extincion-bobina',
  significa='Con diodo de rueda libre la corriente se extingue contra la caída del diodo (o del diodo y un Zener) y la resistencia del propio devanado.',
  aplica='Sin resistencia en el devanado el tiempo tendería a L·I/V<sub>extinción</sub>.',
  valores='Diodo simple: 4,8 ms; diodo + Zener de 30 V: 0,55 ms. «El diodo simple protege perfectamente» pero frena la apertura del relé.')
X('accion-masas',
  significa='«La ley de acción de masas relaciona ambas poblaciones»: el producto de electrones y huecos es constante e igual a n<sub>i</sub>².',
  valores='Con n = 10¹⁶ y n<sub>i</sub> = 10¹⁰, los huecos quedan en 10⁴ cm⁻³.',
  aplica='Aun siendo pocos, «casi todo el comportamiento fino de los dispositivos depende de esos minoritarios».')
X('potencial-contacto',
  significa='Es la diferencia de potencial en la zona de agotamiento cuando la difusión y el campo se equilibran: un logaritmo de los dopajes.',
  valores='«Cien veces más dopaje sube V₀ solo 0,12 V»: por eso todos los diodos de silicio rondan los 0,7 V.',
  error='«V₀ no se puede medir con un voltímetro»: los contactos metálicos lo cancelan en el circuito cerrado.')
X('anchura-agotamiento',
  significa='La zona sin portadores de una unión se ensancha con la tensión inversa y se estrecha con el dopaje.',
  valores='Con 10¹⁷ y 10¹⁶ cm⁻³ y sin tensión, W = 332 nm.',
  aplica='La zona «penetra más en el lado menos dopado».')
X('mv-por-decada',
  significa='La pendiente de la curva del diodo se expresa honestamente «en milivoltios por década» de corriente.',
  valores='59,5 mV con n = 1 y 119 mV con n = 2: «entre 1 y 100 mA, cien veces más corriente, la tensión sube solo 119 mV».')
X('rd-diodo',
  significa='La curva no es una recta, así que el diodo no tiene una resistencia única: «lo que tiene es una pendiente en cada punto, y su inversa es la resistencia dinámica».',
  valores='25,9 Ω a 1 mA, 2,59 Ω a 10 mA.',
  aplica='Es la que ve una señal pequeña superpuesta a la polarización; ser inversa a la corriente permite «controlar una impedancia con una corriente».')
X('deriva-termica-diodo',
  significa='A corriente constante la tensión del diodo baja al calentarse: V<sub>T</sub> crece, pero I<sub>S</sub> crece mucho más deprisa.',
  valores='−2,28 mV/°C a 0,6 V y −1,95 mV/°C a 0,7 V: el «famoso −2 mV/°C».',
  error='No es una constante universal, sino el valor alrededor del punto de trabajo habitual.')
X('resistencia-led',
  significa='La resistencia fija la corriente del LED con la tensión que sobra: la de alimentación menos la caída del LED.',
  valores='Un LED rojo de 2,0 V a 20 mA desde 5 V pide 150 Ω, que disipan 60 mW.',
  error='«La tensión directa de un LED tiene tolerancia»: de 1,8 a 2,2 V la corriente varía un 13 %.')
X('condensador-filtro',
  significa='Entre pulsos el condensador alimenta la carga solo y pierde una carga I·t; el rizado admisible fija la capacidad.',
  valores='«Para 0,5 A con 1 V de rizado: C = 0,5/(100 × 1) = 5 000 µF».',
  error='La frecuencia es la del rizado: con onda completa, 100 Hz. Usarla en la versión de la fórmula que ya lleva el 2 «da la mitad del condensador necesario».')
X('doblador',
  significa='El doblador de Greinacher es un fijador seguido de un detector de pico: «el fijador desplaza la senoide para que su mínimo quede en cero», y el detector memoriza el máximo, 2·V<sub>p</sub>, menos dos caídas de diodo.',
  valores='Con 12 V eficaces de entrada, 32,5 V.',
  error='No sustituye a un transformador: su impedancia de salida crece muy deprisa con el número de etapas.')
X('zener-rs',
  significa='Condición de entrada mínima con carga máxima: la resistencia serie debe seguir dejando pasar la corriente mínima del Zener más la de la carga.',
  aplica='«La resistencia serie debe cumplir dos condiciones opuestas a la vez»; esta da el valor máximo.',
  valores='De 9 V a 5,6 V con 5 + 20 mA: R<sub>s</sub> ≤ 136 Ω.')
X('zener-rs-min',
  significa='Condición de entrada máxima sin carga: toda la corriente pasa por el Zener y no debe superar su disipación.',
  valores='De 15 V con un Zener de 250 mW (45 mA): R<sub>s</sub> ≥ 211 Ω. Con el máximo de 136 Ω, «la ventana está vacía».')
X('zener-variacion',
  significa='La resistencia dinámica del Zener hace que su tensión cambie con la corriente que lo atraviesa.',
  valores='Con r<sub>z</sub> = 10 Ω y 70 mA de variación, la salida se mueve 0,7 V: un 12,5 % sobre 5,6 V.',
  error='Incluso con el diseño correcto, «la tensión de salida no es constante»: un regulador integrado da dos órdenes de magnitud más de estabilidad.')
X('recorte-zener',
  significa='«Dos Zener en oposición conducen siempre por parejas»: uno en inversa y otro en directa, así que el umbral es la tensión Zener más una caída de unión.',
  error='Con dos Zener de 5,6 V el recorte queda en 6,3 V, «un 12,5 % por encima de lo previsto».')
X('bjt-exponencial',
  significa='«La corriente de colector no la fija el colector, la fija el emisor», y a su vez la fija V<sub>BE</sub>: el transistor es una fuente de corriente controlada por tensión.',
  valores='Tiene la misma pendiente que el diodo: 59,5 mV por década.',
  error='I<sub>C</sub> = β·I<sub>B</sub> es una consecuencia, no la causa: «confundir causa y consecuencia es el error conceptual más extendido sobre el transistor bipolar».')
X('gm-bjt',
  significa='La transconductancia mide cuánto cambia la corriente de colector por cada milivoltio de V<sub>BE</sub>: de ahí sale la amplificación.',
  valores='«A 1 mA, gm = 38,7 mS: cada milivoltio de entrada mueve 38,7 µA de colector».')
X('ib-resistencia-base',
  significa='La corriente de base la fija la tensión que queda en la resistencia de base: la de entrada menos la V<sub>BE</sub>.',
  valores='Desde 5 V con 100 kΩ, 43 µA; con β = 100 pediría 4,3 mA de colector.',
  aplica='Si β·I<sub>B</sub> «no cabe en el circuito exterior», el transistor satura.')
X('recta-carga',
  significa='Es la recta que «impone el circuito exterior» sobre las curvas de salida: corta el eje de V<sub>CE</sub> en V<sub>CC</sub> (corte) y el de I<sub>C</sub> en V<sub>CC</sub>/(R<sub>C</sub> + R<sub>E</sub>) (saturación).',
  aplica='Una señal en la base mueve el punto de trabajo a lo largo de la recta; cerca de la saturación o del corte, los picos se recortan.')
X('ie-beta',
  significa='«Un transistor en la región activa reparte la corriente de emisor en dos partes: la que llega al colector y la que sale por la base»; por Kirchhoff, la de emisor es (β + 1) veces la de base.',
  aplica='Vale en la región activa, donde I<sub>C</sub> = β·I<sub>B</sub>.')
X('alfa-beta',
  significa='α es la fracción de la corriente de emisor que llega al colector y β la relación entre lo que llega y lo que se pierde por la base: «son dos maneras de expresar el mismo hecho físico».',
  valores='«α vale siempre entre 0,98 y 0,997»; al restarla de uno, β pasa de 49 a 302: por eso β dispersa tanto y α no.')
X('vth-divisor-base',
  significa='Para analizar la polarización con divisor «se sustituye el divisor por su equivalente Thévenin»: una tensión V<sub>Th</sub> en serie con R<sub>1</sub> ∥ R<sub>2</sub>.',
  valores='Con 12 V, 47 kΩ y 10 kΩ: V<sub>Th</sub> = 2,105 V.')
X('rth-divisor-base',
  significa='«El divisor R₁–R₂ fija la tensión de base»; su resistencia de Thévenin es el paralelo de las dos, la que ve la base mirando hacia el divisor.',
  valores='Con 47 kΩ y 10 kΩ, 8,25 kΩ.')
X('ib-divisor',
  significa='Recorriendo la malla de entrada, la resistencia de emisor aparece multiplicada por (β + 1) vista desde la base: es la que estabiliza el punto de trabajo.',
  valores='Con β de 50 a 300 la corriente de colector solo varía de 1,186 a 1,363 mA: «β varía un 500 % y la corriente de colector solo un 15 %».')
X('av-emisor-comun',
  significa='Una variación de V<sub>BE</sub> mueve g<sub>m</sub>·v<sub>be</sub> de corriente, que en R<sub>C</sub> se convierte en tensión: la ganancia es −R<sub>C</sub>/r<sub>e</sub>.',
  valores='Con 3,3 kΩ y r<sub>e</sub> = 19,5 Ω, −169. «El signo negativo significa que la señal se invierte».',
  aplica='Con el emisor puenteado; si se deja R<sub>E</sub> sin puentear la ganancia baja mucho pero deja de depender del transistor.')
X('ib-saturacion-forzada',
  significa='Para asegurar la saturación se sobreexcita la base con un factor k entre 3 y 10 sobre lo que pediría el β mínimo.',
  error='I<sub>B</sub> = I<sub>C</sub>/β «es insuficiente»: hay que usar el β mínimo, que además cae a corrientes altas.',
  valores='Un motor de 500 mA con k = 5 pide 25 mA de base: «el diseño no cabe» en un pin de 20 mA.')
X('p-conmutacion-bjt',
  significa='En cada flanco tensión y corriente coexisten; esa energía, multiplicada por la frecuencia, son las pérdidas de conmutación.',
  valores='Con 12 V, 0,5 A y 1 µs: 6 mW a 1 kHz, 120 mW a 20 kHz y 600 mW a 100 kHz. «Ese cruce marca el límite práctico del bipolar como interruptor».',
  aplica='Es una cota pesimista (carga inductiva); con carga resistiva cada flanco pierde la tercera parte.')
X('r-pi',
  significa='Mirando desde la base, la corriente de base es β veces menor que la de colector, así que la resistencia de entrada es β/g<sub>m</sub>.',
  valores='Con β = 150 a 1,324 mA, 2,93 kΩ.',
  error='«Este parámetro sí depende de β»: por eso la impedancia de entrada es lo peor controlado de un emisor común.')
X('ro-early',
  significa='«La curva de salida no es horizontal»: su pendiente da la resistencia de salida del transistor, la tensión de Early entre la corriente.',
  valores='Con V<sub>A</sub> = 100 V a 1,324 mA, 75,5 kΩ.')
X('av-ec-ro',
  significa='La resistencia de salida del transistor queda en paralelo con R<sub>C</sub> y recorta algo la ganancia.',
  valores='Con 3,3 kΩ y 75,5 kΩ sale −162 en lugar de −169: «la resistencia de salida del transistor resta un 4,2 %».')
X('ganancia-intrinseca',
  significa='Es el techo de ganancia de una etapa bipolar: g<sub>m</sub>·r<sub>o</sub>, que no depende del punto de polarización porque «gm sube con la corriente y ro baja en la misma proporción».',
  valores='Con V<sub>A</sub> = 100 V, 3868.',
  aplica='Alcanzarla exige una carga activa.')
X('ft-bjt',
  significa='La frecuencia de transición es aquella en la que la ganancia de corriente cae a 1; es proporcional a g<sub>m</sub>: «un transistor es más rápido cuanto más corriente conduce».',
  aplica='Hasta que la alta inyección lo estropea; por eso en radiofrecuencia se polariza alto.')
X('bjt-early',
  significa='Las curvas de salida suben ligeramente con V<sub>CE</sub>: prolongadas, «todas cortan el eje de tensiones en un mismo punto negativo», la tensión de Early.',
  valores='V<sub>A</sub> está «entre 50 y 200 V en transistores discretos».',
  aplica='La causa es la modulación del ancho de la base.')
X('espejo-error-beta',
  significa='«La corriente de referencia no va entera al colector del primer transistor»: se reparte con las dos corrientes de base.',
  valores='Con β = 150 el error es del 1,32 %; con β = 50 sube al 3,85 %. Un tercer transistor lo baja a 2/β².')
X('espejo-desapareamiento',
  significa='Como la corriente depende exponencialmente de V<sub>BE</sub>, una diferencia minúscula entre los dos transistores produce un error grande.',
  valores='5 mV de diferencia dan un 21 % de error: «veintiún por ciento por cinco milivoltios».',
  error='«Un espejo con transistores discretos sueltos no funciona bien»: hacen falta pares apareados a la misma temperatura.')
X('av-carga-activa',
  significa='Un espejo de corriente como carga presenta una impedancia altísima en alterna sin dejar caer apenas continua.',
  valores='Con 51,2 mS y 37,7 kΩ, 1930 frente a los 162 de la carga resistiva: «doce veces más ganancia».',
  aplica='Es la etapa de entrada de todo operacional.')
X('hd2',
  significa='El término cuadrático de la característica genera el segundo armónico: su distorsión relativa crece en proporción a la amplitud.',
  valores='«HD₂ crece proporcionalmente a la amplitud (1 dB por cada dB de señal)».')
X('hd3',
  significa='El término cúbico genera el tercer armónico, y su distorsión crece con el cuadrado de la amplitud.',
  aplica='«Al subir el nivel de una etapa la distorsión de tercer orden se dispara mucho antes que la de segundo».')
X('thd-2-3',
  significa='La distorsión armónica total suma en cuadratura las de cada armónico.',
  valores='Con a₂ = 0,05 y a₃ = −0,02: 1,26 % con amplitud 0,5 y 5,39 % con amplitud 2. «Duplicar la amplitud duplica HD₂ y cuadruplica HD₃».')
X('compresion-1db',
  significa='Cuando a₃ tiene signo contrario a a₁, «la ganancia efectiva disminuye al crecer la señal»: el punto de compresión de 1 dB es la amplitud a la que ha caído 1 dB.')
X('ip3',
  significa='El IP3 es la amplitud extrapolada a la que los productos de intermodulación de tercer orden igualarían a la fundamental.',
  valores='La relación entre IP3 y compresión es una constante: 9,64 dB, «la que permite estimar el IP3 de un amplificador midiendo solo su compresión».')
X('ganancia-multietapa',
  significa='«Encadenando etapas, la ganancia total no es el producto de las ganancias en vacío»: cada etapa carga a la anterior formando un divisor.',
  valores='«Si las dos impedancias son iguales se pierde la mitad de la ganancia»; para conservar el 90 % la entrada debe ser diez veces la salida.')
X('ve-vb', ref='sec-6.10',
  significa='El emisor sigue a la base con una caída de unión de unos 0,7 V.',
  aplica='Esa caída tiene la deriva del diodo, «baja 2 mV/°C a corriente constante»: con polarización fija de base la corriente crece al calentarse.')
X('ic-ve-re', ref='sec-6.10',
  significa='Con la tensión de emisor fijada por la base, la resistencia de emisor convierte esa tensión en la corriente de colector, casi sin depender de β.',
  valores='«Una caída de 1 a 2 V en RE hace la polarización prácticamente insensible a la β y a la temperatura»; con menos de 0,5 V la estabilización es débil.')
X('p-saturacion',
  significa='«En saturación VCE cae a unos 0,2 V, y la disipación es mínima».',
  valores='0,2 V por 0,5 A son 100 mW: un 1,7 % de lo que disipa la carga.',
  error='Si queda en activa, con 2 V de V<sub>CE</sub> son 1 W: la disipación se multiplica por diez.')
X('mosfet-saturacion',
  significa='En la región de saturación «la corriente de drenador sigue una ley cuadrática con la tensión de compuerta», casi independiente de V<sub>DS</sub>.',
  aplica='Vale con V<sub>GS</sub> por encima del umbral y V<sub>DS</sub> grande; con V<sub>DS</sub> pequeña el canal es una resistencia (región óhmica).')
X('pwm-media',
  significa='Con PWM se conmuta el MOSFET entre encendido y apagado, y el ciclo de trabajo fija la potencia media entregada.',
  aplica='Es eficiente porque el MOSFET «o está totalmente apagado», o totalmente encendido y con R<sub>DS(on)</sub> mínima.')
X('p-conduccion-mosfet',
  significa='Las pérdidas de conducción son las de R<sub>DS(on)</sub> durante la fracción D del periodo: «la primera no depende de la frecuencia».',
  aplica='Junto a las de conmutación, que sí crecen con f, son «la base de toda la electrónica de potencia».')
X('p-conmutacion-mosfet',
  significa='Durante cada flanco tensión y corriente coexisten; esa energía por la frecuencia son las pérdidas de conmutación, «proporcional a ella».',
  valores='Con 5 A, 24 V y 50 ns: 0,06 W a 20 kHz, 0,30 W a 100 kHz y 1,50 W a 500 kHz.',
  error='«Elegir un transistor de resistencia bajísima pero puerta enorme para trabajar a 500 kHz es un error frecuente».')
X('t-conmutacion-qg',
  significa='«La puerta es un condensador, y lo que la carga es corriente, no tensión»: el tiempo de conmutación es la carga de puerta entre la corriente del driver.',
  valores='Con 30 nC, un driver de 100 mA tarda 300 ns y uno de 1 A, 30 ns.',
  error='Un driver débil multiplica las pérdidas: «la disipación aparece en el MOSFET, pero la causa está en el driver».')
X('p-recuperacion',
  significa='Al encender el transistor opuesto de un puente hay que retirar la carga almacenada en el diodo de cuerpo, que circula como un pico de corriente a la tensión completa.',
  valores='Con 400 V, 200 nC y 100 kHz, 4 W «que no aparecen en ningún cálculo de conducción ni de conmutación normal».',
  aplica='El diodo de cuerpo «es un diodo malo» en recuperación: t<sub>rr</sub> de 100 a 500 ns.')
X('f-cruce-mosfet',
  significa='Es la frecuencia en la que las pérdidas de conducción y de conmutación se igualan: por encima dominan las de conmutación.',
  valores='Un MOSFET de 8 mΩ y 80 nC cruza a 44 kHz; uno de 25 mΩ y 20 nC, a 556 kHz.',
  aplica='«La respuesta es que no hay un ganador absoluto»: por debajo del cruce se elige por R<sub>DS(on)</sub>, por encima por la carga de puerta.')
X('i-pico-driver',
  significa='«La puerta es un condensador y lo que la carga es corriente»: el pico lo limitan la resistencia de puerta y la del driver.',
  valores='Con 10 V y 2 Ω de driver: 1,49 A con 4,7 Ω, 0,83 A con 10 Ω y 0,42 A con 22 Ω.',
  aplica='Bajar R<sub>g</sub> acelera la conmutación pero aumenta la interferencia: es el compromiso.')
X('p-driver',
  significa='Lo que consume el propio driver es la carga de puerta por la tensión de excitación, en cada ciclo.',
  valores='Con 60 nC y 10 V, 60 mW a 100 kHz y 300 mW a 500 kHz: «lo que consume el propio driver es pequeño».')
X('ao-inversor',
  significa='«La señal entra por la entrada inversora a través de una resistencia R₁, con una resistencia de realimentación R₂ desde la salida»; la ganancia es negativa: invierte la señal.',
  aplica='La fija la relación de resistencias, no el operacional, mientras su ganancia en lazo abierto sea muy grande.')
X('ao-no-inversor',
  significa='«La salida está en fase con la entrada y la ganancia es siempre mayor o igual a 1».',
  valores='Para ganancia 10 hace falta R<sub>2</sub>/R<sub>1</sub> = 9; con 1 kΩ y 9,1 kΩ sale 10,1.',
  aplica='Con R<sub>2</sub> = 0 es el seguidor de tensión, de ganancia exactamente 1.')
X('p-regulador-lineal',
  significa='Un regulador lineal es «un divisor de tensión cuya parte superior se ajusta sola»: toda la diferencia de tensión cae en el elemento de paso con la corriente de la carga.',
  valores='12 V a 5 V con 1 A: 7 W disipados y un rendimiento del 41,7 %.',
  error='El defecto «es aritmético e inevitable»: la corriente de entrada es la de salida, sea cual sea la diferencia de tensiones.')
X('ne555-astable',
  significa='«El condensador se carga a través de Ra y Rb, y se descarga a través de Rb», oscilando entre un tercio y dos tercios de la alimentación.',
  error='El ciclo de trabajo siempre supera el 50 %; bajar de ahí «exige un diodo en paralelo con Rb».')
X('ne555-monoestable',
  significa='Cada disparo produce «un único pulso de duración fija»: el tiempo que tarda el condensador en cargarse de cero a dos tercios de la alimentación.',
  aplica='«El 1,1 de la fórmula es ln3 redondeado, con un error del 0,13 %».')
X('lm317', ref='sec-8.4',
  significa='«El LM317 y sus parientes mantienen 1,25 V entre su salida y su terminal de ajuste», y con un divisor se fija la tensión deseada.',
  valores='Con R<sub>1</sub> = 240 Ω, 9 V piden R<sub>2</sub> ≈ 1,5 kΩ.')
X('lm317-iadj', ref='sec-8.4',
  significa='La corriente que sale por el terminal de ajuste también atraviesa R<sub>2</sub> y suma una pequeña tensión a la salida.',
  valores='«Su corriente de ajuste (50 a 100 µA) introduce un pequeño error que conviene tener en cuenta con divisores de valor alto».')
X('slew-rate-fmax',
  significa='El slew rate es «la velocidad máxima de la salida, en V/µs»; una senoide de pico V<sub>p</sub> no puede subir más deprisa de 2π·f·V<sub>p</sub>.',
  valores='Con 0,5 V/µs y 10 V de pico, 8 kHz. «Por encima, la senoide se convierte en triángulo».')
X('rendimiento-lineal',
  significa='En un regulador lineal la corriente de entrada es la de salida, así que el rendimiento es el cociente de tensiones.',
  valores='De 12 a 5 V, 41,7 %: «se disipa más de lo que se entrega».')
X('error-ron-mux',
  significa='La resistencia del interruptor del multiplexor «forma divisor con la impedancia de entrada del ADC».',
  valores='100 Ω frente a 1 MΩ dan 0,01 %; con una entrada de 100 kΩ el error sube al 0,1 %: «4 LSB de error, 2 bits perdidos».')
X('margen-ruido-alto',
  significa='El margen es «lo que sobra entre lo que la salida garantiza entregar y lo que la entrada exige reconocer», en nivel alto.',
  valores='0,40 V en TTL y 0,90 V en CMOS HC a 5 V.',
  error='Una salida TTL (2,4 V) contra una entrada HC (3,5 V) da un margen negativo de −1,10 V.')
X('margen-ruido-bajo',
  significa='En nivel bajo, el margen es lo que separa el máximo que la entrada acepta como cero del máximo que la salida entrega.',
  valores='0,40 V en TTL y 1,17 V en CMOS HC a 5 V. El margen es «lo que sobra entre lo que la salida garantiza entregar y lo que la entrada exige reconocer».')
X('mtbf-metaestabilidad',
  significa='La metaestabilidad «no se puede eliminar», pero su probabilidad decae exponencialmente con el tiempo que se concede al flip-flop para resolverse.',
  aplica='«Conceder un ciclo de reloj más a la resolución multiplica el MTBF por un factor enorme»: de ahí el sincronizador de dos flip-flops.')
X('temperatura-union',
  significa='El calor atraviesa en serie las resistencias térmicas unión-cápsula, cápsula-disipador y disipador-ambiente, «análogas a las resistencias eléctricas».',
  valores='El límite de la unión es «típicamente 150 °C para el silicio».',
  aplica='La pasta térmica es la R<sub>cs</sub>: sin ella las superficies quedarían separadas por aire.')
X('energia-soldadura',
  significa='Para formar una junta hay que calentar y fundir el estaño y calentar el cobre: un balance de energía.',
  valores='Una junta típica pide 4,75 J; con 65 W se entregarían en 73 ms, pero «en la práctica hacen falta 2 o 3 segundos».')
X('r-termica-plano',
  significa='El calor se extiende en radial por el cobre del plano; la resistencia de ese disco crece con el logaritmo de los radios.',
  valores='Un pad conectado directamente a un plano ve unos 31 K/W y pierde 6,3 W mientras se suelda; con alivio térmico, unos 62 K/W.',
  aplica='Con un plano conectado, «el problema deja de ser de energía y pasa a ser de potencia».')
X('frecuencia-intermedia',
  significa='El superheterodino «traslada la señal a una frecuencia intermedia fija» mezclándola con un oscilador local y quedándose con la diferencia.',
  valores='«Los valores normalizados: 455 kHz en AM y 10,7 MHz en FM».')
X('frecuencia-imagen',
  significa='El mezclador no distingue el signo de la diferencia: «hay dos emisoras que producen la misma FI», la deseada y la imagen, a 2·FI por encima.',
  valores='Con FI de 10,7 MHz, la imagen está siempre a 21,4 MHz de la emisora.',
  aplica='Por eso hace falta un circuito sintonizado antes del mezclador, y por eso conviene una FI alta.')
X('adc-arduino',
  significa='La conversión habitual de los programas de Arduino: el código del ADC de 10 bits por la referencia entre 1023.',
  error='«Un ADC de 10 bits divide el margen de referencia en 1024 escalones, no 1023»: dividir entre 1023 es cómodo pero introduce un pequeño error.')
X('lsb-adc',
  significa='El escalón de un convertidor de n bits es la referencia dividida en 2ⁿ partes: la menor variación que distingue.',
  valores='«Un ADC de 10 bits divide el margen de referencia en 1024 escalones»: con 5 V, cada uno vale 4,8828 mV.')
X('adc-centro',
  significa='«La mejor estimación de la tensión es por tanto el centro del intervalo»: el código k significa que la entrada estaba entre k y k + 1 escalones.',
  valores='Con 10 bits y 5 V, el código 512 son 2,50244 V.')
X('desbordamiento-millis',
  significa='Un contador de n bits que avanza cada tick da la vuelta tras 2ⁿ ticks.',
  valores='millis() es de 32 bits en milisegundos: da la vuelta a los 49,7 días.',
  error='Las comparaciones directas fallan en el desbordamiento: «la forma correcta de comparar tiempos es siempre por diferencia».')
X('autonomia',
  significa='La autonomía es la capacidad de la batería entre el consumo medio: el cálculo «que decide la mayoría de los proyectos a pilas».',
  valores='Con 2000 mAh y 38 µA de media, unos seis años; un ordenador de placa a 400 mA, cinco horas.',
  aplica='Es teórica: la limita en la práctica la autodescarga.')
X('consumo-medio',
  significa='El consumo medio pondera la corriente activa y la de reposo por la fracción del tiempo que dura cada una.',
  valores='«Con 20 mA activo durante 100 ms cada minuto y 5 µA durmiendo» la media es de unos 38 µA.')
X('optoacoplador-if',
  significa='La CTR es la relación entre la corriente de colector y la del LED: para obtener I<sub>C</sub> hay que inyectar I<sub>C</sub>/CTR en el diodo.',
  aplica='«La CTR se degrada con la vida, típicamente a la mitad»: se diseña con una CTR efectiva de la mitad de la mínima.',
  error='Olvidar el límite del pin: 20 mA para el LED superan los 16 mA que admite un GPIO; la solución estándar es un transistor de excitación.')
X('condensador-respaldo',
  significa='La energía que entrega un condensador al bajar de V<sub>1</sub> a V<sub>2</sub> es ½C(V₁² − V₂²); igualándola a P·t sale la capacidad.',
  valores='Para 2,5 W durante 50 ms entre 5 y 4,5 V hacen falta 53 mF.',
  aplica='«El resultado descarta el condensador convencional»: se recurre a otras soluciones, como un sistema de ficheros de solo lectura.')
X('caudal-datos',
  significa='El caudal de un enlace de adquisición es canales × frecuencia de muestreo × bits por muestra, multiplicado por la sobrecarga del protocolo.',
  valores='8 canales a 100 Hz con 16 bits y factor 2 dan 25,6 kbit/s, que caben en un UART a 115 200 baudios.',
  aplica='«Ese cálculo, hecho antes, evita descubrir a mitad del proyecto que el enlace no da».')
X('capacidad-carga-cristal',
  significa='Los dos condensadores del cristal, en serie, más la capacidad parásita forman la capacidad de carga, «la capacidad que el circuito debe presentarle para que oscile a su frecuencia nominal».',
  valores='Para un cristal de 18 pF con 4 pF de parásita, C<sub>1</sub> y C<sub>2</sub> de unos 28 pF.',
  error='Montar los del ejemplo sin comprobar: con condensadores demasiado pequeños el oscilador va rápido, y con demasiado grandes, lento o no arranca.')
X('puente-exacto',
  significa='Es la salida exacta de un puente con una sola rama activa; la aproximación habitual (V<sub>exc</sub>/4)·(ΔR/R) ignora «la no linealidad intrínseca del puente».',
  valores='Con ΔR/R del 5 % la salida exacta es 0,012195·V frente a 0,0125·V lineal: un 2,5 % de error.',
  aplica='Regla práctica: «el error de linealidad es aproximadamente la mitad de ΔR/R».')
X('ciclos-pantalla',
  significa='La pantalla tiene 12 divisiones horizontales: el tiempo visible por la frecuencia da los ciclos que se ven.',
  valores='Para 1 kHz y dos ciclos salen 170 µs/div, y se elige 200 µs/div, «el valor comercial más próximo».',
  aplica='Para ver la forma general y la frecuencia, de 2 a 4 ciclos; para un flanco, menos de uno.')
X('resolucion-fft',
  significa='Una FFT separa líneas espectrales distanciadas el inverso del tiempo capturado: «la resolución la fija el tiempo capturado, no la frecuencia de muestreo».',
  valores='Para distinguir dos rayas separadas 10 Hz hacen falta 100 ms de captura.')
X('nyquist-fft',
  significa='Las N muestras se convierten en N/2 líneas espectrales que llegan hasta la mitad de la frecuencia de muestreo.',
  valores='«Con 1 000 puntos capturados en 1 ms: resolución de 1 kHz y margen hasta 500 kHz».')
X('muestras-fft',
  significa='Los puntos de una captura son la frecuencia de muestreo por el tiempo capturado.',
  valores='Con 1 MS/s y 100 ms son 100 000 puntos, que es donde entra la profundidad de memoria del instrumento.',
  aplica='Una resolución fina exige capturar mucho tiempo, «y eso obliga a bajar la base de tiempos aunque la señal parezca comprimida en pantalla».')
X('thd-desde-db',
  significa='Cada armónico en dB respecto a la fundamental se convierte a relación de potencias y se suman en cuadratura.',
  valores='Con el segundo armónico a −60 dB y el tercero a −66 dB, la THD es del 0,11 %.',
  error='No medir el generador solo: «Si su distorsión no está muy por debajo de la medida, lo que se ha medido es el generador».')
X('ruido-por-hz',
  significa='El suelo de ruido de una FFT depende de la resolución; restando 10·log de la resolución se refiere a 1 Hz de ancho de banda.',
  valores='Un suelo de −90 dBm con resolución de 100 Hz son −110 dBm/Hz.',
  aplica='«Sin esa corrección, dos medidas del mismo circuito con ajustes distintos dan números distintos».')
X('rizado-porcentaje',
  significa='El rizado pico a pico de una fuente, medido en acoplamiento AC, expresado como fracción de su tensión continua.',
  valores='«Una fuente bien diseñada tiene un rizado inferior al 1% de la tensión de salida».',
  error='Medir con un latiguillo de masa largo: capta ruido y falsea la medida.')
X('tiempo-subida-bw',
  significa='El ancho de banda equivale a un tiempo de subida mínimo: es el flanco más rápido que el instrumento puede mostrar.',
  valores='Un osciloscopio de 50 MHz tiene 7 ns de tiempo de subida.',
  aplica='Ese tiempo «se suma en cuadratura al de la señal»: un flanco real de 5 ns aparece como 8,6 ns.')
X('muestreo-real',
  significa='Con memoria limitada, «la velocidad real de muestreo no es la de portada» sino los puntos repartidos en la ventana de tiempo.',
  valores='Con 1 000 puntos y 12 divisiones, a 1 ms/div se muestrea a 83 kS/s: nada por encima de 42 kHz sin alias.',
  error='Una conmutación de unos 250 kHz aparece como una onda lenta perfectamente creíble: «el engaño más peligroso del instrumento».')
X('ne555-t-alto',
  significa='En el astable el condensador se carga a través de R<sub>A</sub> + R<sub>B</sub> desde 1/3 hasta 2/3 de la alimentación.',
  valores='Con R<sub>A</sub> = 10 kΩ, R<sub>B</sub> = 47 kΩ y C = 1 µF, t<sub>alto</sub> = 39,5 ms.',
  aplica='El 0,693 es ln 2, porque «el condensador recorre siempre la mitad del camino restante».')
X('ne555-t-bajo',
  significa='La descarga va solo a través de R<sub>B</sub>, de 2/3 a 1/3 de la alimentación: por eso el tiempo en bajo es siempre menor que el alto.',
  valores='Con R<sub>B</sub> = 47 kΩ y C = 1 µF, t<sub>bajo</sub> = 32,6 ms.',
  aplica='Como los umbrales siguen a la alimentación, «la frecuencia no depende de la tensión de alimentación».')
X('z0-lc',
  significa='La impedancia característica √(L/C) es la reactancia común de la bobina y el condensador en resonancia.',
  valores='Con L = 10 mH y C = 100 nF, Z<sub>0</sub> = 316 Ω.',
  aplica='Es la referencia con la que se compara la resistencia para obtener Q; predecirla antes de medir importa porque «la comparación entre lo predicho y lo medido es lo que enseña».')
X('q-serie',
  significa='En un RLC serie, Q es la impedancia característica entre la resistencia: cuántas veces domina la reactancia sobre las pérdidas.',
  valores='Con Z<sub>0</sub> = 316 Ω y R = 100 Ω, Q = 3,16.',
  aplica='«Anotar estos cuatro números antes de encender es parte del ejercicio».')
X('bw-q',
  significa='El ancho de banda entre los puntos de −3 dB es la frecuencia de resonancia dividida por Q: a más Q, pico más estrecho.',
  valores='Con f<sub>0</sub> = 5 033 Hz y Q = 3,16, BW = 1 592 Hz.',
  aplica='Al barrer la frecuencia, el máximo «es la frecuencia de resonancia, donde la impedancia total es mínima».')
X('tiempo-subida-combinado',
  significa='Lo que se ve en pantalla combina en cuadratura el tiempo de subida de la señal y el del instrumento.',
  aplica='Por eso «un flanco más rápido que el instrumento aparezca con el tiempo de subida del instrumento», no con el suyo.',
  error='Medir sin compensar la sonda: la medida es de la sonda y no del sistema.')
X('indice-am',
  significa='El índice de modulación se lee directamente de la envolvente en pantalla, con su máximo y su mínimo.',
  valores='Con 3 V de máximo y 1 V de mínimo, m = 0,5, es decir, el 50 %.',
  error='La comprobación es «subir el índice por encima del 100 %»: la envolvente se cruza, aparece la sobremodulación, y al demodularla la señal sale distorsionada de forma irrecuperable.')
X('carson',
  significa='La FM produce múltiples pares de bandas laterales; la regla de Carson estima la banda ocupada con la desviación más la frecuencia moduladora.',
  valores='Con una desviación de 5 kHz y un tono de 1 kHz ocupa 12 kHz, seis veces más que la AM equivalente.',
  aplica='Explica «por qué la FM comercial ocupa 200 kHz por emisora y la AM 9 kHz».')
X('thevenin-medida',
  significa='R<sub>Th</sub> «se puede medir sin conocer el circuito»: basta la tensión en vacío y la tensión con una carga conocida.',
  valores='Una salida de 5,00 V en vacío que cae a 4,85 V con 100 Ω tiene 3,1 Ω de resistencia de Thévenin.',
  error='Medir despacio: en una batería la tensión sigue cayendo mientras se descarga y el resultado se contamina.')
X('norton',
  significa='Norton es el dual de Thévenin: una fuente de corriente igual a la de cortocircuito, en paralelo con la misma resistencia.',
  valores='Con 9 V y 3 Ω de Thévenin, I<sub>N</sub> = 3 A en paralelo con 3 Ω.',
  aplica='«Thévenin y Norton describen la misma red: se elige uno u otro según convenga al cálculo».')
X('potencia-maxima',
  significa='La carga recibe la máxima potencia cuando su resistencia iguala la de Thévenin de la fuente; esa potencia es V<sub>Th</sub>²/4R<sub>Th</sub>.',
  valores='Con 10 V y 50 Ω, el máximo es de 0,5 W con una carga de 50 Ω.',
  aplica='Es «una curva muy plana en el máximo»: con la carga al doble o a la mitad todavía se entrega el 89 %.')
X('potencia-carga',
  significa='La potencia en la carga es el cuadrado de la corriente que da la fuente real por la resistencia de carga.',
  aplica='El máximo está en R<sub>L</sub> = R<sub>Th</sub>, y «equivocarse en un factor 2 en cualquier sentido cuesta» muy poco.')
X('millman-3',
  significa='La tensión del nodo es «la media de las tensiones, ponderada por las conductancias».',
  aplica='No es un teorema nuevo: es el análisis nodal aplicado a un solo nodo; sirve para fuentes en paralelo y sumadores pasivos.')
X('fase-retardo',
  significa='El desfase entre dos señales de la misma frecuencia es su desplazamiento en el tiempo como fracción del periodo, en grados.',
  error='«La fase solo tiene sentido entre dos señales de la misma frecuencia»: la fase de una señal aislada no significa nada.')
X('reactancia-inductiva',
  significa='La bobina tiene impedancia jωL: su oposición crece con la frecuencia y la tensión adelanta 90° a la corriente.',
  aplica='Todo descansa en que «derivar e^(jωt) equivale a multiplicar por jω».')
X('z-rc-serie',
  significa='En un RC serie la resistencia y la reactancia están en cuadratura: el módulo de la impedancia se calcula como una hipotenusa.',
  valores='1 kΩ y 100 nF a 1 kHz dan 1 880 Ω con −57,9° de fase.',
  error='Sumar los módulos: «el módulo de la impedancia no es la suma de 1 000 y 1 592».')
X('factor-potencia',
  significa='El factor de potencia es la fracción de la potencia aparente que se aprovecha como activa; con señales senoidales coincide con cos φ.',
  valores='Una carga de 230 V y 10 A con FP 0,8 consume 1 840 W de 2 300 VA.',
  aplica='Un factor bajo «obliga a sobredimensionar toda la instalación para entregar una potencia útil menor».')
X('potencia-aparente',
  significa='La potencia aparente es el producto de la tensión y la corriente eficaces: lo que deben soportar cables, transformador y protecciones.',
  valores='230 V × 10 A = 2 300 VA: «El usuario aprovecha 1 840 W, pero el cableado, el transformador y la protección deben soportar 10 A».')
X('potencia-activa',
  significa='La potencia activa es la que realmente se consume: la aparente por el factor de potencia.',
  aplica='Con φ = 90°, en una bobina o un condensador ideales, «circula corriente, hay tensión, y no se consume nada».')
X('potencia-reactiva',
  significa='La reactiva mide la energía que va y vuelve cada medio ciclo entre la fuente y la carga: es la amplitud de ese vaivén.',
  valores='Con 2 300 VA y FP 0,8 son 1 380 VAr.',
  aplica='No consume, pero su corriente produce «Pérdidas en los cables», que van con I², y no con la potencia útil.')
X('compensacion-total',
  significa='Un condensador en paralelo toma corriente adelantada que cancela la retrasada de la carga inductiva: aporta la reactiva en el propio sitio.',
  valores='Con 1 380 VAr a 50 Hz y 230 V hacen falta 83 µF, y la corriente baja de 10 a 8 A.',
  error='Creer que se ahorra energía: «no se ha ahorrado energía», porque la reactiva no consumía; se reduce la corriente y sus pérdidas.')
X('q-rlc',
  significa='Q mide la nitidez de la resonancia: la reactancia en resonancia comparada con la resistencia de pérdidas.',
  aplica='«Un Q alto significa una resonancia estrecha y muy selectiva»: es la base de la sintonía en radio.')
X('bw-rl',
  significa='En un RLC serie, el ancho de banda entre los puntos de media potencia solo depende de R y L: los términos en 1/C se cancelan.',
  aplica='La frecuencia de resonancia es la media geométrica de los dos cortes: «La curva es simétrica en escala logarítmica, no en lineal».')
X('admitancia-g',
  significa='Al invertir una impedancia R + jX, su parte real es la conductancia, que mezcla resistencia y reactancia.',
  valores='Con R = 100 Ω y X = 140 Ω, G = 3,38 mS, mientras que 1/R serían 10 mS.',
  error='La trampa: «G no es 1/R en cuanto hay reactancia en serie».')
X('admitancia-b',
  significa='La susceptancia es la parte imaginaria de la admitancia: con reactancia inductiva sale negativa.',
  valores='Con R = 100 Ω y X = +140 Ω, B = −4,73 mS.',
  aplica='Su utilidad es práctica: «en paralelo las admitancias se suman», igual que las impedancias en serie.')
X('compensacion-fp',
  significa='El condensador aporta la diferencia entre la reactiva inicial, P·tan φ₁, y la objetivo, P·tan φ₂, sin consumir potencia activa.',
  aplica='La misma instalación «entrega más potencia útil sin engrosar los cables».')
X('inductancia-mutua',
  significa='Dos bobinas próximas comparten flujo; k es el coeficiente de acoplamiento, «entre 0 (ninguna interacción) y 1».',
  valores='En un transformador con núcleo cerrado, «k llega a 0,99 o más».',
  error='Confundir los puntos de polaridad invierte la fase de la salida y puede convertir una realimentación negativa en positiva.')
X('impedancia-reflejada',
  significa='Visto desde el primario, «un transformador transforma impedancias con el cuadrado de la relación».',
  valores='Un altavoz de 8 Ω a través de un transformador 10:1 se ve como 800 Ω.',
  aplica='Permite adaptar impedancias sin disipar: «la válvula quiere miles de ohmios y el altavoz ofrece ocho».')
X('amortiguamiento', ref='sec-24.3',
  significa='El factor de amortiguamiento decide la forma de la respuesta de un RLC: sobreamortiguado si ζ > 1, oscilante si ζ < 1.',
  valores='Con ζ = 1 el circuito es el más rápido «sin sobreoscilación»; con ζ = 0,2, el sobreimpulso es del 53 %.')
X('omega0', ref='sec-24.6',
  significa='«La resonancia ocurre cuando las reactancias inductiva y capacitiva se igualan y se cancelan»: ωL = 1/(ωC).',
  aplica='Es la pulsación en radianes por segundo; dividida entre 2π da la frecuencia de resonancia en hercios.')
X('q-zeta', ref='sec-24.3',
  significa='«ζ y Q son la misma cosa vista de dos formas»: el amortiguamiento en el tiempo y la selectividad en frecuencia.',
  valores='«Un circuito con Q = 0,5 está críticamente amortiguado».')
X('z-rlc-serie', ref='sec-24.6',
  significa='Las reactancias de la bobina y el condensador se restan; la diferencia y la resistencia se suman en cuadratura.',
  aplica='En resonancia la diferencia se anula y «un circuito RLC serie presenta impedancia mínima (solo R)».')
X('triangulo-potencias', ref='sec-24.5',
  significa='Activa y reactiva son los catetos de un triángulo cuya hipotenusa es la aparente.',
  valores='1 840 W y 1 380 VAr dan 2 300 VA.',
  aplica='Con cos φ = 0,5, «la instalación transporta el doble de corriente» de la que corresponde a la potencia consumida.')
X('db-potencia',
  significa='«Un decibelio es una relación, no una cantidad»: diez veces el logaritmo del cociente entre dos potencias.',
  valores='6 dB son el doble de tensión y cuatro veces la potencia.',
  error='«Confundir cuál de las dos magnitudes se está comparando»: 10·log para potencias, 20·log para tensiones.')
X('orden-filtro',
  significa='Cada orden aporta 20 dB por década; el orden mínimo es la atenuación pedida entre lo que da un orden en esa separación.',
  valores='60 dB a una década del corte piden 3 órdenes; al doble de la frecuencia de corte harían falta 10.',
  aplica='«Separar bien la banda de paso de la de rechazo abarata enormemente el filtro».')
X('condensador-conmutado',
  significa='Un condensador conmutado entre dos nodos transporta C·ΔV por ciclo: su corriente media equivale a una resistencia 1/(C·f).',
  valores='Con 1 pF y 100 kHz, 10 MΩ, que en un chip «ocupa un espacio ridículo».',
  aplica='La frecuencia de corte la fija el reloj y depende solo de una relación entre condensadores.')
X('orden-filtro-decadas',
  significa='El orden mínimo es la atenuación requerida entre 20 dB por cada década de separación respecto al corte.',
  valores='60 dB a una década piden orden 3; con media década, orden 6.',
  aplica='«La exigencia no la fija la atenuación sola, sino la atenuación dividida por la separación en frecuencia».')
X('frecuencia-central',
  significa='La frecuencia central de un filtro de banda es «la media geométrica de ambos cortes, no la aritmética».',
  aplica='Con ella, Q = f<sub>0</sub>/B, el mismo Q de la resonancia.')
X('shockley',
  significa='La corriente de una unión crece exponencialmente con la tensión, escalada por la tensión térmica y el factor de idealidad n.',
  valores='En la unión base-emisor de un transistor, n ≈ 1; V<sub>T</sub> ronda 26 mV.',
  aplica='Derivándola salen los parámetros de pequeña señal: «linealizar alrededor del punto de trabajo».')
X('tension-termica',
  significa='La tensión térmica kT/q es la escala natural de la exponencial de una unión.',
  valores='Vale 25,85 mV a 300 K y 25,69 mV a 25 °C; se redondea a 26 mV, y la diferencia queda «muy por debajo de la dispersión de cualquier componente».')
X('r-pi-gm',
  significa='La resistencia de entrada de pequeña señal r<sub>π</sub> sale de la definición de β: la corriente de base es la de colector entre β.',
  valores='A 1 mA, con β = 100, r<sub>π</sub> = 2 585 Ω; a 10 mA, 259 Ω.',
  aplica='Como g<sub>m</sub> = I<sub>C</sub>/V<sub>T</sub>, «la transconductancia no depende del transistor, solo de la corriente».')
X('gm-mosfet',
  significa='En saturación, la transconductancia del MOSFET «crece solo con la raíz de la corriente y depende del dispositivo a través de k».',
  aplica='Es la diferencia con el bipolar, donde g<sub>m</sub> = I<sub>C</sub>/V<sub>T</sub>.',
  error='La palabra saturación significa lo contrario en MOSFET y en BJT: en el MOSFET es la región de corriente constante.')
X('capacidad-union',
  significa='La zona de agotamiento es un aislante entre dos conductores; como se ensancha con la tensión inversa, «la capacidad disminuye al aumentarla».',
  valores='El exponente m está «entre 0,33 y 0,5 según el perfil de dopaje».',
  aplica='Es la capacidad que explota el varicap y la C<sub>µ</sub> del modelo del transistor.')
X('tiempo-transito-base',
  significa='Los portadores atraviesan la base por difusión; el tiempo crece con el cuadrado del espesor.',
  valores='Con una base de 0,5 µm y D = 35 cm²/s, τ<sub>B</sub> = 36 ps.',
  aplica='«Reducir la base a la mitad divide el tiempo por cuatro»: por eso los transistores de RF tienen bases finísimas.')
X('rdson-temperatura',
  significa='La movilidad de los portadores baja con la temperatura, y la resistencia en conducción del MOSFET sube un 0,7 % por grado.',
  valores='A 100 °C, «eso da un 50 % más» que a 25 °C.',
  aplica='Ese coeficiente positivo permite ponerlos en paralelo sin resistencias de reparto, y hay que incluirlo al calcular la disipación.')
X('av-ic-rc', ref='sec-26.4',
  significa='La ganancia del emisor común es g<sub>m</sub>·R<sub>C</sub> = I<sub>C</sub>·R<sub>C</sub>/V<sub>T</sub>: solo depende de la caída de tensión en la resistencia de colector.',
  valores='Con 2,5 V de caída en R<sub>C</sub> la ganancia es de unos 97, sea cual sea el transistor.',
  aplica='Es consecuencia de que «la transconductancia no depende del transistor, solo de la corriente».')
X('capacidad-difusion', ref='sec-26.7',
  significa='En directa hay carga almacenada a ambos lados de la unión; cambiar la corriente exige cambiar esa carga, y eso se comporta como una capacidad proporcional a la corriente.',
  aplica='Por eso «un diodo es más lento cuanto más conduce», lo que no es nada intuitivo.')
X('realimentacion',
  significa='Realimentar negativamente es «restar de la entrada una fracción de la salida»: la ganancia baja pero se vuelve precisa, lineal y estable.',
  valores='Con A = 10⁵ y β = 1/11, la ganancia es 10,9988: un error del 0,011 % respecto al 11 ideal.',
  aplica='Cuando A·β ≫ 1, «la ganancia del conjunto ya no depende del amplificador, solo de la red de realimentación».')
X('ao-inversor-rf',
  significa='El nodo inversor es una masa virtual: la corriente que entra por R<sub>in</sub> sale entera por R<sub>f</sub>, y la salida invierte el signo.',
  error='Su impedancia de entrada es R<sub>in</sub>, «ni más ni menos»: no es alta, y ese es su principal inconveniente.')
X('ao-no-inversor-rf',
  significa='La señal entra por la entrada no inversora y el divisor R<sub>f</sub>–R<sub>g</sub> devuelve una fracción de la salida.',
  aplica='«Impedancia de entrada altísima», la del propio operacional, y no invierte.',
  error='«La ganancia mínima es 1»: no puede atenuar, que es su limitación estructural.')
X('transimpedancia',
  significa='La corriente de entrada va directamente al nodo inversor y atraviesa R<sub>f</sub>: la salida es esa corriente por la resistencia.',
  aplica='Es lo que hace falta con un fotodiodo, y su detalle imprescindible es «el condensador en paralelo con Rf», sin el cual el circuito oscila.')
X('sumador',
  significa='Como el nodo inversor es masa virtual, «las corrientes se suman» y la salida es la suma ponderada de las entradas, invertida.',
  aplica='Su virtud es que «las entradas no interactúan»: un mezclador de audio de muchos canales.')
X('integrador',
  significa='Con entrada constante, la corriente por R carga el condensador linealmente: «Una entrada constante da una rampa de salida».',
  error='La deriva: el offset y la corriente de polarización también se integran y la salida deriva hasta saturar; se cura con una resistencia grande en paralelo con el condensador.')
X('derivador',
  significa='La salida es proporcional a la velocidad de cambio de la entrada.',
  error='«Es un circuito problemático»: su ganancia crece con la frecuencia, amplifica el ruido y tiende a la inestabilidad. El consejo general: evitar derivar siempre que se pueda.')
X('error-cmrr',
  significa='El CMRR convierte una tensión de modo común en un error equivalente a la entrada.',
  valores='Con 80 dB y 5 V de modo común, 500 µV de error; con 120 dB, 5 µV.',
  aplica='«Con 80 dB de CMRR, el modo común introduce diez veces más error que el offset».')
X('ganancia-instrumentacion',
  significa='En la topología de tres operacionales, «La ganancia se ajusta con una sola resistencia», sin tocar el equilibrio del diferencial de salida.',
  aplica='Separa el ajuste de ganancia del de rechazo, y «Más ganancia significa mejor CMRR», lo contrario de lo habitual.')
X('polo-carga-capacitiva',
  significa='La resistencia de salida en lazo abierto del operacional y la carga capacitiva forman un polo adicional dentro del lazo.',
  valores='Con 50 Ω y 1 nF, el polo cae en 3,2 MHz y el margen de un seguidor se queda en 31°.',
  aplica='«La carga capacitiva es peor cuanto menor sea la ganancia de lazo cerrado»: el seguidor es el caso más desfavorable.')
X('fondo-escala-puente',
  significa='«Un puente de galgas no entrega una tensión propia»: modula la excitación, y su sensibilidad se da en mV por voltio.',
  valores='2 mV/V con 5 V de excitación dan 10 mV de fondo de escala.',
  aplica='Si la excitación y la referencia del ADC son la misma tensión, la medida es ratiométrica y la estabilidad de la alimentación deja de importar.')
X('error-ganancia-finita',
  significa='Con ganancia de lazo T = A/G finita, la ganancia real es menor que la ideal en una fracción 1/(1 + T).',
  valores='Con A = 10⁵ y G = 455,5, el error es del 0,453 %; si A bajase a 10⁴, saltaría al 4,4 %.',
  aplica='«Trabajar con ganancias de varios cientos deja poco lazo de sobra»: por eso las básculas reparten la ganancia en dos etapas.')
X('offset-salida',
  significa='«El offset se amplifica igual que la señal»: en la salida aparece multiplicado por la ganancia.',
  valores='50 µV por una ganancia de 455,5 son 22,8 mV, un 0,5 % del fondo de escala.',
  aplica='El error de cero se elimina con tara; la deriva no.')
X('cruce-ruido',
  significa='La ganancia de ruido sube a +20 dB/década desde f<sub>z</sub> y la del operacional baja a −20 dB/década: se cruzan en la media geométrica.',
  valores='Con 10 MHz de GBW y f<sub>z</sub> = 14,5 kHz, el cruce está en 380 kHz.',
  aplica='Una pendiente relativa de 40 dB/década en el cruce equivale a «margen de fase nulo».')
X('cf-transimpedancia',
  significa='C<sub>f</sub> en paralelo con R<sub>f</sub> pone un polo que detiene la subida de la ganancia de ruido; colocarlo en el cruce da 45° de margen.',
  valores='Con 55 pF de entrada, 200 kΩ y 10 MHz salen 2,09 pF; se monta el comercial de 2,2 pF.',
  aplica='La oscilación no viene de un error de montaje «sino por la capacidad del propio sensor».')
X('histeresis-vth',
  significa='En el comparador con realimentación positiva, con la salida en bajo, la entrada debe subir por encima de V<sub>ref</sub>·(1 + R<sub>1</sub>/R<sub>2</sub>) para conmutar.',
  aplica='«La histéresis separa el umbral de subida del de bajada», de forma que tras conmutar hace falta un cambio real para volver.')
X('histeresis-vtl',
  significa='Con la salida en alto, la entrada debe bajar hasta V<sub>ref</sub>·(1 − R<sub>1</sub>/R<sub>2</sub>) para volver a conmutar.',
  error='La simetría solo existe porque «la referencia está justo a media alimentación»; si no, hay que rehacer el cálculo con los niveles reales de salida.')
X('histeresis-ventana',
  significa='La ventana es la distancia entre los dos umbrales: tiene que superar el ruido de pico a pico para que no haya rebotes.',
  aplica='Sin ella, si el ruido tiene 20 mV de pico a pico, una deriva lenta dentro de esa banda «produce un tren de conmutaciones».')
X('wien',
  significa='La red RC serie-paralelo tiene, a su frecuencia característica, desfase cero y atenuación de exactamente 1/3.',
  aplica='El amplificador debe ser no inversor y de ganancia 3; «Con menos, no arranca; con más, la amplitud crece hasta saturar».')
X('multivibrador',
  significa='Cada semiciclo dura lo que tarda una base en recorrer medio camino hacia la alimentación a través de su RC: «El mismo ln 2 del 555».',
  valores='Con R = 47 kΩ y C = 10 µF, 0,33 s por semiciclo: el intermitente de dos LED a 1,5 Hz.',
  error='Esperar precisión: «La frecuencia depende de todo», y una exactitud del 10 % es lo esperable.')
X('snr-jitter',
  significa='Muestrear en un instante equivocado da un error proporcional a la pendiente de la señal; eso fija un techo a la SNR.',
  valores='Con 1 ps de jitter y 100 MHz, el techo es de 64 dB, unos 10 bits efectivos, «por bueno que sea el convertidor».')
X('frecuencia-maxima-sincrona',
  significa='El dato debe salir del flip-flop, atravesar la lógica y llegar al siguiente antes de su ventana de setup: el periodo no puede ser menor que esa suma.',
  valores='Con 8 + 5 + 3 ns, T ≥ 16 ns: 62,5 MHz.',
  aplica='En el diseño síncrono «su corrección se reduce a comprobar unas desigualdades de tiempo».')
X('frecuencia-maxima-skew',
  significa='Al camino de datos se suma el peor desalineo del reloj entre los dos biestables.',
  valores='8 + 22 + 3 + 2 ns = 35 ns: 28,57 MHz.',
  aplica='La lógica se lleva el 63 % del periodo: «hay que atacar el camino combinacional, y solo el más largo».')
X('snr-cuantificacion',
  significa='Con n bits y un error de cuantificación uniforme de hasta medio LSB, la SNR teórica crece unos 6 dB por bit.',
  valores='8 bits, 49,9 dB; 16 bits, 98,1 dB.',
  error='Tomar los 24 bits por reales: «ningún circuito real alcanza 146 dB»; por eso se especifica el ENOB.')
X('resolucion-fft-n',
  significa='«La resolución en frecuencia es la frecuencia de muestreo dividida por el número de puntos».',
  valores='Con 48 kHz y 1 024 puntos, 46,9 Hz.',
  aplica='«Más resolución en frecuencia exige más tiempo de observación»: no se puede saber con precisión qué frecuencia tiene algo que dura poco.')
X('filtro-iir-rc',
  significa='La ecuación diferencial del RC, muestreada, se convierte en «una ecuación en diferencias», directamente ejecutable.',
  valores='Con RC = 1 ms y muestreo a 10 kHz, a = 0,0909.',
  aplica='Una línea de código, dos multiplicaciones y una suma dan prácticamente el mismo paso bajo.')
X('fir-coeficientes',
  significa='En un FIR por ventanas, el número de coeficientes lo fija la anchura de la transición, con un factor que depende de la ventana.',
  valores='A 8 kHz con 500 Hz de transición: 53 coeficientes con Hamming, 88 con Blackman.',
  aplica='«El coste es inversamente proporcional a la anchura de la transición».')
X('media-movil-equivalente',
  significa='Un filtro recursivo con a ≈ 2/(N + 1) tiene el mismo retardo de grupo en continua que una media móvil de N muestras.',
  valores='Una media móvil de 8 equivale a a = 0,222; una de 16, a a = 0,118.',
  aplica='El recursivo gana casi siempre en un microcontrolador; la media móvil, cuando importa la fase lineal o rechazar una frecuencia concreta: «una media móvil de N muestras tiene ceros exactos en múltiplos de fs/N».')
X('ziegler-nichols-kp',
  significa='Con I y D anulados se sube K<sub>p</sub> hasta la oscilación sostenida; la ganancia crítica K<sub>u</sub> da el punto de partida del PID.',
  error='Ziegler-Nichols «sintoniza agresivo»: sobreoscilaciones que a menudo superan el 40 %. Sirve como punto de partida, no como resultado final.')
X('ziegler-nichols-ti',
  significa='El tiempo integral sale del periodo de la oscilación sostenida T<sub>u</sub> que se observa con la ganancia crítica.',
  aplica='El método «exige llevar el sistema a oscilar», lo que no siempre es admisible; el método del relé es la versión segura.')
X('ziegler-nichols-td',
  significa='El tiempo derivativo es la octava parte del periodo de oscilación T<sub>u</sub> medido en el ensayo de lazo cerrado.',
  error='Tomar la sintonía como definitiva: Ziegler-Nichols «sintoniza agresivo» y sirve como punto de partida.')
X('rele-ku',
  significa='Un relé con histéresis hace oscilar el sistema «con amplitud acotada»; de la amplitud de la oscilación y la del relé sale la ganancia crítica.',
  aplica='Es lo que hacen los controladores con autosintonía, y el método recomendable cuando el proceso no tolera una oscilación libre.')
X('retardo-maximo',
  significa='Un retardo puro no cambia la ganancia, «solo resta fase», proporcionalmente a la frecuencia; el margen de fase dividido por la pulsación de cruce es el retardo que el lazo tolera.',
  valores='Con 50° de margen y cruce en 2 rad/s, 0,44 s de retardo adicional antes de oscilar.',
  aplica='«Muestrear más despacio consume margen de retardo».')
X('ruido-termico',
  significa='Todo conductor genera ruido por la agitación térmica de sus portadores; solo depende de R, T y el ancho de banda.',
  valores='1 kΩ a 300 K: 4,1 nV/√Hz; 1 MΩ en 1 MHz: 129 µV.',
  aplica='La primera regla del bajo ruido: «limitar el ancho de banda a lo estrictamente necesario».')
X('ruido-disparo-b',
  significa='La corriente es un goteo de cargas discretas al atravesar una barrera de potencial; su fluctuación crece con la raíz de la corriente.',
  valores='Con 1 mA, 17,9 pA/√Hz.',
  aplica='«No existe en una resistencia», y sí en diodos y transistores.')
X('ruido-integrado',
  significa='El ruido se especifica «por unidad de ancho de banda»; el total en una banda es la densidad por la raíz de esa banda.',
  valores='5 nV/√Hz en 10 kHz son 0,5 µV.',
  error='Usar la banda de −3 dB: «el ancho de banda de ruido no es el de −3 dB»; en primer orden es 1,57 veces el corte.')
X('suelo-ruido-receptor',
  significa='El ruido térmico fija un suelo de −174 dBm en 1 Hz; se suma la banda en dB y la figura de ruido del receptor.',
  valores='Con 1 MHz y 3 dB de figura de ruido, el suelo es de −111 dBm.',
  aplica='«Ese número es el punto de partida de cualquier balance de enlace».')
X('r-optima-ruido',
  significa='Existe una resistencia de fuente «para la que la figura de ruido del amplificador es mínima»: el cociente entre su ruido de tensión y de corriente.',
  valores='Con 10 nV y 0,5 pA, 20 kΩ; un operacional de FET llega a 400 kΩ.',
  aplica='«El operacional se elige por la impedancia de la fuente».')
X('ruido-entrada-total',
  significa='Las tres contribuciones de un amplificador —su ruido de tensión, su ruido de corriente sobre R<sub>s</sub> y el térmico de R<sub>s</sub>— se suman en cuadratura.',
  aplica='La resistencia de fuente óptima decide la primera etapa: «bipolar para fuentes de baja impedancia, JFET o CMOS para las de alta».')
X('acoplo-inductivo',
  significa='Dos bucles próximos se acoplan magnéticamente: una corriente que cambia en uno induce tensión en el otro.',
  aplica='Lo que importa es «el área de los bucles» y su orientación; se combate llevando el retorno pegado a la ida.',
  error='Confundir las vías: «la capacidad acopla tensiones y la inductancia acopla corrientes».')
X('radiacion-bucle',
  significa='Por encima de unos 30 MHz los conductores empiezan a ser antenas; un bucle radia un campo proporcional a f², al área y a la corriente.',
  valores='Un bucle de 1 cm² con 40 mA a 100 MHz da 173 µV/m a 3 m: «un bucle de un centímetro cuadrado ya supera la norma».',
  aplica='Reducir el área a la mitad son 6 dB menos, la medida más barata que existe.')
X('bucle-masa',
  significa='Un bucle de masa es una espira: un campo magnético variable que la atraviesa induce una tensión proporcional al área y a la frecuencia.',
  valores='Con 1 µT a 50 Hz, un bucle de 100 cm² capta 3,14 µV: «un bucle de 100 cm² captando red ya supera el suelo de ruido térmico por un factor 8».')
X('promediado',
  significa='Sumando N capturas sincronizadas, la señal crece con N y el ruido aleatorio con √N.',
  valores='16 promedios mejoran 12 dB; 1 024, 30 dB.',
  aplica='«Cada 6 dB cuesta cuatro veces más tiempo», y el disparo debe ser estable.')
X('lockin-bw',
  significa='El filtro de salida con constante de tiempo τ equivale a un paso banda de ancho 1/(4τ) centrado en la referencia.',
  valores='Con τ = 1 s, 0,25 Hz: «algo imposible de construir con componentes».')
X('lockin-mejora',
  significa='La mejora de un lock-in es el cociente entre la banda ancha de la medida y la banda equivalente del lock-in, en decibelios.',
  valores='Midiendo con 10 kHz y τ = 1 s, 46 dB.',
  aplica='El ruido, que no está correlacionado con la referencia, «se promedia a cero».')
X('potencia-ruido-ktb',
  significa='La potencia de ruido térmico disponible es kTB: por eso en RF «el ruido no se expresa en voltios sino en temperatura».',
  aplica='Las contribuciones expresadas en kelvin se suman directamente, sin cuadraturas.')
X('temperatura-ruido',
  significa='La temperatura de ruido es la de una resistencia que produciría el mismo ruido que el receptor, referida a T<sub>0</sub> = 290 K.',
  valores='1 dB de figura de ruido son 75 K; 3 dB, 289 K.',
  aplica='Entre 0,5 y 1 dB hay 40 K, «un número manejable»; por eso se usa en receptores muy sensibles.')
X('fuga-condensador-y',
  significa='Los condensadores Y van entre fase y tierra, y por ellos circula permanentemente una corriente a frecuencia de red.',
  valores='2,2 nF a 230 V y 50 Hz dejan pasar 159 µA.',
  aplica='En un equipo médico «el total no puede pasar de 1,4 nF», y el filtro queda limitado por la fuga.')
X('rizado-buck-vout',
  significa='La corriente de la bobina sube y baja en triángulo alrededor de la corriente de salida; su excursión depende de la tensión, la bobina y la frecuencia.',
  valores='Con 5 V, D = 0,417, 47 µH y 300 kHz, ΔI = 207 mA.',
  aplica='El criterio: rizado entre «el 20 y el 40 % de la corriente de salida».')
X('boost-vout',
  significa='En corte, la bobina mantiene su corriente y su tensión «se suma a la de entrada»: por eso la salida es mayor.',
  valores='Con 3,7 V de batería y 5 V de salida, D = 0,26.',
  error='Olvidar que la corriente de entrada es mayor que la de salida y que un elevador «no puede apagar su salida».')
X('perdida-diodo-libre',
  significa='El diodo de rueda libre conduce durante la fracción (1 − D) del ciclo, y su caída por la corriente es lo que disipa.',
  valores='Un Schottky de 0,4 V con 10 A y D = 0,4 disipa 2,4 W.',
  aplica='Un MOSFET de 5 mΩ en su lugar baja la pérdida a 0,3 W: «ocho veces menos».')
X('motor-cc-velocidad',
  significa='La tensión aplicada se reparte entre la caída en la resistencia y la fuerza contraelectromotriz, proporcional a la velocidad.',
  valores='Con 24 V, 0,5 Ω y k = 0,05 V·s/rad gira a 4 584 rpm en vacío y a 4 106 con 5 A.',
  aplica='«La misma constante k aparece en las dos», por la conservación de la energía.')
X('motor-cc-par',
  significa='El par es proporcional a la corriente, con la misma constante k que liga la velocidad y la fuerza contraelectromotriz.',
  valores='Con k = 0,05 y 5 A, 0,25 N·m.',
  aplica='«La misma constante k aparece en las dos»: la potencia eléctrica E·I iguala a la mecánica T·ω.')
X('velocidad-sincrona',
  significa='El campo giratorio de un motor de alterna da una vuelta cada tantos ciclos de red como pares de polos tiene.',
  valores='Con 4 polos a 50 Hz, 1 500 rpm; a 60 Hz, 1 800 rpm.',
  aplica='El motor de inducción «no puede girar a la velocidad síncrona»: necesita deslizamiento para que se induzca corriente en el rotor.')
X('deslizamiento',
  significa='«El rotor debe girar más despacio que el campo para que se induzca corriente en él»: el deslizamiento mide cuánto.',
  valores='Un motor de 4 polos a 1 440 rpm tiene un deslizamiento del 4 %, típico a plena carga.')
X('ley-v-f',
  significa='El flujo en el hierro es proporcional a V/f: para bajar la frecuencia sin saturar el núcleo hay que bajar la tensión en la misma proporción.',
  valores='«Un motor de 400 V y 50 Hz alimentado a 25 Hz debe recibir 200 V».',
  aplica='Por encima de la frecuencia nominal se entra en la zona de debilitamiento de campo: la velocidad sube pero el par cae.')
X('buck-vout', ref='sec-33.2',
  significa='Por el balance de voltios-segundo en la bobina, la salida del reductor es la entrada por el ciclo de trabajo.',
  valores='Con 12 V de entrada y 5 de salida, D = 0,417.',
  aplica='«La salida solo depende del ciclo de trabajo, no de la carga, ni de la bobina, ni de la frecuencia».')
X('flujo-nucleo',
  significa='La densidad de flujo en el núcleo crece con la inductancia y la corriente de pico, y baja con las espiras y el área.',
  valores='B<sub>max</sub> de unos 0,3 T en ferrita, 1 T en polvo de hierro y 1,5 T en chapa.',
  error='Superar B<sub>max</sub>: «el núcleo satura y la inductancia se desploma».')
X('flyback-lp',
  significa='En modo discontinuo toda la energía del primario se transfiere en cada ciclo; con la potencia y el peor caso de entrada sale la inductancia.',
  valores='Con 100 V mínimos, D = 0,45, 28 W y 65 kHz, 556 µH.',
  aplica='«El flyback necesita entrehierro», porque sin él el núcleo satura con una fracción de la corriente.')
X('flyback-ipico',
  significa='En modo discontinuo la corriente del primario parte de cero y sube en rampa durante t<sub>on</sub>: el pico es V<sub>in</sub>·t<sub>on</sub>/L<sub>p</sub>.',
  valores='Con 100 V, D = 0,45, 556 µH y 65 kHz, 1,24 A.',
  aplica='Ese pico fija la energía por ciclo, ½·L<sub>p</sub>·I², y con ella el núcleo; y «el flyback necesita entrehierro» para no saturar.')
X('flyback-relacion',
  significa='Durante la descarga, el secundario impone sobre el primario una tensión reflejada n·(V<sub>out</sub> + V<sub>D</sub>); fijándola sale la relación de espiras.',
  valores='Con 100 V reflejados y 12,7 V de salida más diodo, n ≈ 8.',
  aplica='Las espiras son enteras: «el diseño se cierra iterando».')
X('entrehierro',
  significa='Con el entrehierro, casi toda la reluctancia está en el aire: la inductancia la fijan las espiras, el área y la longitud del hueco.',
  valores='Con 44 espiras, 52 mm² y 556 µH, 0,23 mm.',
  aplica='«Se reparte en las dos mitades del núcleo o se usa un núcleo con entrehierro centrado ya mecanizado».')
X('potencia-por-ciclo',
  significa='Una energía que se pierde o se entrega en cada ciclo, multiplicada por la frecuencia, es una potencia media.',
  valores='Los 7,7 µJ de la dispersión de un flyback a 65 kHz son 0,5 W en el snubber.',
  aplica='«Ese medio vatio es lo mínimo que disipa la resistencia del snubber».')
X('cero-esr',
  significa='La resistencia serie del condensador de salida forma con su capacidad un cero que devuelve 90° de fase al lazo.',
  valores='Con 30 mΩ y 470 µF, en 11,3 kHz.',
  error='Calcular solo con el ESR nominal: «Un lazo estable solo con el ESR nominal no es un lazo estable».')
X('cero-semiplano-derecho',
  significa='En el elevador en modo continuo aparece un cero que añade retardo sin añadir ganancia.',
  aplica='La regla es cruzar por debajo de un tercio de su frecuencia: «No es un defecto del diseño: es una limitación de la topología».')
X('ruido-cuantificacion',
  significa='Un convertidor «asigna a cada valor analógico el código más próximo»: el error llega a medio LSB y, repartido uniformemente, su valor eficaz es LSB/√12.',
  aplica='De ahí sale la SNR teórica: los 6,02 dB por bit son 20·log 2.')
X('error-jitter',
  significa='Si el instante de muestreo tiene una incertidumbre Δt y la señal cambia a razón de dV/dt, el error es su producto.',
  valores='Con 16 bits y 1 MHz, la incertidumbre debe quedar por debajo de 2,4 ps.',
  aplica='En convertidores rápidos de alta resolución «el reloj es el componente crítico» y no el convertidor.')
X('galga',
  significa='Al deformarse la pieza, la pista de la galga se alarga y se estrecha: su resistencia cambia en proporción a la deformación, con el factor de galga.',
  valores='Con GF = 2 y 1 000 µε, un 0,2 %: «Sobre una galga de 350 Ω, 0,7 Ω».',
  aplica='Medir ese cambio mientras la temperatura cambia la resistencia mucho más es lo que exige el puente de Wheatstone.')
X('codigo-ratiometrico',
  significa='Si el ADC usa como referencia la misma tensión que excita el sensor, cualquier variación «afecta por igual» a la señal y a la referencia.',
  aplica='«La exactitud y la estabilidad de la fuente de excitación dejan de importar»; solo vale con sensores de tipo divisor.')
X('longitud-critica',
  significa='Un conductor es una línea de transmisión cuando es largo frente a lo que recorre la señal durante su flanco.',
  valores='Con flancos de 1 ns en FR4, unos 2,5 cm.',
  error='Pensar en la frecuencia: «lo que decide es el flanco, no la frecuencia de repetición».')
X('z0-linea',
  significa='La impedancia característica es la relación entre tensión y corriente de una onda que viaja por la línea; «Depende solo de la geometría y del dieléctrico».',
  valores='50 Ω en instrumentación y RF, 75 Ω en vídeo, 90 Ω diferencial en USB.',
  aplica='«No es una resistencia: no disipa».')
X('coeficiente-reflexion',
  significa='Cuando la onda encuentra una impedancia distinta de Z<sub>0</sub>, «parte de la energía vuelve»; Γ dice cuánta y con qué signo.',
  valores='Abierto, +1; cortocircuito, −1; 75 Ω sobre 50, +0,2, el 4 % de la potencia.',
  aplica='Un circuito abierto duplica la tensión en el extremo, y ese sobreimpulso puede llevar una entrada lógica por encima de su máximo.')
X('vswr',
  significa='La onda incidente y la reflejada forman una onda estacionaria; la VSWR es la relación entre sus máximos y mínimos.',
  valores='1,5 : 1 refleja el 4 %; 2 : 1, el 11 %.',
  aplica='El problema de una VSWR alta en un transmisor «no es tanto la pérdida como la tensión reflejada que vuelve a la etapa final».')
X('s11',
  significa='«S11 es el coeficiente de reflexión» expresado en decibelios: cuánto refleja la entrada de un dispositivo.',
  valores='−20 dB significa que se refleja el 1 % de la potencia, un valor excelente; −10 dB, el 10 %.')
X('q-red-l',
  significa='Con dos elementos «no queda ningún grado de libertad»: el Q de la red en L lo impone el salto de impedancia.',
  valores='Un salto de 4 : 1 da Q = 1,7 y unos 58 % de banda; uno de 50 : 1, Q = 7 y un 14 %.',
  aplica='«Cuanto mayor el salto de impedancia, más estrecha la banda».')
X('stub-corto',
  significa='Un tramo de línea en cortocircuito presenta una reactancia que depende de su longitud eléctrica: corto, es una bobina.',
  aplica='Por encima de unos cientos de megahercios el filtro se hace «con las propias pistas».')
X('longitud-onda-sustrato',
  significa='En un sustrato la señal viaja más despacio que en el vacío, dividida por la raíz de la permitividad efectiva.',
  valores='A 2,4 GHz en FR4, 68,7 mm: un cuarto de onda son 17,2 mm, «perfectamente trazable en una placa».')
X('longitud-onda',
  significa='La longitud de onda es la velocidad de la luz entre la frecuencia; fija el tamaño de las antenas.',
  valores='433 MHz, 69,3 cm; 2,4 GHz, 12,5 cm.',
  aplica='En una placa hay que corregirla «por el factor de velocidad» del sustrato.')
X('intermodulacion-3',
  significa='«Los productos de tercer orden crecen tres decibelios por cada uno» de la señal; con el IP3 se calcula su nivel sin medirlos.',
  valores='Con −30 dBm por tono y +10 dBm de IP3, productos de −110 dBm.',
  aplica='«Un receptor muy sensible y poco lineal es inservible en una ciudad».')
X('friis',
  significa='Cada etapa añade su ruido dividido por la ganancia de las anteriores: la primera etapa fija la figura de ruido de la cadena.',
  valores='Con un LNA de 15 dB y 2 dB de figura, una segunda etapa de 10 dB solo sube el total a 2,7 dB.',
  aplica='«Si G₁ es alta, lo que venga después casi no importa»; si el LNA pierde ganancia, la sensibilidad se hunde.')
X('perdida-espacio-libre',
  significa='La potencia se reparte sobre una esfera; en decibelios, la pérdida crece con el logaritmo de la distancia en longitudes de onda.',
  valores='100 MHz a 1 km, 72,44 dB; 2,4 GHz a 100 m, 80,05 dB.',
  aplica='La pérdida «crece con el cuadrado de la frecuencia»: las bandas bajas para cobertura, las altas para capacidad.')
X('perdida-retorno', ref='sec-36.2',
  significa='La pérdida de retorno es el coeficiente de reflexión en decibelios con el signo cambiado: cuanto mayor, mejor adaptado.',
  aplica='Una desadaptación moderada cuesta poca potencia: «un VSWR de 2 solo desperdicia el 11 % de la potencia».')
X('perdida-desadaptacion', ref='sec-36.2',
  significa='La pérdida por desadaptación es la potencia que no llega a la carga porque se refleja, expresada en dB.',
  aplica='Con una VSWR de 2 es medio decibelio: el problema de una VSWR alta «no es tanto la pérdida como la tensión reflejada».')
X('perdida-espacio-libre-km',
  significa='La misma pérdida en espacio libre con la distancia en km y la frecuencia en MHz: 32,44 dB más dos términos logarítmicos.',
  valores='1 km a 868 MHz, 91,2 dB.',
  aplica='«Doblar la distancia cuesta 6 dB», y doblar la frecuencia otros 6.')
X('fresnel',
  significa='La onda ocupa un volumen elipsoidal; la primera zona de Fresnel tiene su radio máximo en el punto medio del enlace.',
  valores='Con 1 km a 868 MHz, 9,3 m de radio.',
  aplica='Hay que despejar al menos el 60 %: por eso un enlace se hace desde lo alto, «sino para despejar la zona».')
X('sensibilidad-receptor',
  significa='La sensibilidad sale del suelo de ruido térmico más la banda en dB, la figura de ruido y la SNR exigida.',
  valores='100 kHz, 6 dB de figura y 10 dB de SNR dan −108 dBm.',
  aplica='La palanca más rentable es «reducir el ancho de banda»: de 100 a 10 kHz se ganan 10 dB.')
X('red-l-serie',
  significa='El elemento serie de la red en L cancela la reactancia que deja el paralelo: su reactancia es Q por la resistencia baja.',
  valores='De 50 a 10 Ω a 100 MHz, Q = 2 y 20 Ω: 31,8 nH.',
  aplica='«El factor de calidad de una red en L no se elige»: lo impone la relación de impedancias.')
X('red-l-paralelo',
  significa='El elemento paralelo, junto a la resistencia alta, la transforma en una menor; su reactancia es la resistencia alta entre Q.',
  valores='De 50 a 10 Ω a 100 MHz, 25 Ω: 63,7 pF.',
  aplica='«Cuanto mayor la transformación, más estrecha la banda»; para saltos grandes, dos etapas.')
X('presupuesto-enlace',
  significa='El presupuesto es la pérdida que el enlace admite: potencia más ganancias de antena menos la sensibilidad del receptor.',
  valores='20 dBm, dos antenas de 2 dBi y −90 dBm de sensibilidad dan 114 dB.',
  aplica='«El margen no es opcional»: cada 20 dB de pérdida adicional dividen el alcance por diez.')
X('divisor-biestable',
  significa='Un contador que conmuta la salida cada N flancos y se reinicia produce un periodo de 2N ciclos de reloj.',
  valores='Con 50 MHz y una cuenta hasta 25 000 000, un LED que parpadea a 1 Hz.',
  error='Declarar el contador con pocos bits: «produce un desbordamiento silencioso y una frecuencia equivocada».')
X('divisor-frecuencia',
  significa='Varios relojes salen de un único cristal por división entera, y por eso mantienen una relación de fase fija.',
  valores='21,477272 MHz entre 12 da la CPU a 1,789773 MHz; entre 4, la PPU: «Tres ciclos de PPU por cada ciclo de CPU».',
  error='Generar dos relojes derivados en una FPGA: aparecerían cruces de dominio donde el original no los tiene.')
X('frecuencia-cuadro',
  significa='Un cuadro de vídeo dura tantos ciclos de reloj de píxel como puntos por línea por líneas por cuadro.',
  valores='341 × 262 = 89 342 ciclos a 5,369 MHz: 60,0985 cuadros por segundo.',
  aplica='«La CPU no ejecuta un número entero de ciclos por cuadro», y redondear acumula deriva.')
X('equilibrio-asic',
  significa='Fabricar un ASIC tiene un coste fijo (NRE) y un coste unitario bajo; el equilibrio es la intersección con la recta de la FPGA.',
  valores='500 000 € de NRE, 2 € por chip y 30 € por FPGA: 17 900 unidades.',
  aplica='Hay que hacerlo con «el volumen realista de toda la vida del producto», no con el optimista.')
X('profundidad-fifo',
  significa='Durante la ráfaga se escribe más deprisa de lo que se lee, y la FIFO acumula la diferencia.',
  valores='64 palabras a 100 MHz leídas a 40 MHz: 38,4, que se redondea hacia arriba a 39 posiciones.',
  aplica='Se redondea hacia arriba porque «Redondear hacia abajo dejaría la FIFO una palabra corta en el peor caso»; luego se añade el margen del sincronizador.')
X('bits-pwm', ref='sec-38.5',
  significa='Los pasos de un PWM son el reloj entre la frecuencia del PWM; su logaritmo en base 2 son los bits de resolución.',
  valores='«Con un reloj de 16 MHz y PWM de 20 kHz quedan 800 pasos, menos de 10 bits».',
  aplica='«Frecuencia y resolución compiten», porque ambas salen del mismo reloj.')
X('cota-rms', ref='sec-38.13',
  significa='Con prioridades asignadas por frecuencia, hay una cota de utilización por debajo de la cual todas las tareas cumplen sus plazos; tiende a ln 2 con muchas tareas.',
  valores='«Si la utilización total del procesador está por debajo de aproximadamente el 69 %, todas las tareas cumplen sus plazos».')
X('utilizacion-3',
  significa='La utilización del procesador es la suma de cada tiempo de ejecución entre su periodo.',
  valores='0,5/10 + 2/20 + 8/100 = 23 %, muy por debajo de la cota de 78 % para tres tareas.',
  error='Creer que cumplir la cota basta: con un recurso compartido aparece la inversión de prioridad, y «sin embargo puede fallar».')
X('corriente-pista-ipc',
  significa='La norma IPC-2221 da la corriente admisible de una pista según su sección y el calentamiento aceptado, con una fórmula empírica.',
  valores='Una pista exterior de 0,5 mm y 35 µm lleva 1,45 A con 10 °C de subida.',
  error='«Doblar la anchura no dobla la corriente»: la multiplica por 1,65; y las pistas internas admiten la mitad.')
X('resistencia-pista',
  significa='La resistencia de una pista es la resistencia por cuadro del cobre multiplicada por el número de cuadros, longitud entre anchura.',
  valores='Con 35 µm, 0,491 mΩ por cuadro: 0,5 × 50 mm son 100 cuadros, 49 mΩ.',
  aplica='«La misma pista con la misma corriente es válida o no según la tensión del raíl».')
X('inductancia-via',
  significa='Una vía es un cilindro conductor del espesor de la placa: su inductancia crece con la longitud y algo con la esbeltez.',
  valores='En 1,6 mm con taladro de 0,3 mm, unos 1,3 nH: del orden de 0,8 nH por milímetro.',
  aplica='En el desacoplo la vía forma parte del bucle: «dos vías de 1,3 nH suman 2,6 nH».')
X('seccion-via',
  significa='Una vía conduce por la corona de cobre depositada en su pared: perímetro por espesor del metalizado.',
  valores='Con 0,3 mm y 25 µm, 0,0236 mm², equivalente a 0,67 mm de pista de 35 µm.',
  aplica='Regla conservadora: «del orden de 1 A por vía» con calentamiento moderado.')
X('impedancia-objetivo',
  significa='La red de alimentación debe mantener una impedancia menor que la caída admisible entre el escalón de corriente.',
  valores='1,2 V con 5 % de tolerancia y 5 A de escalón: 12 mΩ.',
  aplica='Esa impedancia hay que mantenerla «desde continua hasta cientos de megahercios».')
X('rebote-masa',
  significa='Las salidas que conmutan a la vez devuelven su corriente por la misma inductancia del encapsulado, y sobre ella aparece tensión.',
  valores='8 salidas de 20 mA en 2 ns sobre 5 nH: 400 mV.',
  aplica='«El chip toma sus decisiones respecto a su masa interna», no respecto a la de la placa.')
X('terminacion-serie',
  significa='La resistencia serie junto al driver completa su resistencia de salida hasta la impedancia de la línea.',
  valores='Con 50 Ω de pista y 20 Ω de salida, 30 Ω.',
  aplica='Su gran ventaja es el consumo: «consumo estático = 0 W», frente a los 218 mW por línea de una terminación paralelo.')
X('zin-emisor-comun',
  significa='Desde la base el transistor presenta β·r<sub>e</sub>, en paralelo con las dos resistencias del divisor de polarización.',
  valores='47 kΩ ‖ 10 kΩ ‖ 2,9 kΩ = 2,16 kΩ.',
  aplica='«El divisor, puesto ahí para polarizar, es también quien más carga la entrada».')
X('zout-seguidor',
  significa='Desde el emisor se ve r<sub>e</sub> más la resistencia de la fuente dividida por β.',
  valores='Con una fuente de 1 kΩ y β = 150, 26 Ω: «ganancia de corriente y de potencia, sin ganancia de tensión».')
X('av-gm-rc',
  significa='La ganancia del emisor común es la transconductancia por la resistencia de colector, con inversión de signo.',
  valores='Con 1 mA y 4,7 kΩ, −181.',
  aplica='«La ganancia no depende de β»: dos transistores de β 50 y 300 polarizados a la misma corriente dan la misma ganancia.')
X('av-degenerado',
  significa='Sin condensador de desacoplo en el emisor aparece realimentación local, y la ganancia pasa a ser R<sub>C</sub>/(r<sub>e</sub> + R<sub>E</sub>).',
  valores='Con R<sub>E</sub> = 1 kΩ sin puentear, la ganancia baja de −169 a −3,24.',
  aplica='La ganancia baja y «a cambio deja de depender del transistor».')
X('miller',
  significa='Una capacidad entre la entrada y la salida de una etapa inversora ve una tensión (1 + |A|) veces mayor, y la entrada la percibe así de grande.',
  valores='4 pF con ganancia 100 se ven como 404 pF.',
  aplica='Esa capacidad, con la resistencia de la fuente, forma un paso bajo y «es con diferencia el efecto dominante».')
X('vpico-potencia',
  significa='Para entregar P sobre R con una senoide hace falta un pico de √(2PR).',
  valores='20 W sobre 8 Ω: 17,9 V de pico.',
  aplica='«Doblar la potencia solo exige un 41 % más de tensión», porque va con la raíz.')
X('disipacion-clase-b-aprox',
  significa='En clase B la disipación máxima no ocurre a plena potencia sino hacia el 64 % de la excursión, y es una fracción fija de la potencia máxima.',
  valores='Con 20 W de salida, unos 4 W por transistor.',
  error='Calcularla a plena potencia: «a plena potencia disipa menos».')
X('potencia-clase-b', ref='sec-43.10',
  significa='La potencia de una senoide de pico V<sub>p</sub> sobre R<sub>L</sub> es V<sub>p</sub>²/2R<sub>L</sub>.',
  valores='Con 14 V de pico sobre 8 Ω, 12,25 W.',
  aplica='En clase B «Cada transistor conduce medio ciclo».')
X('consumo-clase-b', ref='sec-43.10',
  significa='Cada transistor toma de la fuente medio ciclo de senoide: la potencia consumida crece en proporción a la amplitud, no a su cuadrado.',
  valores='Con 15 V y 14 V de pico sobre 8 Ω, 16,71 W.',
  aplica='Por eso el rendimiento crece con la amplitud: es máximo cuando V<sub>p</sub> llega a V<sub>CC</sub>, «dando ηmax = π/4 = 78,54 %».')
X('rendimiento-clase-b',
  significa='El rendimiento de la clase B es π/4 por la fracción de la alimentación que alcanza la salida.',
  valores='Con 14 V de pico y 15 V de alimentación, 73,3 %.',
  aplica='La clase A con acoplamiento resistivo se queda en «un máximo del 25 %».')
X('disipacion-clase-b',
  significa='Derivando la disipación respecto a la amplitud, el máximo está en V<sub>p</sub> = 2V<sub>CC</sub>/π, y vale V<sub>CC</sub>²/(π²R<sub>L</sub>).',
  valores='Con 15 V y 8 Ω, 2,85 W por transistor, al 63,7 % de la excursión.',
  aplica='«Un amplificador de clase B calienta más a volumen medio que a máximo volumen».')
X('conduccion-clase-d',
  significa='En un puente completo siempre conducen dos transistores en serie con el altavoz: la pérdida es 2·I²·R<sub>DS(on)</sub>.',
  valores='32 W sobre 8 Ω con 50 mΩ: 0,4 W, un 98,8 % de rendimiento por ese concepto.',
  aplica='Como el interruptor está siempre saturado o cortado, «idealmente no disipa».')
X('i2c-subida',
  significa='Las líneas I²C son de drenador abierto: el flanco de subida es la carga de la capacidad del bus a través del pull-up, del 30 % al 70 %.',
  valores='Con 200 pF a 400 kHz, la R máxima es de 1 770 Ω.',
  aplica='Es uno de los «dos límites opuestos» que hay que cumplir a la vez.')
X('i2c-rmin',
  significa='El esclavo debe hundir la línea a 0,4 V absorbiendo como máximo 3 mA: eso fija la resistencia mínima del pull-up.',
  valores='Con 3,3 V, 967 Ω; con 5 V, 1 533 Ω.',
  error='No comprobar la ventana: con 400 pF a 400 kHz «está vacía: el diseño es imposible».')
X('can-longitud',
  significa='Durante el segmento de propagación, la señal debe llegar al extremo más lejano y volver, porque el arbitraje exige que todos vean el mismo bit.',
  valores='A 1 Mbit/s, 16 m; a 125 kbit/s, 296 m.',
  aplica='«La relación es inversa entre velocidad y longitud».')
X('energia-foton',
  significa='«La energía de un fotón corresponde a un salto entre bandas»: es inversamente proporcional a la longitud de onda.',
  valores='Un LED rojo de 620 nm tiene un salto de 2,0 eV; uno azul de 450 nm, de 2,76 eV.',
  aplica='En unidades prácticas, E (eV) ≈ 1 240/λ (nm), y la tensión directa del LED sigue el mismo orden.')
X('rpn',
  significa='El número de prioridad de riesgo multiplica gravedad, ocurrencia y detección, cada una de 1 a 10.',
  aplica='Su uso correcto es «ordenar, no comparar contra un umbral».',
  error='En detección, «10 significa que no se detecta»; y un fallo de gravedad 9 o 10 se aborda aunque su RPN sea bajo.')
X('mtbf-fit',
  significa='Con componentes en serie, «las tasas se suman», y el MTBF es el inverso de la tasa total.',
  valores='200 componentes a 1 FIT dan 200 FIT: 571 años de MTBF.',
  error='Leerlo como vida útil: significa que en una flota de 571 equipos cabe esperar un fallo al año. «Es una tasa, no una vida útil».')
X('arrhenius',
  significa='La mayoría de los mecanismos de fallo se aceleran exponencialmente con la temperatura, con una energía de activación típica de 0,7 eV.',
  valores='De 55 a 125 °C el factor es 77,7: mil horas a 125 °C equivalen a unos 9 años a 55 °C.',
  aplica='Bajar la temperatura de trabajo es «la medida de fiabilidad más rentable que existe».')
X('incertidumbre-combinada',
  significa='Si las fuentes de error son independientes, «se combinan en cuadratura», no se suman.',
  valores='0,005 %, 0,001 % y 0,002 % dan 0,0055 %, prácticamente la del patrón sola.',
  aplica='«La fuente dominante manda», y mejorar las demás no sirve de nada hasta atacarla.')
X('tur',
  significa='El TUR compara la tolerancia del instrumento que se verifica con la incertidumbre del patrón.',
  valores='«El criterio clásico es 4:1»: el patrón debe ser al menos cuatro veces mejor.',
  aplica='Por debajo aparece una zona de duda donde no se puede afirmar si el instrumento pasa o no.')
X('rsa-medida',
  significa='Con una potencia conocida y en régimen, la subida de temperatura del disipador entre la potencia da su resistencia térmica real.',
  aplica='«La resistencia térmica de un montaje se mide», y casi siempre sale peor que la nominal, que se da sin caja.')
X('disipador-necesario',
  significa='La cadena térmica se invierte: del salto de temperatura disponible entre la potencia se restan las resistencias unión-cápsula y cápsula-disipador.',
  valores='5 W, unión a 120 °C, ambiente de 40 °C: 16 − 2,5 = 13,5 °C/W.',
  aplica='No dimensionar «para el máximo absoluto» de 150 °C, porque la vida del semiconductor depende de la temperatura.')
X('incertidumbre-multimetro',
  significa='La especificación de un multímetro suma un porcentaje de la lectura y un número de cuentas de la última cifra.',
  valores='0,02 % de 5 V más 5 cuentas de 10 µV: 1,05 mV, un 0,021 %.',
  aplica='Con este instrumento «lo dominante pasa a ser el propio circuito».')
X('vcc-fuente-lineal',
  significa='Tras el puente y el condensador, la continua es el pico del secundario menos dos diodos y medio rizado.',
  valores='Con 18 V eficaces y 2 V de rizado, 23,1 V.',
  error='Olvidar las correcciones: con la red un 10 % baja, esos 23,1 V «se quedan en 20,5 V».')
X('regulacion-lazo',
  significa='La regulación mejora con la ganancia de lazo «exactamente como en cualquier realimentación negativa»: la variación se divide por 1 + T.',
  valores='Con ganancia de lazo 1 000, 1 V de variación queda en 1 mV.',
  aplica='Pero más ganancia «regula mejor y acerca la inestabilidad».')
X('regulacion-linea',
  significa='Es «Cuánto varía la salida cuando varía la tensión de entrada», con la carga fija, en porcentaje de la nominal.',
  valores='En un regulador con amplificador de error de ganancia alta, unos pocos milivoltios sobre varios voltios de variación.')
X('divisor-realimentacion',
  significa='El divisor escala la salida máxima hasta la tensión de referencia: R<sub>1</sub> = R<sub>2</sub>·(V<sub>max</sub>/V<sub>ref</sub> − 1).',
  valores='Para 30 V con referencia de 2,5 V y R<sub>2</sub> = 10 kΩ, 110 kΩ.',
  error='Usarlo con sensado remoto: la caída del cable de retorno entraría en el amplificador de error «multiplicada por 12».')
X('divisor-diferencial',
  significa='Con sensado remoto se mide la diferencia S+ − S− con un amplificador diferencial de ganancia R<sub>2</sub>/R<sub>1</sub>.',
  valores='Para que 30 V den los 2,5 V de la referencia con R<sub>2</sub> = 10 kΩ, 120 kΩ.',
  aplica='Así la caída de los cables se compensa en lugar de sumarse: «Lo que hay que medir es la diferencia S+ − S−».')
X('potencia-maxima-amplificador',
  significa='Con alimentación simétrica, la salida alcanza la alimentación menos la saturación de la etapa; esa senoide sobre R da la potencia máxima.',
  valores='Con ±35 V, 3 V de pérdida y 8 Ω, 64 W.',
  error='Con 4 Ω la potencia se dobla, y también la corriente y la disipación; y la cifra de la publicidad no sirve: «La cifra válida es la potencia eficaz continua con carga resistiva y distorsión especificada».')
X('amplitud-iq',
  significa='I y Q, en fase y en cuadratura, contienen juntas amplitud y fase; la amplitud es el módulo del par.',
  aplica='Una señal real pierde la fase: «muestrear una única señal real pierde la fase».')
X('ina-dos-operacionales',
  significa='El amplificador de instrumentación de dos operacionales tiene entradas de alta impedancia y una ganancia que fijan R<sub>a</sub>, R<sub>b</sub> y R<sub>G</sub>.',
  valores='Con 4,99 kΩ y 499 Ω, G = 31: unos 30 dB.',
  aplica='Las resistencias son del 0,1 % «porque el rechazo de imagen depende de que I y Q tengan la misma».')
X('sallen-key-f0',
  significa='En un Sallen-Key de ganancia unidad con resistencias iguales, la frecuencia propia es la de un RC con la media geométrica de los condensadores.',
  valores='Con 3,92 kΩ, 2,2 nF y 1 nF, unos 27,4 kHz.',
  aplica='No es todo el antialiasing: la tarjeta de sonido «lleva dentro su propio filtro digital, mucho más abrupto».')
X('sallen-key-q',
  significa='Con ganancia unidad, el Q lo fija la relación entre los dos condensadores: más C<sub>1</sub> frente a C<sub>2</sub>, más Q.',
  valores='Con 2,2 nF y 1 nF, Q ≈ 0,74.',
  aplica='La banda base simulada «cae 3 dB en 27,8 kHz».')
X('rechazo-imagen',
  significa='Un error relativo de ganancia ε y uno de fase φ entre I y Q dejan pasar la imagen; el rechazo es aproximadamente 4/(ε² + φ²).',
  valores='40 dB piden un 2 % de error de ganancia sin error de fase, o 1,15° de fase sin error de ganancia.',
  aplica='Con el contador Johnson la fase es prácticamente exacta, así que «el peso recae en las ganancias».')
X('resistencia-cuadro', ref='sec-40.3',
  significa='Una lámina de espesor t tiene la misma resistencia en cualquier cuadrado, sea del tamaño que sea: ρ/t.',
  valores='Con la resistencia por cuadro, «que para cobre de 35 µm vale 0,491 mΩ», una pista se calcula contando cuadros.')
