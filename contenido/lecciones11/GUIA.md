# Guía para escribir las lecciones 1.1 (curso «Fundamentos», capítulos 0–6)

Cada sección `h2` de los capítulos 0–6 (`cap00`…`cap06`) tiene una lección hecha a mano, al estilo de la maqueta
aprobada para la 1.1 (una idea por tarjeta, un elemento interactivo en el centro). Una lección es **un fichero YAML**
por sección; el generador la comprueba, la convierte en datos y la app la abre en lugar de la lección «por pasos» de la
1.0.

Lecciones de referencia (cópielas como plantilla):

- `contenido/lecciones11/cap01/sec-1.4.yaml` — circuito vivo, barras, corriente animada, predecir, fórmula viva, reto
  E24, sorpresa con carga, «por qué», estimar, ordenar, resumen.
- `contenido/lecciones11/cap00/sec-0.3.yaml` — gráfica de función con asas que se arrastran, estimar, reto de fase,
  emparejar.

## 1. Reglas de contenido (lo primero)

- **Solo el libro.** Todo sale de `web/public/libro/partes/capNN.json` (y de los ejercicios del mismo capítulo). No
  invente hechos, valores ni ejemplos. Reescriba corto; no copie párrafos.
- **Una idea por tarjeta**, ≤ 40 palabras entre título, texto y nota. Español de España, de **usted** («Mueva»,
  «Fíjese», «Elija»). Frases cortas, sin relleno («Ahora vamos a ver que…»).
- **Secuencia**: explorar → predecir/notar → formalizar (fórmula) → aplicar (reto) → sorpresa → por qué → resumen.
  Puede repetir el ciclo para otra idea de la misma sección (la 1.4 lo hace con el paralelo, las redes mixtas y la
  potencia). Una lección típica: 8–13 tarjetas.
- **Un elemento interactivo en el centro** de casi cada tarjeta (circuito, gráfica, fórmula viva, estimar, ordenar,
  emparejar). «Continuar» se abre al interactuar.
- **Cada respuesta se explica**, también las incorrectas: por qué no es esa.
- **La sección entera**: cubra las ideas de todos los subapartados (`h3`) de la sección, no solo el primero.

## 2. Dónde va y cómo se genera

```
contenido/lecciones11/<parte>/<label>.yaml      # p. ej. contenido/lecciones11/cap02/sec-2.3.yaml
```

```sh
cd web
node scripts/lecciones11.mjs --comprobar                   # comprueba todas; no escribe nada
node scripts/lecciones11.mjs --solo cap02/sec-2.3          # comprueba y escribe solo esa (y su entrada del índice)
node scripts/lecciones11.mjs                               # todas (lo llama también contenido/generar.py)
```

Escribe `web/public/libro/lecciones11/<parte>/<label>.json` y `lecciones11/indice.json`. Si hay **un solo error**,
no escribe nada y sale con código 1; cada error dice fichero, tarjeta y qué falla. Los avisos (secuencia distinta de
la aprobada, bloques citados que ninguna tarjeta usa) no paran la generación, pero revíselos.

El generador es idempotente: ejecutarlo dos veces deja los ficheros igual (la segunda dice «sin cambios»).

## 3. El fichero

```yaml
leccion: cap01/sec-1.4            # parte/label de la sección (h2); el nombre del fichero debe coincidir

libro:                            # bloques del libro de los que sale: índice del bloque → cita literal
  83: "Con 12 V, 10 kΩ y 5 kΩ, la salida es 4,00 V"
  82: 'V_("salida") = V_("entrada")'           # una ecuación: un trozo de su fuente Typst
  "cap01#345": "Diseña un divisor de tensión"  # un bloque de fuera de la sección (ejercicios…): «parte#n»

modelo:
  valores:   { … }                # lo que mueven los mandos
  calculos:  { … }                # lo que se calcula

tarjetas:
  - { … }                         # en orden; la última es el resumen
```

### 3.1 `libro`: citar los bloques

- La **clave** es el índice del bloque de primer nivel en `partes/<parte>.json` (el mismo `data-b` del lector). Para
  verlos:
  ```sh
  python3 -c "
  import json; d=json.load(open('web/public/libro/partes/cap01.json'))
  for i,b in enumerate(d['bloques'][76:107], 76): print(i, b['t'], json.dumps(b, ensure_ascii=False)[:160])"
  ```
- El **valor** es una cita literal (unas palabras seguidas) del texto de ese bloque. El generador comprueba que el
  bloque la contiene: si el libro se regenera y los índices se mueven, falla y lo sabrá.
- Un número suelto debe ser de la sección; de otra parte o de fuera de la sección, escriba `"cap01#345"`.
- Cada tarjeta dice de qué bloques sale con `libro: [83, 84]` (deben estar en la lista).

### 3.2 `modelo`: valores y cálculos

```yaml
modelo:
  valores:
    V_in: { sim: "V_{entrada}", nombre: "tensión de la pila", unidad: V, valor: 12 }
    R_1:  { sim: "R₁", nombre: "resistencia de arriba", unidad: Ω, valor: 10000 }
    carga: { tipo: interruptor, nombre: "carga conectada", valor: 0 }      # 0 abierto, 1 cerrado
  calculos:
    R_ab:  { si: carga, entonces: "par(R_2, R_L)", sino: "R_2", unidad: Ω, nombre: "…" }
    V_out: { expr: "V_in*R_ab/(R_1 + R_ab)", sim: "V_{salida}", nombre: "tensión de salida", unidad: V }
    error: { expr: "(V_vacio - V_out)/V_vacio*100", unidad: "%", cifras: 2, nombre: "error por la carga" }
```

- Unidades **SI sin prefijo** (Ω, V, A, s, Hz, F, H, W, °, %, rad/s): `10000`, no `10k`. La app pone los prefijos
  («10 kΩ», «20,0 ms»).
- `cifras` (3 por defecto) y `recortar`: los valores se muestran sin ceros de más («12 V»); los cálculos con sus
  cifras («4,00 V»).
- Expresiones: el lenguaje de las calculadoras (`+ - * / ^`, `sqrt exp ln log10 sin cos tan atan2 abs floor round
  min max`, `par(a, b, …)` = paralelo, `wright(x)` = ω de Wright, para un diodo de Shockley (§5.3), `pi`). No hay `?:`: para elegir use `si / entonces / sino` con un interruptor.
  Los ángulos de `sin`/`cos` van en radianes (`phi*pi/180`).
- Nombres: letras, cifras y `_` (`R_1`, `V_out`). No use `pi`, `t` si la gráfica usa `t`, ni `estimacion`.

### 3.3 El texto de las tarjetas

| Escriba | Se ve |
|---|---|
| `{{V_out}}` | el valor vivo de un valor o cálculo, con su unidad («4,00 V») |
| `R₁`, `V_{salida}`, `x^{2}` | subíndice / superíndice |
| `**así**` | negrita |

Sin HTML. Ponga entre comillas dobles cualquier texto con `: ` o que empiece por `{`, `[`, `*`, `-` (YAML).

## 4. Tipos de tarjeta

Campos comunes: `id` (único, minúsculas y guiones: con él se guardan las respuestas, **no lo cambie** una vez
publicada la lección), `tipo`, `titulo`, `texto`, `libro`, y opcionales `fase` (la etiqueta: «Estime», «Ordene»…),
`nota`, `fijar`, `inicio`, `widget`, `comprobar`.

- `fijar: { R_1: 10000 }` — valores que la tarjeta mantiene (no tienen mando); al pasar a otra tarjeta vuelven los del
  lector.
- `inicio: { R_2: 1000 }` — valores que se ponen al entrar la primera vez (un reto no puede empezar resuelto). Deben
  ser posiciones del mando.
- Los valores que el lector mueve **siguen** a las tarjetas siguientes (la fórmula usa lo que dejó al explorar).

| tipo | Para qué | Necesita |
|---|---|---|
| `explorar` | mover y notar | `widget` con mandos; `requiere` (si no, basta mover uno) |
| `predecir` | apostar antes de ver | `opciones`; `widget` con `ocultar: true` (las lecturas salen «¿?» hasta acertar o saltar la tarjeta: un fallo no las enseña) |
| `formula` | formalizar | `ec` (el bloque `ec` del libro) y `sustitucion`; un `widget` para moverla |
| `reto` | aplicar | `widget` con mandos, `condiciones`, `exito`, `pistas`, `ayuda` |
| `sorpresa` | lo inesperado | como explorar (p. ej. `requiere: { conectar: [carga] }` con un mando `conectar`) |
| `porque` | por qué pasa | `opciones` |
| `pregunta` | comprobar | una de `opciones`, `estimar`, `ordenar`, `emparejar` |
| `resumen` | cerrar | `ideas` (1–4); es la última tarjeta |

### Opciones (predecir, pregunta, porque)

```yaml
opciones:
  - texto: "4 V"
    bien: true
    porque: "R₂ es la tercera parte de R₁ + R₂: se queda con la tercera parte de los 12 V."
  - texto: "8 V"
    porque: "Esos 8 V son los que se queda R₁. La salida mide la tensión de R₂."
```

2–5 opciones, exactamente una `bien: true`, **todas con `porque`**. La incorrecta explica qué confusión lleva a ella.
Teclas: 1–5 o A–E. Una opción fallada queda marcada y no se puede volver a elegir.

### Fórmula

```yaml
ec: 82                                          # bloque «ec» del libro (en la lista libro)
sustitucion: "{{V_in}} · {{R_2}} / ({{R_1}} + {{R_2}}) = {{V_out}}"
```

La ecuación es el dibujo del libro (se lee en voz alta con `habla-matematicas`); la sustitución usa los valores
actuales y se lee con su unidad.

### Reto

```yaml
condiciones:
  - { valor: V_out, objetivo: 3.3, tol: 0.02, rotulo: "Salida: {{V_out}}" }   # ± 2 %; o min/max, menor, mayor
exito: "Su R₂ da {{V_out}}. El libro despeja R₂ = 1941 Ω y elige 2 kΩ: 3,33 V."
pistas:                                            # la primera que se cumple; una sin «cuando» se cumple siempre
  - { cuando: { valor: V_out, mayor: 3.366 }, texto: "Sobra tensión: R₂ tiene que ser menor frente a R₁." }
  - { cuando: { valor: V_out, menor: 3.234 }, texto: "Falta tensión: R₂ tiene que ser mayor frente a R₁." }
ayuda: "Despeje 3,3 = 5 · R₂ / (1000 + R₂): R₂ = 1941 Ω."  # tras dos comprobaciones fallidas
```

El generador recorre **todas** las posiciones de los mandos: debe haber al menos una solución, el reto no puede
empezar resuelto y toda posición que falle debe tener una pista que se le aplique. Use tolerancias y objetivos del
libro (o el 2 % de la app si el libro no da otra).

### Estimar (pregunta con un deslizador que puntúa por cercanía)

```yaml
estimar:
  objetivo: "R_p"            # expresión del modelo (con los valores de la tarjeta)
  unidad: Ω
  min: 0
  max: 200
  paso: 1
  inicio: 150                # no puede estar ya dentro de la tolerancia
  tol: 0.05                  # dentro del 5 %: bien
  rotulo: "1000 ‖ 100"
exito: "90,9 Ω: siempre menor que la menor."
pistas:
  - { cuando: { valor: estimacion, mayor: 100 }, texto: "Se ha pasado: …" }   # «estimacion» = lo que eligió
  - { texto: "Se ha quedado corto: …" }
```

### Ordenar / emparejar

```yaml
ordenar:                       # 3–7 pasos, en su orden correcto (la app los baraja siempre igual)
  - "Identificar la asociación más interna."
  - "Sustituirla por su equivalente y redibujar."
emparejar:                     # 2–6 parejas [izquierda, derecha]
  - ["Vₚ", "Amplitud, el valor de pico"]
  - ["ω", "Frecuencia angular, en radianes por segundo"]
exito: "…"
pistas: [ { texto: "…" } ]
```

Se ordena arrastrando o con «Subir/Bajar»; se empareja arrastrando la ficha al hueco o eligiendo ficha y hueco (teclado).
Las fichas y los textos de la izquierda largos (más de unos 40 caracteres) parten la línea solos, también a 360 px:
no hace falta acortarlos por eso (sí por el límite de 20 palabras por pareja).

### Resumen

```yaml
- id: resumen
  tipo: resumen
  titulo: "Lección completada"
  libro: [81, 85, 89]
  ideas:
    - { titulo: "En serie.", texto: "La corriente es común y la tensión se reparte en proporción a las resistencias." }
```

La app añade los aciertos, los XP, la racha, cuándo toca el repaso (calculado con el dominio de la sección, al que
cuentan las respuestas de la lección) y la siguiente sección.

## 5. Catálogo de widgets

Hay dos widgets: `circuito` (un esquema del libro vivo, con su gráfica frente al tiempo o a la frecuencia si la
tarjeta la pide) y `grafica` (una función con parámetros que se arrastran). Todo lo que muestran lo calcula **su
modelo** (§3.2); el generador comprueba cada circuito con el **ngspice de la app** (§5.3), así que un modelo que no
describe el circuito dibujado no llega a publicarse.

Ejemplos completos y probados de cada esquema: `web/tests/lecciones11-catalogo/cap01/sec-1.5.yaml` (una lección de
prueba con una tarjeta por esquema; no se publica). Cópielos y cambie los valores por los de su sección.

### 5.1 `circuito`

```yaml
widget:
  tipo: circuito
  esquema: divisor                                   # uno de los de §5.4
  piezas: { fuente: V_in, arriba: R_1, abajo: R_2, carga: R_L, interruptor: carga }   # pieza del dibujo → valor o cálculo
  lectura: { valor: V_out, rotulo: "Tensión de salida" }        # la lectura grande
  barras:                                            # reparto (proporción de la suma): ≥ 2
    - { valor: V_1, rotulo: "R₁ se queda {{V_1}}", color: azul }
    - { valor: V_out, rotulo: "R₂ se queda {{V_out}}", color: naranja }
  datos:                                             # fichas con otras lecturas
    - { valor: error, rotulo: "Error por la carga: {{error}}" }
  corriente: I                                       # la corriente que se mueve (más deprisa con más corriente)
  mide: { salida: V_out, corriente: I }              # qué cálculo da cada medida del esquema (se comprueba con ngspice)
  ocultar: false                                     # true en predecir: las lecturas salen «¿?» hasta acertar o saltar
  grafica: { … }                                     # opcional: curvas frente al tiempo o la frecuencia (§5.2)
  dibujo: false                                      # opcional: solo la gráfica y los mandos (el circuito ya se vio)
  mandos:
    - { valor: R_1, min: 1000, max: 20000, paso: 100 }            # deslizador lineal
    - { valor: R_2, serie: E24, min: 1000, max: 10000, rotulo: "R₂ (E24)" }   # selector E12/E24
    - { valor: R_L, lista: [1000, 10000, 100000] }                # lista de valores
    - { valor: c_1, lista: [1, 2, 3], nombres: [marrón, rojo, naranja] }   # lista con un nombre por posición
    - { valor: carga, tipo: conectar, boton: "Conectar la carga (10 kΩ)" }    # botón que cierra un interruptor
    - { valor: s, tipo: interruptor, rotulo: "Fuente encendida" }  # interruptor de ida y vuelta
```

- **`mide` es obligatorio** (o, si la tarjeta solo tiene gráfica, al menos una curva con `mide`): cada medida del
  esquema que la tarjeta enseña, con el cálculo del modelo que la da. Las medidas de cada esquema están en §5.4.
- Una pieza puede ser un valor o un cálculo del modelo (un potenciómetro: `arriba: R_a` con `R_a = (1 - x)*R_pot`),
  salvo las caídas constantes de diodos y transistores, que deben ser valores (§5.3).
- Colores: cada esquema da el de cada pieza (la primera azul, la segunda naranja, la carga verde); el mando de una
  pieza lleva su color. El deslizador de una carga con interruptor aparece al conectarla.
- Los rótulos del dibujo son el `sim` y el valor de cada pieza («R_{L} 45 Ω», con su subíndice); dé a cada valor un
  `sim` corto. El lector de pantalla oye la descripción del esquema con los valores y la lectura.
- Unidades SI sin prefijo también en los mandos: 100 nF es `100e-9`, 10 mH es `0.01` (la app pone «100 nF»). Vale
  igual para valores muy pequeños (pF, ns, nA, nV/√Hz) en deslizadores, listas, asas y estimaciones: el lector de
  pantalla oye «220 nanofaradios» y `aria-valuenow` va sin exponente («0.00000022»), también al moverlos. No hace falta
  estimar en «nV» ni dejar fija una capacidad para evitarlo.

#### Mando de lista con nombres

Cuando cada posición de una lista tiene un nombre (los colores del código de colores, un material, una forma de
onda), póngalos en `nombres`, uno por valor y **en el mismo orden que `lista`**. El mando enseña y lee «rojo (2)»
(con la unidad del valor si la tiene: «carbón (4,7 kΩ)»); con el teclado se mueve como cualquier deslizador (flechas, Inicio, Fin). Los
nombres no llevan cifras (el valor ya va entre paréntesis), no se repiten y tienen como mucho 24 caracteres; solo
valen con `lista`. Ejemplo probado (tarjeta `codigo-colores` de la lección de catálogo):

```yaml
modelo:
  valores:
    c_1: { sim: "c₁", nombre: "primera cifra", unidad: "", valor: 2 }
    c_2: { sim: "c₂", nombre: "segunda cifra", unidad: "", valor: 2 }
    c_m: { sim: "m", nombre: "potencia de diez", unidad: "", valor: 1 }
    V_cb: { sim: "V", nombre: "tensión de la fuente", unidad: V, valor: 12 }
  calculos:
    R_cb: { expr: "(10*c_1 + c_2)*10^c_m", sim: "R", nombre: "resistencia", unidad: Ω }
    I_cb: { expr: "V_cb/R_cb", sim: "I", nombre: "corriente", unidad: A }
tarjetas:
  - id: codigo-colores
    tipo: explorar
    titulo: "Código de colores"
    texto: "Elija el color de cada banda y mire la resistencia."
    libro: [112]
    widget:
      tipo: circuito
      esquema: resistencia
      piezas: { fuente: V_cb, r: R_cb }
      lectura: { valor: R_cb, rotulo: "Resistencia" }
      corriente: I_cb
      mide: { corriente: I_cb, tension: V_cb }
      mandos:
        - { valor: c_1, rotulo: "Primera banda", lista: [1, 2, 3, 4, 5, 6, 7, 8, 9], nombres: [marrón, rojo, naranja, amarillo, verde, azul, violeta, gris, blanco] }
        - { valor: c_2, rotulo: "Segunda banda", lista: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], nombres: [negro, marrón, rojo, naranja, amarillo, verde, azul, violeta, gris, blanco] }
        - { valor: c_m, rotulo: "Multiplicador", lista: [0, 1, 2, 3, 4, 5], nombres: [negro, marrón, rojo, naranja, amarillo, verde] }
```

Los `{{c_1}}` del texto siguen dando el número; el nombre solo lo dice el mando.

### 5.2 La gráfica de un circuito (y `grafica`)

```yaml
  grafica:                                            # dentro del widget circuito
    x: { id: t, min: 0, max: 5, unidad: s, rotulo: "t" }         # «t»: la variable del eje (no del modelo)
    y: { min: -10, max: 10, unidad: V, rotulo: "v" }
    curvas:
      - { expr: "V_c0 + (V_cf - V_c0)*(1 - exp(-t/tau_c))", color: naranja, rotulo: "v_{C}", mide: vc }
      - { expr: "V_cc*exp(-t/tau_c)", color: azul, rotulo: "v_{R}", mide: vr, discontinua: true }
    marcas:                                           # puntos fijos con rótulo y guías a los ejes
      - { x: "tau_c", y: "v_tau", rotulo: "τ: {{v_tau}}" }          # guias: false para quitar las guías
```

- `mide` en una curva: la curva del esquema que dibuja (§5.4: «curvas frente al tiempo» o «en alterna»). Las curvas
  sin `mide` (una referencia, una asíntota) no se comprueban.
- **Frente al tiempo**: el eje empieza en 0 o después. Los esquemas de conmutación (`carga-rc`, `carga-rl`) empiezan
  en t = 0 desde su estado inicial (piezas `v0`, `i0`); los de alterna (`filtro-rc`, `filtro-rl`, `rlc-serie`,
  `rlc-paralelo`) ya en régimen permanente, así que su curva es la senoide estacionaria; los rectificadores
  (`media-onda`, `puente`) se comparan tras cuatro periodos, cuando el rizado ya se ha asentado.
- **Frente a la frecuencia**: `x: { id: nu, min: 10, max: 100000, unidad: Hz, escala: log }`. El eje `y` también
  admite `escala: log` (una reactancia). Use un `id` que no sea del modelo (`nu`, no `f`).
- Las marcas son expresiones del modelo (como las asas): defina en `calculos` dónde están (`tau_c`, `v_tau`, `f_c`).
- `grafica` como widget propio (sin circuito) admite lo mismo salvo `mide`, y además asas que se arrastran:

```yaml
widget:
  tipo: grafica
  x: { id: t, min: 0, max: 0.04, unidad: s, rotulo: "t" }
  y: { min: -400, max: 400, unidad: V, rotulo: "v(t)" }
  curvas:
    - { expr: "V_p*sin(2*pi*f*t + phi*pi/180)", color: azul, rotulo: "v(t)" }
    - { expr: "V_p*cos(2*pi*f*t)", color: tinta, rotulo: "coseno", discontinua: true }
  asas:                                       # puntos que se arrastran: mueven «mueve» a la posición más cercana
    - { mueve: V_p, x: "t_cresta", y: "V_p", rotulo: "Cresta: amplitud" }
    - { mueve: phi, x: "t_cero", y: "0", rotulo: "Paso por cero: fase" }
  marcas: [ { x: "T", y: "0", rotulo: "T" } ]
  lectura: { valor: T, rotulo: "Periodo" }
  datos: [ { valor: omega, rotulo: "ω = {{omega}}" } ]
  mandos: [ { valor: V_p, min: 50, max: 400, paso: 5, rotulo: "Amplitud, V_{p}" } ]
```

Las asas son expresiones del modelo (no del eje): defina en `calculos` dónde está el punto (p. ej. `t_cresta`). Cada
asa necesita un deslizador de su valor en la misma tarjeta. Con el teclado, el asa es un deslizador más.

### 5.3 Cómo se comprueba con el simulador

El generador simula el circuito dibujado con los valores del modelo en el **estado inicial de la tarjeta, en los dos
extremos de cada mando y en cada `comprobar` con `con`**, y compara:

| Qué | Análisis | Tolerancia |
|---|---|---|
| Una lectura de `mide` en continua | `.op` | 0,1 % |
| Una lectura en alterna (`…_amp`, `…_fase`, `…_db`) a la frecuencia de la pieza `f` | `.ac` en un punto | 0,1 %; fase 0,1°; 0,01 dB |
| Una curva frente al tiempo | `.tran` (paso = eje/1000) | 1 % de la altura del eje `y` |
| Una curva frente a la frecuencia | `.ac` (40 puntos por década) | 0,1 % (+ 0,01 % del eje); fase 0,1°; 0,01 dB |

Siempre con un mínimo de 1 nA y 1 µV: ngspice pone 10⁻¹² S en paralelo con cada unión y un diodo en inversa «pierde»
picoamperios.

**Diodos y transistores: los modelos del libro** (sección 5.3, «Los tres modelos y cuándo usar cada uno»).

- *Caída constante* (`vd: V_D` con 0,7 V; `vf` de un LED, 2,0 V; `vz` de un Zener, con `rz` si la usa; `vbe` y
  `vcesat` del transistor, 0,7 V y 0,2 V). Escriba el modelo como lo hace el libro: `I = max(0, (V - V_D)/R)`;
  `I_C = min(beta*I_B, (V_CC - V_CEsat)/R_C)`. El simulador usa un dispositivo real exponencial que cae exactamente
  ese valor a una corriente de referencia (10 mA un diodo; 20 mA un LED con n = 2; 5 mA un Zener; 1 mA la base de un
  transistor, con su β), lee lo que cae de verdad, corrige la lectura del modelo con su propia sensibilidad a esa
  caída y la compara al 0,1 %. Así un modelo mal planteado (β en lugar de β + 1, una caída olvidada) se detecta como
  con una resistencia. Además la caída real no puede alejarse de la del modelo más de lo que el libro admite: ± 0,1 V
  un diodo o un Zener (de 0,2 a 500 mA; 0,1 a 250 mA el Zener), ± 0,2 V un LED (la dispersión de 1,8 a 2,2 V del
  libro), ± 0,1 V V_BE (20 µA a 50 mA) y ± 0,2 V V_CE(sat) (de 0,05 a 0,15 V reales con β forzada de 3 a 10). Fuera de
  ese margen (corrientes muy pequeñas, el borde entre corte, activa y saturación) el generador lo dice: mueva el
  extremo del mando.
- En las *curvas* de los rectificadores la caída de los diodos cambia a lo largo del ciclo (pulsos de amperios al
  recargar el condensador, sección 5.6): la tolerancia de la curva suma ± 0,2 V por diodo multiplicado por la
  sensibilidad de la curva a `vd` (dos diodos en el puente: ± 0,4 V).
- *Shockley* (`is`, `n`, y `vt` si no es 25,85 mV): el simulador usa exactamente esa ecuación a la temperatura que da
  ese V_T, con la tolerancia de una resistencia. Para resolver el circuito, el lenguaje del modelo tiene
  `wright(x)` (la ω de Wright, w + ln w = x): con una fuente `V`, una resistencia `R` y el diodo,

```yaml
    I_D: { expr: "n*V_T/R*wright(ln(I_S*R/(n*V_T)) + (V + I_S*R)/(n*V_T)) - I_S", unidad: A, … }
    V_D: { expr: "V - I_D*R", unidad: V, … }
```

**Un error del simulador** dice la tarjeta, el estado (1 = el inicial; luego los extremos de cada mando, en orden;
luego los `comprobar`), qué da el modelo y qué da ngspice. Casi siempre es una fórmula del modelo que no corresponde
al dibujo, una pieza cambiada (`r1` por `r2`) o una medida con el signo del sentido dibujado al revés (las
corrientes van como las dibuja el esquema: §5.4).

### 5.4 Los esquemas

`divisor` y `paralelo` son los de la lección de referencia `cap01/sec-1.4` (§5.1 tiene el divisor completo):

- `divisor` — fuente y dos resistencias en serie; carga opcional en paralelo con la de abajo. Piezas `fuente`,
  `arriba`, `abajo`, `carga`?, `interruptor`? (conecta la carga; sin él, siempre conectada). Mide `salida` (tensión
  del nodo), `corriente` (de la fuente), `abajo` (por la de abajo), `carga` (por la carga; 0 si está desconectada).
- `paralelo` — fuente y dos resistencias en paralelo. Piezas `fuente`, `r1`, `r2`. Mide `total`, `i1`, `i2`.
- `resistencia` — fuente y una sola resistencia (ley de Ohm, potencia). Piezas `fuente`, `r`. Mide `corriente`,
  `tension` (la de la resistencia). Ejemplo: `cap01/sec-1.1` (220 Ω con 12 V).

En los demás, «?» marca una pieza opcional.

#### `serie` — Resistencias en serie

Fuente y de dos a cuatro resistencias en un solo lazo; la corriente común y la tensión de cada una.

Piezas: `fuente` tensión de la fuente (V); `r1` primera resistencia, arriba a la izquierda (Ω); `r2` segunda resistencia, arriba a la derecha (Ω); `r3`? tercera resistencia, a la derecha (Ω); `r4`? cuarta resistencia, abajo (Ω).

Mide (`mide`, continua): `corriente` corriente del lazo; `v1` tensión en la primera resistencia; `v2` tensión en la segunda; `v3` tensión en la tercera; `v4` tensión en la cuarta.

```yaml
modelo:
  valores:
    V_s: { sim: "V", nombre: "tensión de la fuente", unidad: V, valor: 12 }
    R_s1: { sim: "R₁", nombre: "primera resistencia", unidad: Ω, valor: 4 }
    R_s2: { sim: "R₂", nombre: "segunda resistencia", unidad: Ω, valor: 6 }
    R_s3: { sim: "R₃", nombre: "tercera resistencia", unidad: Ω, valor: 2 }
    R_s4: { sim: "R₄", nombre: "cuarta resistencia", unidad: Ω, valor: 3 }
  calculos:
    I_s: { expr: "V_s/(R_s1 + R_s2 + R_s3 + R_s4)", sim: "I", nombre: "corriente", unidad: A }
    V_s1: { expr: "I_s*R_s1", sim: "V₁", nombre: "tensión en R₁", unidad: V }
    V_s2: { expr: "I_s*R_s2", sim: "V₂", nombre: "tensión en R₂", unidad: V }
    V_s3: { expr: "I_s*R_s3", sim: "V₃", nombre: "tensión en R₃", unidad: V }
    V_s4: { expr: "I_s*R_s4", sim: "V₄", nombre: "tensión en R₄", unidad: V }
tarjetas:
  - # … id, tipo, titulo, texto, libro
    widget:
      tipo: circuito
      esquema: serie
      piezas: { fuente: V_s, r1: R_s1, r2: R_s2, r3: R_s3, r4: R_s4 }
      lectura: { valor: I_s, rotulo: "Corriente" }
      barras:
        - { valor: V_s1, rotulo: "R₁: {{V_s1}}", color: azul }
        - { valor: V_s2, rotulo: "R₂: {{V_s2}}", color: naranja }
        - { valor: V_s3, rotulo: "R₃: {{V_s3}}", color: verde }
      corriente: I_s
      mide: { corriente: I_s, v1: V_s1, v2: V_s2, v3: V_s3, v4: V_s4 }
      mandos:
        - { valor: R_s1, min: 1, max: 20, paso: 1 }
        - { valor: R_s4, lista: [1, 3, 10] }
```

#### `mixto` — Red mixta: serie y paralelo

R₁ en serie con el paralelo R₂ ‖ R₃; corriente total, la de cada rama y las dos tensiones.

Piezas: `fuente` tensión de la fuente (V); `r1` resistencia en serie, arriba (Ω); `r2` primera rama del paralelo (Ω); `r3` segunda rama del paralelo (Ω).

Mide (`mide`, continua): `corriente` corriente total (por R₁); `i2` corriente por la rama de R₂; `i3` corriente por la rama de R₃; `v1` tensión en R₁; `paralelo` tensión del paralelo.

```yaml
modelo:
  valores:
    V_m: { sim: "V", nombre: "tensión de la fuente", unidad: V, valor: 12 }
    R_m1: { sim: "R₁", nombre: "resistencia en serie", unidad: Ω, valor: 100 }
    R_m2: { sim: "R₂", nombre: "primera rama", unidad: Ω, valor: 220 }
    R_m3: { sim: "R₃", nombre: "segunda rama", unidad: Ω, valor: 470 }
  calculos:
    V_mp: { expr: "I_m*R_mp", sim: "V_{p}", nombre: "tensión del paralelo", unidad: V }
    I_m2: { expr: "V_mp/R_m2", sim: "I₂", nombre: "corriente por R₂", unidad: A }
    I_m3: { expr: "V_mp/R_m3", sim: "I₃", nombre: "corriente por R₃", unidad: A }
    I_m: { expr: "V_m/(R_m1 + R_mp)", sim: "I", nombre: "corriente total", unidad: A }
    V_m1: { expr: "I_m*R_m1", sim: "V₁", nombre: "tensión en R₁", unidad: V }
tarjetas:
  - # … id, tipo, titulo, texto, libro
    widget:
      tipo: circuito
      esquema: mixto
      piezas: { fuente: V_m, r1: R_m1, r2: R_m2, r3: R_m3 }
      lectura: { valor: V_mp, rotulo: "Tensión del paralelo" }
      datos:
        - { valor: I_m2, rotulo: "I₂ = {{I_m2}}" }
        - { valor: I_m3, rotulo: "I₃ = {{I_m3}}" }
      corriente: I_m
      mide: { corriente: I_m, i2: I_m2, i3: I_m3, v1: V_m1, paralelo: V_mp }
      mandos:
        - { valor: R_m2, serie: E12, min: 100, max: 1000 }
```

#### `kirchhoff` — Dos fuentes y un nodo

Dos fuentes con su resistencia sobre una carga común; tensión del nodo y las tres corrientes (Kirchhoff, superposición).

Piezas: `fuente1` tensión de la fuente de la izquierda (V); `fuente2` tensión de la fuente de la derecha (V); `r1` resistencia de la fuente de la izquierda (Ω); `r2` resistencia de la fuente de la derecha (Ω); `r3` carga común, del nodo a masa (Ω); `activa1`? fuente de la izquierda encendida (apagada = cortocircuito); `activa2`? fuente de la derecha encendida (apagada = cortocircuito).

Mide (`mide`, continua): `nodo` tensión del nodo común (la de la carga); `i1` corriente que la rama izquierda lleva al nodo; `i2` corriente que la rama derecha lleva al nodo; `i3` corriente que baja por la carga.

```yaml
modelo:
  valores:
    V_k1: { sim: "V₁", nombre: "fuente de la izquierda", unidad: V, valor: 12 }
    V_k2: { sim: "V₂", nombre: "fuente de la derecha", unidad: V, valor: 6 }
    R_k1: { sim: "R₁", nombre: "resistencia de la izquierda", unidad: Ω, valor: 1000 }
    R_k2: { sim: "R₂", nombre: "resistencia de la derecha", unidad: Ω, valor: 1000 }
    R_k3: { sim: "R₃", nombre: "carga común", unidad: Ω, valor: 2000 }
    k_on1: { tipo: interruptor, nombre: "fuente de la izquierda encendida", valor: 1 }
    k_on2: { tipo: interruptor, nombre: "fuente de la derecha encendida", valor: 1 }
  calculos:
    V_kn: { expr: "(E_k1/R_k1 + E_k2/R_k2)/(1/R_k1 + 1/R_k2 + 1/R_k3)", sim: "V_{nodo}", nombre: "tensión del nodo", unidad: V }
    I_k1: { expr: "(E_k1 - V_kn)/R_k1", sim: "I₁", nombre: "corriente de la izquierda", unidad: A }
    I_k2: { expr: "(E_k2 - V_kn)/R_k2", sim: "I₂", nombre: "corriente de la derecha", unidad: A }
    I_k3: { expr: "V_kn/R_k3", sim: "I₃", nombre: "corriente por la carga", unidad: A }
tarjetas:
  - # … id, tipo, titulo, texto, libro
    widget:
      tipo: circuito
      esquema: kirchhoff
      piezas: { fuente1: V_k1, fuente2: V_k2, r1: R_k1, r2: R_k2, r3: R_k3, activa1: k_on1, activa2: k_on2 }
      lectura: { valor: V_kn, rotulo: "Tensión del nodo" }
      datos:
        - { valor: I_k1, rotulo: "I₁ = {{I_k1}}" }
        - { valor: I_k2, rotulo: "I₂ = {{I_k2}}" }
        - { valor: I_k3, rotulo: "I₃ = {{I_k3}}" }
      corriente: I_k3
      mide: { nodo: V_kn, i1: I_k1, i2: I_k2, i3: I_k3 }
      mandos:
        - { valor: k_on1, tipo: interruptor, rotulo: "Fuente de la izquierda" }
        - { valor: k_on2, tipo: interruptor, rotulo: "Fuente de la derecha" }
        - { valor: R_k3, min: 500, max: 5000, paso: 500 }
```

#### `wheatstone` — Puente de Wheatstone

Dos divisores sobre la misma fuente y un detector entre sus puntos medios.

Piezas: `fuente` tensión de alimentación (V); `r1` rama izquierda, arriba (Ω); `r2` rama izquierda, abajo (Ω); `r3` rama derecha, arriba (Ω); `r4` rama derecha, abajo (Ω); `rd`? resistencia del detector (Ω); sin ella, un voltímetro ideal.

Mide (`mide`, continua): `salida` tensión del detector (punto medio izquierdo menos derecho); `va` punto medio de la rama izquierda; `vb` punto medio de la rama derecha; `corriente` corriente de la fuente; `detector` corriente por el detector, de izquierda a derecha.

```yaml
modelo:
  valores:
    V_w: { sim: "V", nombre: "alimentación del puente", unidad: V, valor: 5 }
    R_w1: { sim: "R₁", nombre: "rama izquierda, arriba", unidad: Ω, valor: 1000 }
    R_w2: { sim: "R₂", nombre: "rama izquierda, abajo", unidad: Ω, valor: 1000 }
    R_w3: { sim: "R₃", nombre: "rama derecha, arriba", unidad: Ω, valor: 1000 }
    R_w4: { sim: "R₄", nombre: "rama derecha, abajo", unidad: Ω, valor: 1010 }
    R_wd: { sim: "R_{d}", nombre: "resistencia del detector", unidad: Ω, valor: 1000 }
  calculos:
    V_wab: { expr: "V_wa - V_wb", sim: "V_{ab}", nombre: "tensión del detector", unidad: V, cifras: 3 }
    I_wd: { expr: "(V_wa0 - V_wb0)/(par(R_w1, R_w2) + R_wd + par(R_w3, R_w4))", sim: "I_{d}", nombre: "corriente del detector", unidad: A }
    I_w: { expr: "(V_w - V_wa)/R_w1 + (V_w - V_wb)/R_w3", sim: "I", nombre: "corriente de la fuente", unidad: A }
    V_wa: { expr: "V_wa0 - I_wd*par(R_w1, R_w2)", sim: "V_{a}", nombre: "punto medio izquierdo", unidad: V }
    V_wb: { expr: "V_wb0 + I_wd*par(R_w3, R_w4)", sim: "V_{b}", nombre: "punto medio derecho", unidad: V }
tarjetas:
  - # … id, tipo, titulo, texto, libro
    widget:
      tipo: circuito
      esquema: wheatstone
      piezas: { fuente: V_w, r1: R_w1, r2: R_w2, r3: R_w3, r4: R_w4, rd: R_wd }
      lectura: { valor: V_wab, rotulo: "Detector" }
      datos:
        - { valor: I_wd, rotulo: "I_{d} = {{I_wd}}" }
      corriente: I_w
      mide: { salida: V_wab, va: V_wa, vb: V_wb, corriente: I_w, detector: I_wd }
      mandos:
        - { valor: R_w4, min: 990, max: 1010, paso: 1 }
```

#### `thevenin` — Fuente con resistencia y carga (Thévenin)

Fuente en serie con su resistencia (Thévenin o resistencia interna) y una carga en los bornes.

Piezas: `fuente` tensión en vacío, V_Th o la fem (V); `rth` resistencia en serie, R_Th o la interna (Ω); `carga` resistencia de carga (Ω); `interruptor`? conecta la carga (abierto: en vacío).

Mide (`mide`, continua): `salida` tensión en los bornes (la de la carga); `corriente` corriente por la carga; `interna` caída en la resistencia en serie.

```yaml
modelo:
  valores:
    V_t: { sim: "V_{vacío}", nombre: "tensión en vacío", unidad: V, valor: 9 }
    R_ti: { sim: "R_{int}", nombre: "resistencia interna", unidad: Ω, valor: 5 }
    R_tl: { sim: "R_{L}", nombre: "carga", unidad: Ω, valor: 45 }
    t_on: { tipo: interruptor, nombre: "carga conectada", valor: 0 }
  calculos:
    V_to: { si: t_on, entonces: "V_t*R_tl/(R_ti + R_tl)", sino: "V_t", sim: "V_{bornes}", nombre: "tensión en bornes", unidad: V }
    I_t: { si: t_on, entonces: "V_t/(R_ti + R_tl)", sino: "0", sim: "I", nombre: "corriente", unidad: A }
    V_ti: { expr: "I_t*R_ti", sim: "V_{int}", nombre: "caída interna", unidad: V }
tarjetas:
  - # … id, tipo, titulo, texto, libro
    widget:
      tipo: circuito
      esquema: thevenin
      piezas: { fuente: V_t, rth: R_ti, carga: R_tl, interruptor: t_on }
      lectura: { valor: V_to, rotulo: "Tensión en bornes" }
      corriente: I_t
      mide: { salida: V_to, corriente: I_t, interna: V_ti }
      mandos:
        - { valor: t_on, tipo: conectar, boton: "Conectar la carga" }
        - { valor: R_tl, lista: [5, 45, 100] }
```

#### `norton` — Fuente de corriente con resistencia en paralelo (Norton)

Fuente de corriente, su resistencia en paralelo y una carga en los bornes.

Piezas: `fuente` corriente de la fuente, I_N (A); `rn` resistencia en paralelo, R_Th (Ω); `carga` resistencia de carga (Ω); `interruptor`? conecta la carga (abierto: en vacío).

Mide (`mide`, continua): `salida` tensión en los bornes; `carga` corriente por la carga; `paralelo` corriente por la resistencia en paralelo.

```yaml
modelo:
  valores:
    I_n: { sim: "I_{N}", nombre: "corriente de Norton", unidad: A, valor: 3 }
    R_n: { sim: "R_{Th}", nombre: "resistencia en paralelo", unidad: Ω, valor: 2.4 }
    R_nl: { sim: "R_{L}", nombre: "carga", unidad: Ω, valor: 2.4 }
    n_on: { tipo: interruptor, nombre: "carga conectada", valor: 1 }
  calculos:
    V_no: { si: n_on, entonces: "I_n*par(R_n, R_nl)", sino: "I_n*R_n", sim: "V", nombre: "tensión en bornes", unidad: V }
    I_nl: { si: n_on, entonces: "V_no/R_nl", sino: "0", sim: "I_{L}", nombre: "corriente por la carga", unidad: A }
    I_nr: { expr: "V_no/R_n", sim: "I_{R}", nombre: "corriente por R_Th", unidad: A }
tarjetas:
  - # … id, tipo, titulo, texto, libro
    widget:
      tipo: circuito
      esquema: norton
      piezas: { fuente: I_n, rn: R_n, carga: R_nl, interruptor: n_on }
      lectura: { valor: V_no, rotulo: "Tensión en bornes" }
      corriente: I_nl
      mide: { salida: V_no, carga: I_nl, paralelo: I_nr }
      mandos:
        - { valor: n_on, tipo: interruptor, rotulo: "Carga" }
        - { valor: R_nl, lista: [1, 2.4, 10] }
```

#### `transformador` — Transformador ideal con carga

Fuente, transformador ideal de N₁ y N₂ espiras y una carga en el secundario.

Piezas: `fuente` tensión del primario (V, eficaz o de pico); `n1` espiras del primario; `n2` espiras del secundario; `carga` resistencia de carga del secundario (Ω); `interruptor`? conecta la carga (abierto: secundario en vacío).

Mide (`mide`, continua): `secundario` tensión del secundario; `i1` corriente del primario; `i2` corriente del secundario (por la carga).

```yaml
modelo:
  valores:
    V_1: { sim: "V₁", nombre: "tensión del primario", unidad: V, valor: 230 }
    N_1: { sim: "N₁", nombre: "espiras del primario", unidad: "", valor: 230 }
    N_2: { sim: "N₂", nombre: "espiras del secundario", unidad: "", valor: 12 }
    R_2l: { sim: "R_{L}", nombre: "carga del secundario", unidad: Ω, valor: 12 }
    tr_on: { tipo: interruptor, nombre: "carga conectada", valor: 1 }
  calculos:
    V_2: { expr: "V_1*N_2/N_1", sim: "V₂", nombre: "tensión del secundario", unidad: V }
    I_1: { expr: "I_2*N_2/N_1", sim: "I₁", nombre: "corriente del primario", unidad: A }
    I_2: { si: tr_on, entonces: "V_2/R_2l", sino: "0", sim: "I₂", nombre: "corriente del secundario", unidad: A }
tarjetas:
  - # … id, tipo, titulo, texto, libro
    widget:
      tipo: circuito
      esquema: transformador
      piezas: { fuente: V_1, n1: N_1, n2: N_2, carga: R_2l, interruptor: tr_on }
      lectura: { valor: V_2, rotulo: "Secundario" }
      datos:
        - { valor: I_1, rotulo: "I₁ = {{I_1}}" }
        - { valor: I_2, rotulo: "I₂ = {{I_2}}" }
      corriente: I_2
      mide: { secundario: V_2, i1: I_1, i2: I_2 }
      mandos:
        - { valor: N_2, min: 6, max: 46, paso: 2 }
        - { valor: tr_on, tipo: interruptor, rotulo: "Carga" }
```

#### `carga-rc` — Carga y descarga de un condensador (RC)

Fuente, conmutador, R y C desde t = 0; tensión del condensador, de la resistencia y corriente frente al tiempo.

Piezas: `fuente` tensión de la fuente (V); `r` resistencia (Ω); `c` capacidad (F); `v0`? tensión del condensador en t = 0 (V); sin ella, descargado; `interruptor`? conmutador: 1 carga desde la fuente, 0 descarga a masa (sin él, carga).

Curvas frente al tiempo (`mide` de una curva): `vc` tensión del condensador, v_C(t); `vr` tensión de la resistencia; `i` corriente (positiva al cargar).

```yaml
modelo:
  valores:
    V_c: { sim: "V_{CC}", nombre: "tensión de la fuente", unidad: V, valor: 9 }
    R_c: { sim: "R", nombre: "resistencia", unidad: Ω, valor: 10000 }
    C_c: { sim: "C", nombre: "capacidad", unidad: F, valor: 100e-6 }
    V_c0: { sim: "V₀", nombre: "tensión inicial del condensador", unidad: V, valor: 0 }
    c_modo: { tipo: interruptor, nombre: "conmutador en carga", valor: 1 }
  calculos:
    tau_c: { expr: "R_c*C_c", sim: "τ", nombre: "constante de tiempo", unidad: s }
    V_cf: { si: c_modo, entonces: "V_c", sino: "0", sim: "V_{final}", nombre: "tensión final", unidad: V }
    v_tau: { expr: "V_c0 + 0.632*(V_cf - V_c0)", sim: "v(τ)", nombre: "tensión en un τ", unidad: V }
tarjetas:
  - # … id, tipo, titulo, texto, libro
    widget:
      tipo: circuito
      esquema: carga-rc
      piezas: { fuente: V_c, r: R_c, c: C_c, v0: V_c0, interruptor: c_modo }
      lectura: { valor: tau_c, rotulo: "Constante de tiempo" }
      grafica:
        x: { id: t, min: 0, max: 5, unidad: s, rotulo: "t" }
        y: { min: -10, max: 10, unidad: V, rotulo: "v" }
        curvas:
          - { expr: "V_c0 + (V_cf - V_c0)*(1 - exp(-t/tau_c))", color: naranja, rotulo: "v_{C}", mide: vc }
          - { expr: "(V_cf - V_c0)*exp(-t/tau_c)", color: azul, rotulo: "v_{R}", mide: vr, discontinua: true }
        marcas:
          - { x: "tau_c", y: "v_tau", rotulo: "τ: {{v_tau}}" }
      mandos:
        - { valor: R_c, lista: [4700, 10000, 22000] }
        - { valor: C_c, lista: [47e-6, 100e-6] }
        - { valor: c_modo, tipo: interruptor, rotulo: "Conmutador en carga" }
```

#### `condensadores-serie` — Dos condensadores en serie con sus fugas

Fuente y dos condensadores en serie, cada uno con su fuga (dibujada a trazos como una resistencia en paralelo) y,
opcionalmente, una resistencia de equilibrado en paralelo con cada uno; el reparto de la tensión en régimen permanente
(sección 3.9). Ejemplo: `cap03/sec-3.9`.

Piezas: `fuente` tensión de la fuente (V); `c1` condensador de arriba (F); `c2` condensador de abajo (F); `f1` fuga del de arriba, como resistencia equivalente (Ω); `f2` fuga del de abajo (Ω); `re`? resistencia de equilibrado, la misma en paralelo con cada condensador (Ω); `interruptor`? conecta las dos de equilibrado (sin él, conectadas si hay `re`; desconectadas se dibujan como fantasma).

Mide (`mide`, continua: los condensadores, cargados, no conducen): `v1` tensión del de arriba; `v2` tensión del de abajo; `corriente` corriente de la fuente; `fuga1`, `fuga2` corriente de fuga de cada uno; `equilibrado` corriente por la de equilibrado de arriba (0 desconectadas; requiere `re`).

```yaml
modelo:
  valores:
    V_s: { sim: "V", nombre: "tensión total", unidad: V, valor: 400 }
    C_1: { sim: "C₁", nombre: "condensador de arriba", unidad: F, valor: 470e-6 }
    C_2: { sim: "C₂", nombre: "condensador de abajo", unidad: F, valor: 470e-6 }
    R_f1: { sim: "R_{f1}", nombre: "fuga del de arriba", unidad: Ω, valor: 10000000 }
    R_f2: { sim: "R_{f2}", nombre: "fuga del de abajo", unidad: Ω, valor: 15000000 }
    R_e: { sim: "R_{e}", nombre: "resistencia de equilibrado", unidad: Ω, valor: 100000 }
    eq_on: { tipo: interruptor, nombre: "resistencias de equilibrado conectadas", valor: 0 }
  calculos:
    Rt1: { si: eq_on, entonces: "par(R_f1, R_e)", sino: "R_f1", sim: "R₁", nombre: "en paralelo con C₁", unidad: Ω }
    Rt2: { si: eq_on, entonces: "par(R_f2, R_e)", sino: "R_f2", sim: "R₂", nombre: "en paralelo con C₂", unidad: Ω }
    I_s: { expr: "V_s/(Rt1 + Rt2)", sim: "I", nombre: "corriente de la fuente", unidad: A }
    V_1: { expr: "I_s*Rt1", sim: "V₁", nombre: "tensión en C₁", unidad: V }
    V_2: { expr: "I_s*Rt2", sim: "V₂", nombre: "tensión en C₂", unidad: V }
    I_e: { si: eq_on, entonces: "V_1/R_e", sino: "0", sim: "I_{e}", nombre: "corriente por la de equilibrado", unidad: A }
tarjetas:
  - # … id, tipo, titulo, texto, libro
    widget:
      tipo: circuito
      esquema: condensadores-serie
      piezas: { fuente: V_s, c1: C_1, c2: C_2, f1: R_f1, f2: R_f2, re: R_e, interruptor: eq_on }
      lectura: { valor: V_2, rotulo: "Tensión en C₂" }
      barras:
        - { valor: V_1, rotulo: "C₁: {{V_1}}", color: azul }
        - { valor: V_2, rotulo: "C₂: {{V_2}}", color: naranja }
      mide: { v1: V_1, v2: V_2, corriente: I_s, equilibrado: I_e }
      mandos:
        - { valor: eq_on, tipo: conectar, boton: "Conectar las de equilibrado" }
```

#### `carga-rl` — Transitorio de una bobina (RL)

Fuente, conmutador, R y L desde t = 0; corriente y tensiones de la bobina y la resistencia frente al tiempo.

Piezas: `fuente` tensión de la fuente (V); `r` resistencia (Ω); `l` inductancia (H); `i0`? corriente de la bobina en t = 0 (A); sin ella, cero; `interruptor`? conmutador: 1 conectada a la fuente, 0 descarga por la resistencia (sin él, conectada).

Curvas frente al tiempo (`mide` de una curva): `i` corriente del lazo, i(t); `vl` tensión de la bobina; `vr` tensión de la resistencia.

```yaml
modelo:
  valores:
    V_l: { sim: "V", nombre: "tensión de la fuente", unidad: V, valor: 10 }
    R_l: { sim: "R", nombre: "resistencia", unidad: Ω, valor: 100 }
    L_l: { sim: "L", nombre: "inductancia", unidad: H, valor: 0.01 }
    I_l0: { sim: "I₀", nombre: "corriente inicial", unidad: A, valor: 0 }
    l_modo: { tipo: interruptor, nombre: "conmutador a la fuente", valor: 1 }
  calculos:
    tau_l: { expr: "L_l/R_l", sim: "τ", nombre: "constante de tiempo", unidad: s }
    I_lf: { si: l_modo, entonces: "V_l/R_l", sino: "0", sim: "I_{final}", nombre: "corriente final", unidad: A }
tarjetas:
  - # … id, tipo, titulo, texto, libro
    widget:
      tipo: circuito
      esquema: carga-rl
      piezas: { fuente: V_l, r: R_l, l: L_l, i0: I_l0, interruptor: l_modo }
      lectura: { valor: tau_l, rotulo: "Constante de tiempo" }
      grafica:
        x: { id: t, min: 0, max: 0.0005, unidad: s, rotulo: "t" }
        y: { min: 0, max: 0.25, unidad: A, rotulo: "i" }
        curvas:
          - { expr: "I_l0 + (I_lf - I_l0)*(1 - exp(-t/tau_l))", color: naranja, rotulo: "i(t)", mide: i }
      mandos:
        - { valor: R_l, lista: [50, 100, 200] }
```

#### `filtro-rc` — RC en alterna (filtro paso bajo y paso alto)

Fuente senoidal, R y C en serie; v_C (paso bajo) y v_R (paso alto) frente al tiempo o a la frecuencia.

Piezas: `fuente` amplitud (valor de pico) de la fuente senoidal, V_p (V); `f` frecuencia de la fuente (Hz); `fase`? fase inicial de la fuente, φ (grados): v(t) = V_p·sen(2π·f·t + φ); `r` resistencia (Ω); `c` capacidad (F).

Curvas frente al tiempo (`mide` de una curva): `entrada` tensión de la fuente; `vc` tensión del condensador (salida paso bajo); `vr` tensión de la resistencia (salida paso alto); `i` corriente.

En alterna (lectura a la frecuencia `f` en `mide`, o curva frente a la frecuencia): `vc_amp`/`vc_fase`/`vc_db`, `vr_amp`/`vr_fase`/`vr_db`, `i_amp`/`i_fase`/`i_db` (amplitud de pico, fase en grados con la de la fuente, dB).

```yaml
modelo:
  valores:
    V_p: { sim: "V_{p}", nombre: "amplitud de la fuente", unidad: V, valor: 1 }
    f_f: { sim: "f", nombre: "frecuencia de la fuente", unidad: Hz, valor: 1000 }
    phi_f: { sim: "φ", nombre: "fase de la fuente", unidad: "°", valor: 30 }
    R_f: { sim: "R", nombre: "resistencia", unidad: Ω, valor: 1000 }
    C_f: { sim: "C", nombre: "capacidad", unidad: F, valor: 159.15e-9 }
  calculos:
    A_c: { expr: "V_p/sqrt(1 + x_c^2)", sim: "V_{C}", nombre: "amplitud en C", unidad: V }
    ph_c: { expr: "phi_f - atan(x_c)*180/pi", sim: "φ_{C}", nombre: "fase en C", unidad: "°" }
    A_r: { expr: "V_p*x_c/sqrt(1 + x_c^2)", sim: "V_{R}", nombre: "amplitud en R", unidad: V }
    w_f: { expr: "2*pi*f_f", sim: "ω", nombre: "frecuencia angular", unidad: "rad/s" }
    x_c: { expr: "w_f*R_f*C_f", sim: "ωRC", nombre: "ωRC", unidad: "" }
tarjetas:
  - # … id, tipo, titulo, texto, libro
    widget:
      tipo: circuito
      esquema: filtro-rc
      piezas: { fuente: V_p, f: f_f, fase: phi_f, r: R_f, c: C_f }
      lectura: { valor: A_c, rotulo: "Amplitud en C" }
      mide: { vc_amp: A_c, vc_fase: ph_c, vr_amp: A_r }
      grafica:
        x: { id: t, min: 0, max: 0.002, unidad: s, rotulo: "t" }
        y: { min: -1.2, max: 1.2, unidad: V, rotulo: "v" }
        curvas:
          - { expr: "V_p*sin(w_f*t + phi_f*pi/180)", color: tinta, rotulo: "entrada", mide: entrada, discontinua: true }
          - { expr: "A_c*sin(w_f*t + ph_c*pi/180)", color: naranja, rotulo: "v_{C}", mide: vc }
          - { expr: "A_r*sin(w_f*t + phi_f*pi/180 + pi/2 - atan(x_c))", color: azul, rotulo: "v_{R}", mide: vr }
      mandos:
        - { valor: f_f, lista: [500, 1000, 2000] }
```

```yaml
modelo:
  valores:
    V_p: { sim: "V_{p}", nombre: "amplitud de la fuente", unidad: V, valor: 1 }
    f_f: { sim: "f", nombre: "frecuencia de la fuente", unidad: Hz, valor: 1000 }
    R_f: { sim: "R", nombre: "resistencia", unidad: Ω, valor: 1000 }
    C_f: { sim: "C", nombre: "capacidad", unidad: F, valor: 159.15e-9 }
  calculos:
    f_c: { expr: "1/(2*pi*R_f*C_f)", sim: "f_{c}", nombre: "frecuencia de corte", unidad: Hz }
tarjetas:
  - # … id, tipo, titulo, texto, libro
    widget:
      tipo: circuito
      esquema: filtro-rc
      piezas: { fuente: V_p, f: f_f, r: R_f, c: C_f }
      lectura: { valor: f_c, rotulo: "Frecuencia de corte" }
      grafica:
        x: { id: nu, min: 10, max: 100000, unidad: Hz, rotulo: "f", escala: log }
        y: { min: 0, max: 1.1, unidad: V, rotulo: "amplitud" }
        curvas:
          - { expr: "V_p/sqrt(1 + (2*pi*nu*R_f*C_f)^2)", color: naranja, rotulo: "v_{C}", mide: vc_amp }
          - { expr: "V_p*(2*pi*nu*R_f*C_f)/sqrt(1 + (2*pi*nu*R_f*C_f)^2)", color: azul, rotulo: "v_{R}", mide: vr_amp }
        marcas:
          - { x: "f_c", y: "V_p*0.7071", rotulo: "f_{c}" }
      mandos:
        - { valor: R_f, lista: [330, 1000, 3300] }
```

#### `filtro-rl` — RL en alterna

Fuente senoidal, R y L en serie; v_L, v_R y la corriente frente al tiempo o a la frecuencia.

Piezas: `fuente` amplitud (valor de pico) de la fuente senoidal, V_p (V); `f` frecuencia de la fuente (Hz); `fase`? fase inicial de la fuente, φ (grados): v(t) = V_p·sen(2π·f·t + φ); `r` resistencia (Ω); `l` inductancia (H).

Curvas frente al tiempo (`mide` de una curva): `entrada` tensión de la fuente; `vl` tensión de la bobina (salida paso alto); `vr` tensión de la resistencia (salida paso bajo); `i` corriente.

En alterna (lectura a la frecuencia `f` en `mide`, o curva frente a la frecuencia): `vl_amp`/`vl_fase`/`vl_db`, `vr_amp`/`vr_fase`/`vr_db`, `i_amp`/`i_fase`/`i_db` (amplitud de pico, fase en grados con la de la fuente, dB).

```yaml
modelo:
  valores:
    V_p: { sim: "V_{p}", nombre: "amplitud de la fuente", unidad: V, valor: 1 }
    f_f: { sim: "f", nombre: "frecuencia de la fuente", unidad: Hz, valor: 1000 }
    R_g: { sim: "R", nombre: "resistencia", unidad: Ω, valor: 100 }
    L_g: { sim: "L", nombre: "inductancia", unidad: H, valor: 15.9e-3 }
  calculos:
    A_l: { expr: "V_p*x_l/sqrt(1 + x_l^2)", sim: "V_{L}", nombre: "amplitud en L", unidad: V }
    w_f: { expr: "2*pi*f_f", sim: "ω", nombre: "frecuencia angular", unidad: "rad/s" }
    x_l: { expr: "w_f*L_g/R_g", sim: "ωL/R", nombre: "ωL/R", unidad: "" }
tarjetas:
  - # … id, tipo, titulo, texto, libro
    widget:
      tipo: circuito
      esquema: filtro-rl
      piezas: { fuente: V_p, f: f_f, r: R_g, l: L_g }
      lectura: { valor: A_l, rotulo: "Amplitud en L" }
      mide: { vl_amp: A_l }
      grafica:
        x: { id: t, min: 0, max: 0.002, unidad: s, rotulo: "t" }
        y: { min: -1.2, max: 1.2, unidad: V, rotulo: "v" }
        curvas:
          - { expr: "A_l*sin(w_f*t + pi/2 - atan(x_l))", color: naranja, rotulo: "v_{L}", mide: vl }
          - { expr: "V_p/sqrt(1 + x_l^2)*sin(w_f*t - atan(x_l))", color: azul, rotulo: "v_{R}", mide: vr }
      mandos:
        - { valor: L_g, lista: [4.7e-3, 15.9e-3, 47e-3] }
```

#### `rlc-serie` — RLC en serie (resonancia)

Fuente senoidal, R, L y C en serie; corriente y tensiones frente al tiempo o a la frecuencia.

Piezas: `fuente` amplitud (valor de pico) de la fuente senoidal, V_p (V); `f` frecuencia de la fuente (Hz); `fase`? fase inicial de la fuente, φ (grados): v(t) = V_p·sen(2π·f·t + φ); `r` resistencia (Ω); `l` inductancia (H); `c` capacidad (F).

Curvas frente al tiempo (`mide` de una curva): `entrada` tensión de la fuente; `i` corriente; `vr` tensión de la resistencia; `vl` tensión de la bobina; `vc` tensión del condensador.

En alterna (lectura a la frecuencia `f` en `mide`, o curva frente a la frecuencia): `i_amp`/`i_fase`/`i_db`, `vr_amp`/`vr_fase`/`vr_db`, `vl_amp`/`vl_fase`/`vl_db`, `vc_amp`/`vc_fase`/`vc_db` (amplitud de pico, fase en grados con la de la fuente, dB).

```yaml
modelo:
  valores:
    V_p: { sim: "V_{p}", nombre: "amplitud de la fuente", unidad: V, valor: 1 }
    f_r: { sim: "f", nombre: "frecuencia de la fuente", unidad: Hz, valor: 4000 }
    R_r: { sim: "R", nombre: "resistencia", unidad: Ω, valor: 10 }
    L_r: { sim: "L", nombre: "inductancia", unidad: H, valor: 0.01 }
    C_r: { sim: "C", nombre: "capacidad", unidad: F, valor: 100e-9 }
    fijar: { f_r: 5032.92 }
  calculos:
    f_0: { expr: "1/(2*pi*sqrt(L_r*C_r))", sim: "f₀", nombre: "frecuencia de resonancia", unidad: Hz }
    I_0: { expr: "V_p/R_r", sim: "I_{máx}", nombre: "corriente en resonancia", unidad: A }
tarjetas:
  - # … id, tipo, titulo, texto, libro
    fijar: { f_r: 5032.92 }
    widget:
      tipo: circuito
      esquema: rlc-serie
      piezas: { fuente: V_p, f: f_r, r: R_r, l: L_r, c: C_r }
      lectura: { valor: f_0, rotulo: "Resonancia" }
      mide: { i_amp: I_0 }
      grafica:
        x: { id: nu, min: 1000, max: 25000, unidad: Hz, rotulo: "f", escala: log }
        y: { min: 0, max: 0.11, unidad: A, rotulo: "i" }
        curvas:
          - { expr: "V_p/sqrt(R_r^2 + (2*pi*nu*L_r - 1/(2*pi*nu*C_r))^2)", color: naranja, rotulo: "|i|", mide: i_amp }
        marcas:
          - { x: "f_0", y: "I_0", rotulo: "f₀" }
      mandos:
        - { valor: R_r, lista: [10, 30, 100] }
```

#### `rlc-paralelo` — Tanque LC en paralelo

Fuente senoidal con resistencia en serie sobre L ‖ C (‖ R); tensión del tanque y corrientes.

Piezas: `fuente` amplitud (valor de pico) de la fuente senoidal, V_p (V); `f` frecuencia de la fuente (Hz); `fase`? fase inicial de la fuente, φ (grados): v(t) = V_p·sen(2π·f·t + φ); `rs` resistencia en serie de la fuente (Ω); `l` inductancia del tanque (H); `c` capacidad del tanque (F); `r`? resistencia en paralelo del tanque, sus pérdidas (Ω).

Curvas frente al tiempo (`mide` de una curva): `entrada` tensión de la fuente; `vt` tensión del tanque; `i` corriente de la fuente.

En alterna (lectura a la frecuencia `f` en `mide`, o curva frente a la frecuencia): `vt_amp`/`vt_fase`/`vt_db`, `i_amp`/`i_fase`/`i_db`, `il_amp`/`il_fase`/`il_db` (amplitud de pico, fase en grados con la de la fuente, dB).

```yaml
modelo:
  valores:
    V_p: { sim: "V_{p}", nombre: "amplitud de la fuente", unidad: V, valor: 1 }
    f_p: { sim: "f", nombre: "frecuencia de la fuente", unidad: Hz, valor: 50000 }
    R_ps: { sim: "R_{s}", nombre: "resistencia en serie", unidad: Ω, valor: 1000 }
    L_p: { sim: "L", nombre: "inductancia", unidad: H, valor: 100e-6 }
    C_p: { sim: "C", nombre: "capacidad", unidad: F, valor: 100e-9 }
    R_pp: { sim: "R_{p}", nombre: "pérdidas del tanque", unidad: Ω, valor: 10000 }
  calculos:
    f_0p: { expr: "1/(2*pi*sqrt(L_p*C_p))", sim: "f₀", nombre: "frecuencia de resonancia", unidad: Hz }
    A_t: { expr: "V_p/sqrt(d_pr^2 + d_pi^2)", sim: "V_{t}", nombre: "amplitud del tanque", unidad: V }
tarjetas:
  - # … id, tipo, titulo, texto, libro
    widget:
      tipo: circuito
      esquema: rlc-paralelo
      piezas: { fuente: V_p, f: f_p, rs: R_ps, l: L_p, c: C_p, r: R_pp }
      lectura: { valor: f_0p, rotulo: "Resonancia" }
      mide: { vt_amp: A_t }
      grafica:
        x: { id: nu, min: 5000, max: 500000, unidad: Hz, rotulo: "f", escala: log }
        y: { min: 0, max: 1, unidad: V, rotulo: "v_{t}" }
        curvas:
          - { expr: "V_p/sqrt((1 + R_ps/R_pp)^2 + (R_ps*(2*pi*nu*C_p - 1/(2*pi*nu*L_p)))^2)", color: verde, rotulo: "|v_{t}|", mide: vt_amp }
      mandos:
        - { valor: R_pp, lista: [1000, 10000, 100000] }
```

#### `diodo` — Diodo con resistencia (punto de trabajo)

Fuente, resistencia y diodo en serie; corriente y tensión del diodo, con el modelo de caída constante o el de Shockley.

Piezas: `fuente` tensión de la fuente (V; negativa, polarización inversa); `r` resistencia en serie (Ω); `vd`? caída constante del diodo (V): el modelo de caída constante del libro; `is`? corriente de saturación I_S (A): el modelo de Shockley; `n`? factor de idealidad n (con «is»); `vt`? tensión térmica V_T (V; sin ella, 25,85 mV, la del libro a 300 K).

Mide (`mide`, continua): `corriente` corriente del diodo (de ánodo a cátodo); `vd` tensión del diodo (ánodo menos cátodo); `vr` tensión de la resistencia.

Aproximación del libro: `vd` ± 0,1 V (diodo de caída vd a 10 mA, n = 1: vd ± 0,1 V entre 0,2 mA y 500 mA).

```yaml
modelo:
  valores:
    V_d: { sim: "V", nombre: "tensión de la fuente", unidad: V, valor: 5 }
    R_d: { sim: "R", nombre: "resistencia", unidad: Ω, valor: 1000 }
    V_D: { sim: "V_{D}", nombre: "caída del diodo", unidad: V, valor: 0.7 }
    inicio: { V_d: 5 }
  calculos:
    I_dc: { expr: "max(0, (V_d - V_D)/R_d)", sim: "I_{D}", nombre: "corriente del diodo", unidad: A }
    V_dc: { expr: "V_d - I_dc*R_d", sim: "V_{D}", nombre: "tensión del diodo", unidad: V }
tarjetas:
  - # … id, tipo, titulo, texto, libro
    widget:
      tipo: circuito
      esquema: diodo
      piezas: { fuente: V_d, r: R_d, vd: V_D }
      lectura: { valor: I_dc, rotulo: "Corriente" }
      corriente: I_dc
      mide: { corriente: I_dc, vd: V_dc }
      mandos:
        - { valor: V_d, min: 1, max: 10, paso: 0.5 }
```

```yaml
modelo:
  valores:
    V_d: { sim: "V", nombre: "tensión de la fuente", unidad: V, valor: 5 }
    R_d: { sim: "R", nombre: "resistencia", unidad: Ω, valor: 1000 }
    I_S: { sim: "I_{S}", nombre: "corriente de saturación", unidad: A, valor: 1e-12 }
    n_d: { sim: "n", nombre: "factor de idealidad", unidad: "", valor: 1 }
    V_T: { sim: "V_{T}", nombre: "tensión térmica", unidad: V, valor: 0.02585 }
  calculos:
    V_ds: { expr: "V_d - I_ds*R_d", sim: "V_{D}", nombre: "tensión del diodo", unidad: V }
    I_ds: { expr: "n_d*V_T/R_d*wright(ln(I_S*R_d/(n_d*V_T)) + (V_d + I_S*R_d)/(n_d*V_T)) - I_S", sim: "I_{D}", nombre: "corriente del diodo", unidad: A }
tarjetas:
  - # … id, tipo, titulo, texto, libro
    widget:
      tipo: circuito
      esquema: diodo
      piezas: { fuente: V_d, r: R_d, is: I_S, n: n_d, vt: V_T }
      lectura: { valor: V_ds, rotulo: "Tensión del diodo" }
      corriente: I_ds
      mide: { corriente: I_ds, vd: V_ds }
      mandos:
        - { valor: V_d, min: -2, max: 10, paso: 0.5 }
        - { valor: R_d, lista: [100, 1000, 10000] }
```

#### `led` — LED con su resistencia

Fuente, resistencia en serie y LED; su corriente (el brillo) y su tensión.

Piezas: `fuente` tensión de la fuente (V); `r` resistencia en serie (Ω); `vf`? caída constante del LED (V): el modelo de caída constante del libro; `is`? corriente de saturación I_S (A): el modelo de Shockley; `n`? factor de idealidad n (con «is»); `vt`? tensión térmica V_T (V; sin ella, 25,85 mV, la del libro a 300 K).

Mide (`mide`, continua): `corriente` corriente del LED; `vf` tensión del LED; `vr` tensión de la resistencia.

Aproximación del libro: `vf` ± 0,2 V (LED de caída vf a 20 mA, n = 2: la dispersión de 1,8 a 2,2 V del libro).

```yaml
modelo:
  valores:
    V_e: { sim: "V", nombre: "tensión de la fuente", unidad: V, valor: 5 }
    R_e: { sim: "R", nombre: "resistencia del LED", unidad: Ω, valor: 150 }
    V_fe: { sim: "V_{f}", nombre: "tensión del LED", unidad: V, valor: 2 }
  calculos:
    I_e: { expr: "(V_e - V_fe)/R_e", sim: "I", nombre: "corriente del LED", unidad: A }
tarjetas:
  - # … id, tipo, titulo, texto, libro
    widget:
      tipo: circuito
      esquema: led
      piezas: { fuente: V_e, r: R_e, vf: V_fe }
      lectura: { valor: I_e, rotulo: "Corriente del LED" }
      corriente: I_e
      mide: { corriente: I_e, vf: V_fe }
      mandos:
        - { valor: R_e, serie: E24, min: 100, max: 1000, rotulo: "R (E24)" }
```

#### `zener` — Regulador Zener

Entrada, resistencia en serie, Zener en la salida y una carga; salida y corrientes.

Piezas: `fuente` tensión de entrada (V); `rs` resistencia en serie (Ω); `vz` tensión Zener V_Z (V); `rz`? resistencia dinámica r_z (Ω); `carga`? resistencia de carga (Ω); `interruptor`? conecta la carga (sin él, siempre conectada).

Mide (`mide`, continua): `salida` tensión de salida (la del Zener); `serie` corriente por la resistencia en serie; `iz` corriente del Zener (de cátodo a ánodo); `carga` corriente por la carga.

Aproximación del libro: `vz` ± 0,1 V (Zener de V_Z a 5 mA, n = 1: ± 0,1 V entre 0,1 mA y 250 mA).

```yaml
modelo:
  valores:
    V_zi: { sim: "V_{in}", nombre: "tensión de entrada", unidad: V, valor: 12 }
    R_zs: { sim: "R_{s}", nombre: "resistencia en serie", unidad: Ω, valor: 330 }
    V_z: { sim: "V_{Z}", nombre: "tensión Zener", unidad: V, valor: 5.1 }
    r_z: { sim: "r_{z}", nombre: "resistencia dinámica", unidad: Ω, valor: 7 }
    R_zl: { sim: "R_{L}", nombre: "carga", unidad: Ω, valor: 1000 }
    z_on: { tipo: interruptor, nombre: "carga conectada", valor: 1 }
  calculos:
    V_zo: { expr: "min(V_zd, V_zon)", sim: "V_{salida}", nombre: "tensión de salida", unidad: V }
    I_zz: { expr: "I_zs - I_zl", sim: "I_{Z}", nombre: "corriente del Zener", unidad: A }
    I_zs: { expr: "(V_zi - V_zo)/R_zs", sim: "I_{s}", nombre: "corriente por R_s", unidad: A }
    I_zl: { si: z_on, entonces: "V_zo/R_zl", sino: "0", sim: "I_{L}", nombre: "corriente de carga", unidad: A }
tarjetas:
  - # … id, tipo, titulo, texto, libro
    widget:
      tipo: circuito
      esquema: zener
      piezas: { fuente: V_zi, rs: R_zs, vz: V_z, rz: r_z, carga: R_zl, interruptor: z_on }
      lectura: { valor: V_zo, rotulo: "Salida" }
      datos:
        - { valor: I_zz, rotulo: "I_{Z} = {{I_zz}}" }
      corriente: I_zs
      mide: { salida: V_zo, serie: I_zs, iz: I_zz, carga: I_zl }
      mandos:
        - { valor: V_zi, min: 6, max: 15, paso: 1 }
        - { valor: z_on, tipo: interruptor, rotulo: "Carga" }
        - { valor: R_zl, lista: [470, 1000, 4700] }
```

#### `media-onda` — Rectificador de media onda

Entrada alterna, un diodo, condensador de filtro y carga opcionales; la salida frente al tiempo.

Piezas: `fuente` amplitud (pico) de la tensión alterna de entrada, V_p (V); `f` frecuencia de la red (Hz); `vd` caída de cada diodo cuando conduce (V): el modelo de caída constante; `c`? condensador de filtro (F); `carga`? resistencia de carga (Ω).

Curvas frente al tiempo (`mide` de una curva): `salida` tensión de salida, v_s(t); `entrada` tensión alterna de entrada; `id` corriente que entrega la entrada (la de los diodos que conducen).

Aproximación del libro: `vd` ± 0,2 V (diodos de caída vd a 10 mA, n = 1: + 0,17 V en los pulsos de 8 A del libro).

```yaml
modelo:
  valores:
    V_rp: { sim: "V_{p}", nombre: "pico de la entrada", unidad: V, valor: 16.97 }
    f_red: { sim: "f", nombre: "frecuencia de la red", unidad: Hz, valor: 50 }
    V_rd: { sim: "V_{D}", nombre: "caída de cada diodo", unidad: V, valor: 0.7 }
    C_rf: { sim: "C", nombre: "condensador de filtro", unidad: F, valor: 1000e-6 }
    R_rl: { sim: "R_{L}", nombre: "carga", unidad: Ω, valor: 100 }
  calculos:
    V_r1: { expr: "V_rp - V_rd", sim: "V_{pico}", nombre: "pico de la salida, media onda", unidad: V }
    T_red: { expr: "1/f_red", sim: "T", nombre: "periodo de la red", unidad: s }
    tau_r: { expr: "R_rl*C_rf", sim: "τ", nombre: "constante de descarga", unidad: s }
tarjetas:
  - # … id, tipo, titulo, texto, libro
    widget:
      tipo: circuito
      esquema: media-onda
      piezas: { fuente: V_rp, f: f_red, vd: V_rd, c: C_rf, carga: R_rl }
      lectura: { valor: V_r1, rotulo: "Pico de la salida" }
      grafica:
        x: { id: t, min: 0, max: 0.04, unidad: s, rotulo: "t" }
        y: { min: -18, max: 18, unidad: V, rotulo: "v" }
        curvas:
          - { expr: "V_rp*sin(2*pi*f_red*t)", color: tinta, rotulo: "entrada", mide: entrada, discontinua: true }
          - { expr: "max(V_rp*sin(2*pi*f_red*t) - V_rd, V_r1*exp(-(t - T_red/4 - T_red*floor((t - T_red/4)/T_red))/tau_r))", color: naranja, rotulo: "salida", mide: salida }
      mandos:
        - { valor: C_rf, lista: [470e-6, 1000e-6, 2200e-6] }
```

#### `puente` — Rectificador en puente

Entrada alterna, puente de cuatro diodos, condensador de filtro y carga opcionales; la salida frente al tiempo.

Piezas: `fuente` amplitud (pico) de la tensión alterna de entrada, V_p (V); `f` frecuencia de la red (Hz); `vd` caída de cada diodo cuando conduce (V): el modelo de caída constante; `c`? condensador de filtro (F); `carga`? resistencia de carga (Ω).

Curvas frente al tiempo (`mide` de una curva): `salida` tensión de salida, v_s(t); `entrada` tensión alterna de entrada; `id` corriente que entrega la entrada (la de los diodos que conducen).

Aproximación del libro: `vd` ± 0,2 V (diodos de caída vd a 10 mA, n = 1: + 0,17 V en los pulsos de 8 A del libro).

```yaml
modelo:
  valores:
    V_rp: { sim: "V_{p}", nombre: "pico de la entrada", unidad: V, valor: 16.97 }
    f_red: { sim: "f", nombre: "frecuencia de la red", unidad: Hz, valor: 50 }
    V_rd: { sim: "V_{D}", nombre: "caída de cada diodo", unidad: V, valor: 0.7 }
    C_rf: { sim: "C", nombre: "condensador de filtro", unidad: F, valor: 1000e-6 }
    R_rl: { sim: "R_{L}", nombre: "carga", unidad: Ω, valor: 100 }
  calculos:
    V_r2: { expr: "V_rp - 2*V_rd", sim: "V_{pico}", nombre: "pico de la salida, puente", unidad: V }
    T_red: { expr: "1/f_red", sim: "T", nombre: "periodo de la red", unidad: s }
    tau_r: { expr: "R_rl*C_rf", sim: "τ", nombre: "constante de descarga", unidad: s }
tarjetas:
  - # … id, tipo, titulo, texto, libro
    widget:
      tipo: circuito
      esquema: puente
      piezas: { fuente: V_rp, f: f_red, vd: V_rd, c: C_rf, carga: R_rl }
      lectura: { valor: V_r2, rotulo: "Pico de la salida" }
      grafica:
        x: { id: t, min: 0, max: 0.04, unidad: s, rotulo: "t" }
        y: { min: 0, max: 18, unidad: V, rotulo: "v" }
        curvas:
          - { expr: "max(V_rp*abs(sin(2*pi*f_red*t)) - 2*V_rd, V_r2*exp(-(t - T_red/4 - T_red/2*floor((t - T_red/4)/(T_red/2)))/tau_r))", color: naranja, rotulo: "salida", mide: salida }
      mandos:
        - { valor: C_rf, lista: [470e-6, 1000e-6, 2200e-6] }
```

#### `recortador` — Recortador con diodos

Entrada senoidal, resistencia en serie y, del nodo de salida a masa, las ramas que la limitan (sección 5.9). Ejemplo:
`cap05/sec-5.9`.

Piezas: `fuente` amplitud (pico) de la entrada, V_p (V); `f` frecuencia (Hz); `r` resistencia en serie (Ω); `vd` caída de cada diodo cuando conduce (V; con `zz`, la directa de cada Zener); `positivo`? interruptor de la rama de los picos positivos (diodo con el ánodo en la salida; sin él, conectada); `negativo`? interruptor de la rama de los picos negativos (diodo con el cátodo en la salida; sin él, conectada); `vref`? referencia de la rama positiva (V): recorta en V_ref + vd; `vz`? Zener en serie con el diodo de la rama positiva (V): recorta en V_Z + vd; `zz`? dos Zener de esa tensión en antiserie, en lugar de las ramas (V): recortan en ±(V_Z + vd).

Curvas frente al tiempo (`mide` de una curva): `salida` tensión de salida; `entrada` tensión de entrada; `i` corriente por la resistencia, de la entrada a la salida.

Aproximación del libro: `vd` ± 0,2 V (de vd − 0,14 V a vd entre 0,05 y 10 mA de recorte; cerca del umbral, un diodo real ya conduce algo); `vz` y `zz` ± 0,1 V. Use un eje `y` de al menos ± 5 V: donde el modelo dice «aún no recorta» (sensibilidad cero) solo queda el 1 % del eje. La corriente cerca del umbral de un Zener es la parte más blanda: en el catálogo, eje de ± 20 mA.

```yaml
modelo:
  valores:
    V_p: { sim: "V_{p}", nombre: "pico de la señal", unidad: V, valor: 8 }
    f_s: { sim: "f", nombre: "frecuencia de la señal", unidad: Hz, valor: 1000 }
    R_c: { sim: "R", nombre: "resistencia en serie", unidad: Ω, valor: 1000 }
    V_D: { sim: "V_{D}", nombre: "caída de cada diodo", unidad: V, valor: 0.7 }
    p_on: { tipo: interruptor, nombre: "rama de los picos positivos conectada", valor: 1 }
    n_on: { tipo: interruptor, nombre: "rama de los picos negativos conectada", valor: 1 }
  calculos:
    V_a: { si: p_on, entonces: "V_D", sino: "1000", sim: "V_{techo}", nombre: "recorte positivo", unidad: V }
    V_b: { si: n_on, entonces: "-V_D", sino: "-1000", sim: "V_{suelo}", nombre: "recorte negativo", unidad: V }
tarjetas:
  - # … id, tipo, titulo, texto, libro
    widget:
      tipo: circuito
      esquema: recortador
      piezas: { fuente: V_p, f: f_s, r: R_c, vd: V_D, positivo: p_on, negativo: n_on }
      grafica:
        x: { id: t, min: 0, max: 0.002, unidad: s, rotulo: "t" }
        y: { min: -10, max: 10, unidad: V, rotulo: "v" }
        curvas:
          - { expr: "V_p*sin(2*pi*f_s*t)", color: tinta, rotulo: "entrada", mide: entrada, discontinua: true }
          - { expr: "max(min(V_p*sin(2*pi*f_s*t), V_a), V_b)", color: naranja, rotulo: "salida", mide: salida }
      mandos:
        - { valor: p_on, tipo: interruptor, rotulo: "Diodo de los picos positivos" }
        - { valor: n_on, tipo: interruptor, rotulo: "Diodo de los picos negativos" }
```

Con referencia: `min(V_p*sin(…), V_ref + V_D)`; con Zener: `V_z + V_D`; con `zz`: `max(min(…, V_zz + V_D), -V_zz - V_D)`.

#### `fijador` — Fijador y doblador con diodos

Condensador en serie y diodo a masa (el fijador de la sección 5.9); con `c2`, un segundo diodo y un condensador que
guardan el pico: el doblador de Greinacher (sección 5.10, V_out = 2·V_p − 2·V_f). Sin carga: los condensadores
empiezan cargados a su régimen, así que las curvas son las de régimen desde t = 0. Ejemplos: `cap05/sec-5.9`,
`cap05/sec-5.10`.

Piezas: `fuente` amplitud (pico) de la entrada, V_p (V); `f` frecuencia (Hz); `c` condensador en serie (F); `vd` caída de cada diodo (V); `sube`? interruptor del sentido del diodo a masa: cerrado (o sin él), cátodo en el nodo, la señal sube y su mínimo queda en −vd; abierto, ánodo en el nodo, baja y su máximo queda en +vd; `c2`? condensador del detector de pico (F): el doblador (con `sube` abierto, el doblador negativo).

Curvas frente al tiempo (`mide` de una curva): `salida` la del nodo en el fijador, la del condensador del detector en el doblador; `nodo` la señal desplazada; `entrada` la de la fuente.

Aproximación del libro: `vd` ± 0,2 V.

```yaml
modelo:
  valores:
    V_p: { sim: "V_{p}", nombre: "pico de la señal", unidad: V, valor: 8 }
    f_s: { sim: "f", nombre: "frecuencia de la señal", unidad: Hz, valor: 1000 }
    C_c: { sim: "C", nombre: "condensador en serie", unidad: F, valor: 1e-5 }
    C_2: { sim: "C₂", nombre: "condensador del detector", unidad: F, valor: 1e-5 }
    V_D: { sim: "V_{D}", nombre: "caída de cada diodo", unidad: V, valor: 0.7 }
    s_on: { tipo: interruptor, nombre: "diodo con el cátodo en el nodo", valor: 1 }
  calculos:
    V_sh: { si: s_on, entonces: "V_p - V_D", sino: "V_D - V_p", sim: "ΔV", nombre: "desplazamiento", unidad: V }
    V_2: { si: s_on, entonces: "2*V_p - 2*V_D", sino: "2*V_D - 2*V_p", sim: "V_{salida}", nombre: "salida del doblador", unidad: V }
tarjetas:
  - # … el fijador
    widget:
      tipo: circuito
      esquema: fijador
      piezas: { fuente: V_p, f: f_s, c: C_c, vd: V_D, sube: s_on }
      grafica:
        x: { id: t, min: 0, max: 0.002, unidad: s, rotulo: "t" }
        y: { min: -18, max: 18, unidad: V, rotulo: "v" }
        curvas:
          - { expr: "V_p*sin(2*pi*f_s*t) + V_sh", color: naranja, rotulo: "salida", mide: salida }
      mandos:
        - { valor: s_on, tipo: interruptor, rotulo: "Cátodo del diodo en el nodo" }
  - # … el doblador: piezas con c2: C_2; curvas { expr: "V_2", mide: salida } y { expr: "V_p*sin(…) + V_sh", mide: nodo }
```

#### `bjt-interruptor` — Transistor como interruptor

NPN con R_C desde V_CC y R_B desde la tensión de mando; corte, activa o saturación.

Piezas: `vcc` alimentación del colector, V_CC (V); `rc` resistencia de colector o carga (Ω); `entrada` tensión de mando de la base (V; 0 = apagado); `rb` resistencia de base (Ω); `beta` ganancia de corriente β; `vbe` V_BE cuando conduce (V; el libro: 0,7 V); `vcesat`? V_CE de saturación (V; el libro: 0,2 V).

Mide (`mide`, continua): `ib` corriente de base; `ic` corriente de colector; `vce` tensión colector-emisor; `vbe` tensión base-emisor.

Aproximación del libro: `vbe` ± 0,1 V (transistor de V_BE = vbe a 1 mA: ± 0,1 V entre 20 µA y 50 mA); `vcesat` ± 0,2 V (V_CE(sat) real de 0,05 a 0,15 V con β forzada de 3 a 10).

```yaml
modelo:
  valores:
    V_cc: { sim: "V_{CC}", nombre: "alimentación", unidad: V, valor: 12 }
    R_bc: { sim: "R_{C}", nombre: "resistencia de colector", unidad: Ω, valor: 1000 }
    V_bi: { sim: "V_{in}", nombre: "tensión de mando", unidad: V, valor: 5 }
    R_bb: { sim: "R_{B}", nombre: "resistencia de base", unidad: Ω, valor: 100000 }
    beta: { sim: "β", nombre: "ganancia de corriente", unidad: "", valor: 100 }
    V_BE: { sim: "V_{BE}", nombre: "tensión base-emisor", unidad: V, valor: 0.7 }
    V_CEs: { sim: "V_{CE(sat)}", nombre: "tensión de saturación", unidad: V, valor: 0.2 }
  calculos:
    V_bce: { expr: "V_cc - I_bc*R_bc", sim: "V_{CE}", nombre: "tensión colector-emisor", unidad: V }
    I_bc: { expr: "min(beta*I_bb, (V_cc - V_CEs)/R_bc)", sim: "I_{C}", nombre: "corriente de colector", unidad: A }
    I_bb: { expr: "max(0, (V_bi - V_BE)/R_bb)", sim: "I_{B}", nombre: "corriente de base", unidad: A }
tarjetas:
  - # … id, tipo, titulo, texto, libro
    widget:
      tipo: circuito
      esquema: bjt-interruptor
      piezas: { vcc: V_cc, rc: R_bc, entrada: V_bi, rb: R_bb, beta: beta, vbe: V_BE, vcesat: V_CEs }
      lectura: { valor: V_bce, rotulo: "V_{CE}" }
      datos:
        - { valor: I_bc, rotulo: "I_{C} = {{I_bc}}" }
      corriente: I_bc
      mide: { ib: I_bb, ic: I_bc, vce: V_bce, vbe: V_BE }
      mandos:
        - { valor: R_bb, lista: [10000, 47000, 100000, 220000] }
```

#### `bjt-polarizacion` — Polarización por divisor con resistencia de emisor

NPN en emisor común: divisor R₁–R₂ en la base, R_C y R_E; el punto de trabajo.

Piezas: `vcc` alimentación, V_CC (V); `r1` resistencia de arriba del divisor (Ω); `r2` resistencia de abajo del divisor (Ω); `rc` resistencia de colector (Ω); `re` resistencia de emisor (Ω); `beta` ganancia de corriente β; `vbe` V_BE cuando conduce (V; el libro: 0,7 V).

Mide (`mide`, continua): `ib` corriente de base; `ic` corriente de colector; `vb` tensión de base; `ve` tensión de emisor; `vc` tensión de colector; `vce` tensión colector-emisor.

Aproximación del libro: `vbe` ± 0,1 V (transistor de V_BE = vbe a 1 mA: ± 0,1 V entre 20 µA y 50 mA).

```yaml
modelo:
  valores:
    V_cc: { sim: "V_{CC}", nombre: "alimentación", unidad: V, valor: 12 }
    R_p1: { sim: "R₁", nombre: "divisor, arriba", unidad: Ω, valor: 47000 }
    R_p2: { sim: "R₂", nombre: "divisor, abajo", unidad: Ω, valor: 10000 }
    R_pc: { sim: "R_{C}", nombre: "resistencia de colector", unidad: Ω, valor: 3300 }
    R_pe: { sim: "R_{E}", nombre: "resistencia de emisor", unidad: Ω, valor: 1000 }
    beta: { sim: "β", nombre: "ganancia de corriente", unidad: "", valor: 100 }
    V_BE: { sim: "V_{BE}", nombre: "tensión base-emisor", unidad: V, valor: 0.7 }
  calculos:
    I_pc: { expr: "beta*I_pb", sim: "I_{C}", nombre: "corriente de colector", unidad: A }
    V_pce: { expr: "V_pc - V_pe", sim: "V_{CE}", nombre: "tensión colector-emisor", unidad: V }
    I_pb: { expr: "(V_pth - V_BE)/(par(R_p1, R_p2) + (beta + 1)*R_pe)", sim: "I_{B}", nombre: "corriente de base", unidad: A }
    V_pb: { expr: "V_pe + V_BE", sim: "V_{B}", nombre: "tensión de base", unidad: V }
    V_pe: { expr: "(beta + 1)*I_pb*R_pe", sim: "V_{E}", nombre: "tensión de emisor", unidad: V }
    V_pc: { expr: "V_cc - I_pc*R_pc", sim: "V_{C}", nombre: "tensión de colector", unidad: V }
tarjetas:
  - # … id, tipo, titulo, texto, libro
    widget:
      tipo: circuito
      esquema: bjt-polarizacion
      piezas: { vcc: V_cc, r1: R_p1, r2: R_p2, rc: R_pc, re: R_pe, beta: beta, vbe: V_BE }
      lectura: { valor: I_pc, rotulo: "I_{C}" }
      datos:
        - { valor: V_pce, rotulo: "V_{CE} = {{V_pce}}" }
      corriente: I_pc
      mide: { ib: I_pb, ic: I_pc, vb: V_pb, ve: V_pe, vc: V_pc, vce: V_pce }
      mandos:
        - { valor: beta, lista: [50, 100, 200, 300] }
```

#### `espejo` — Espejo de corriente simple

Dos NPN con las bases unidas: Q₁ en diodo (colector y base juntos) con R_ref desde V_CC, Q₂ copia la corriente en una
carga desde V_CC; opcionalmente, un desapareamiento ΔV_BE (sección 6.11, problema 6.B). Ejemplo: `cap06/sec-6.11`.

Piezas: `vcc` alimentación (V); `rref` resistencia de referencia, de V_CC a Q₁ (Ω); `carga` de V_CC al colector de Q₂ (Ω); `beta` β de los dos; `vbe` V_BE cuando conduce (V; el libro: 0,7 V); `dvbe`? V_BE de más que recibe Q₂ (V; sin ella, idénticos).

Mide (`mide`, continua): `iref` corriente de referencia; `iout` corriente copiada (por la carga); `vout` tensión de colector de Q₂; `vbe` V_BE de Q₁.

Sin efecto Early (la copia no depende de la carga mientras Q₂ no sature). El simulador va a la temperatura de V_T =
25,85 mV, así que e^(ΔV/V_T) es exacta.

```yaml
modelo:
  valores:
    V_ec: { sim: "V_{CC}", nombre: "alimentación", unidad: V, valor: 12 }
    R_er: { sim: "R_{ref}", nombre: "resistencia de referencia", unidad: Ω, valor: 11300 }
    R_el: { sim: "R_{L}", nombre: "carga", unidad: Ω, valor: 4700 }
    beta: { sim: "β", nombre: "ganancia de corriente", unidad: "", valor: 100 }
    V_BE: { sim: "V_{BE}", nombre: "tensión base-emisor", unidad: V, valor: 0.7 }
    dV_e: { sim: "ΔV_{BE}", nombre: "desapareamiento", unidad: V, valor: 0.001 }
    V_Te: { sim: "V_{T}", nombre: "tensión térmica", unidad: V, valor: 0.02585 }
  calculos:
    I_er: { expr: "(V_ec - V_BE)/R_er", sim: "I_{ref}", nombre: "corriente de referencia", unidad: A }
    I_ec1: { expr: "I_er/(1 + (1 + exp(dV_e/V_Te))/beta)", sim: "I_{C1}", nombre: "corriente de Q₁", unidad: A }
    I_eo: { expr: "I_ec1*exp(dV_e/V_Te)", sim: "I_{salida}", nombre: "corriente copiada", unidad: A }
    V_eo: { expr: "V_ec - I_eo*R_el", sim: "V_{C2}", nombre: "tensión de colector de Q₂", unidad: V }
tarjetas:
  - # … id, tipo, titulo, texto, libro
    widget:
      tipo: circuito
      esquema: espejo
      piezas: { vcc: V_ec, rref: R_er, carga: R_el, beta: beta, vbe: V_BE, dvbe: dV_e }
      lectura: { valor: I_eo, rotulo: "Corriente copiada" }
      corriente: I_er
      mide: { iref: I_er, iout: I_eo, vout: V_eo, vbe: V_BE }
      mandos:
        - { valor: dV_e, lista: [0, 0.001, 0.005] }
```

### 5.5 Si hace falta otro esquema

No lo improvise con uno parecido que dibuje otra cosa: haga uno nuevo para ese circuito (el de la figura o el ejemplo
del libro que lo pide). Un esquema es **una carpeta**
`web/src/lib/leccion11/esquemas/<nombre>/` con `esquema.ts` (su definición: piezas, medidas, netlist, aproximaciones
no lineales, descripción para el lector de pantalla; tipos en `esquemas/tipos.ts`) y `Dibujo.svelte` (el dibujo, con
las piezas de `esquemas/kit/`). Nada más: la app y el generador encuentran las carpetas solos (`import.meta.glob` y
`scripts/esquemas11.mjs`), así que dos esquemas nuevos nunca tocan el mismo fichero. Añada una tarjeta suya a la
lección de catálogo de las pruebas (la prueba de navegador exige que cada esquema tenga la suya).

## 6. Números: libro o modelo

Cada número escrito en una tarjeta (título, texto, nota, opciones, explicaciones, pistas, ideas, rótulos) debe:

1. estar en el texto de **algún bloque citado** en `libro` (también tablas, listas, ejercicios y su solución), o
2. ser lo que da el modelo en un `comprobar` **de esa tarjeta** (o un valor de su `fijar`/`inicio`).

```yaml
comprobar:
  - { V_out: 4.0, V_1: 8.0 }                     # con los valores de la tarjeta
  - { con: { R_2: 10000 }, V_out: 6.0 }          # con otros valores (lo que diría una opción incorrecta)
  - { con: { R_2: 2000 }, V_out: 3.333, tol: 0.001 }   # tol relativa (0,5 % por defecto)
```

Cada `comprobar` se evalúa: si el modelo no da ese valor, falla. Un número escrito «3,33» casa con 3,333 (redondeo a
sus decimales) y con prefijos («33,3 kΩ» casa con 33333). Los valores vivos `{{…}}` no se comprueban (los calcula la
app). Esto no sustituye su revisión: compruebe también que cada afirmación dice lo mismo que el libro.

## 7. Lo que comprueba el generador

- Forma: claves conocidas (una errata da error), tipos, `id` únicos, el resumen al final y una sola vez, al menos una
  tarjeta `explorar` y algo que responder.
- ≤ 40 palabras por tarjeta (título + texto + nota); ≤ 20 por opción, paso o pareja; ≤ 40 por explicación, pista,
  ayuda, éxito o idea; ≤ 14 por rótulo de condición.
- Cada opción con su `porque`; exactamente una correcta; sin opciones repetidas.
- Cada valor vivo, mando, lectura, barra, dato, condición, pista, asa, curva y expresión se refiere a algo del modelo;
  un mando mueve un valor (no un cálculo) y no uno fijado; `requiere` se refiere a mandos de la tarjeta; sin ciclos.
- Números del libro o del modelo; cada `comprobar` se cumple.
- Bloques del libro que existen, de la sección (o «parte#n»), con su cita literal; cada tarjeta cita alguno.
- Retos alcanzables, sin empezar resueltos y con pista para cada fallo; estimaciones con el objetivo en el deslizador,
  alcanzable y no acertadas al empezar; curvas que dan números en todo el eje.
- Circuitos: el modelo frente al ngspice de la app en continua, en alterna y en el tiempo (§5.3), en el estado
  inicial, en los extremos de cada mando y en cada `comprobar`.

## 8. Antes de dar una lección por terminada

1. `node scripts/lecciones11.mjs --solo <parte>/<label>` sin errores ni avisos.
2. Léala entera en la app (`npm run dev` o su compilación): `#/leccion/<parte>/<label>`, tarjeta a tarjeta, en el
   teléfono (360 px) y en oscuro. La lección 1.0 sigue en `#/leccion/<parte>/<label>/clasica`.
3. Pruébela: cada opción incorrecta (¿se entiende el porqué?), el reto fallando por cada lado y acertando, la
   estimación pasada y corta, todo con el teclado (Tab, flechas, Intro, 1–5).
4. Contraste con el libro: cada tarjeta frente a sus bloques citados (botón «Del libro» de la tarjeta).
5. Pruebas: `EPA_SIN_SERVIDOR=1 PLAYWRIGHT_BROWSERS_PATH=… npx playwright test -c playwright.lecciones11.config.ts
   tests/lecciones11-unidad.spec.ts` (comprueba, entre otras cosas, que la salida publicada está al día con las
   fuentes: vuelva a generar si falla «al día»). Las de navegador de las dos lecciones de referencia:
   `tests/lecciones11-navegador.spec.ts` (carpeta de compilación y puerto los de la configuración; `EPA_DIST` y
   `EPA_PUERTO` los cambian).
6. No cambie el `id` de una tarjeta publicada ni borre lecciones: las respuestas guardadas cuelgan de ellos.

## 9. Lo que la app hace sola (no lo escriba)

Barra de progreso por tarjetas, etiqueta «3 de 12 · Fase», botones (Comprobar, Volver a intentarlo, Continuar,
Saltar tras dos fallos), avisos «Eso es.» / «Por qué no.» / «Todavía no.» / «¡Conseguido!», XP (una vez por tarjeta;
nada si la ronda se cerró con dos fallos), dominio de la sección, objetivo diario, el repaso espaciado, «Del libro»,
el enlace a la lección 1.0, el aviso al salir a medias, lectores de pantalla y movimiento reducido.

**Práctica inteligente y repaso de la sección.** Las tarjetas `predecir`, `pregunta` (opciones, estimar, ordenar,
emparejar) y `reto` de su lección son también ejercicios de «Práctica inteligente» y del repaso espaciado de la
sección (`#/practicar/<parte>/<sección>`), sueltas: con su widget, sus explicaciones y pistas, en el estado que
comprueba el generador (los valores del modelo con los `inicio` de las tarjetas hasta ella, y su `fijar`). Así que
cada una debe entenderse sola: que su título y su texto digan qué se pregunta sin «como acaba de ver» ni depender de
lo que el lector movió antes (si depende, `fijar` lo que haga falta). Las `porque` no salen sueltas (preguntan por la
sorpresa anterior). Se guardan con el mismo `id` que en la lección: XP una sola vez por tarjeta, la responda donde la
responda, y el mismo dominio. Por eso, otra razón para **no cambiar los `id`** una vez publicada la lección.
