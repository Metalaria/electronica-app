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
- Expresiones: el lenguaje de las calculadoras (`+ - * / ^`, `sqrt exp ln log10 log2 sin cos tan asin acos atan
  atan2 sinh cosh tanh abs floor ceil round min max`, `par(a, b, …)` = paralelo, `wright(x)` = ω de Wright, para un
  diodo de Shockley (§5.3), `pi`). No hay `?:`: para elegir use `si / entonces / sino` con un interruptor.
  Los ángulos de `sin`/`cos` van en radianes (`phi*pi/180`); `asin`/`acos` los dan en radianes (`asin(x)*180/pi`).
- 1.2 (motor12e): `erfc(x)` y `erf(x)` (la función de error, exacta también en las colas: la BER de BPSK,
  Q(√(2·E_b/N₀)) = `0.5*erfc(sqrt(EbN0))`), y `ruido(x, semilla)`: un ruido pseudoaleatorio **con semilla**, normal de
  media 0 y desviación 1, distinto para cada x y siempre el mismo (en el generador y en cada dispositivo). Es ruido
  blanco a lo largo de cualquier eje: `0.1*ruido(t, 7)` son 0,1 V eficaces sobre una señal; `x0 + s*ruido(n, 3)`, una
  secuencia con ruido (tarjeta `explore-palitos` del catálogo de motor12e,
  `web/tests/lecciones12-catalogo/cap01/sec-1.12.yaml`). Cambie la semilla para otro ruido.
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
| `predecir` | apostar antes de ver | `opciones`; `widget` con `ocultar: true` (las lecturas salen «¿?» hasta acertar o saltar la tarjeta: un fallo no las enseña), o `ocultar: curvas` (también las curvas y marcas de la gráfica: §5.2) |
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

Una ecuación que está **dentro** de otro bloque (las «tarjetas» de repaso que juntan las expresiones clave de una
sección, una caja) se cita con el bloque y su número de orden entre las ecuaciones de dentro, **entre comillas**:
`ec: "cap53#338.1"` es la primera ecuación del bloque 338 (en la lista `libro` va el bloque, `"cap53#338"`, con una
cita de su texto). 1.2 (motor12e; tarjeta `formula-cuadro` del catálogo de motor12e).

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
    - { valor: R_2, serie: E24, min: 1000, max: 10000, rotulo: "R₂ (E24)" }   # selector E12/E24 (o E6, 1.2: los electrolíticos al ± 20 %)
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
nombres pueden llevar cifras («Sn63Pb37», «0805»; 1.2) pero no ser su propio valor (ya va entre paréntesis), no se repiten y tienen como mucho 24 caracteres; solo
valen con `lista`. En una lista entre corchetes, un nombre con coma decimal se parte en dos (`[2 m de 0,5 mm², …]` son
tres textos): póngalo entre comillas (`["2 m de 0,5 mm²", …]`); el error lo dice (1.2). Ejemplo probado (tarjeta `codigo-colores` de la lección de catálogo):

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
- Las marcas son expresiones del modelo (como las asas): defina en `calculos` dónde están (`tau_c`, `v_tau`, `f_c`),
  o escríbalas en la propia marca: el 90 % de una carga es `{ x: "-tau_c*ln(1 - 0.9)", y: "v0 + 0.9*(V - v0)",
  rotulo: "90 %" }` (tarjeta `carga-rc-marca`).
- `muestras` en el eje `x` (1.2, esquemas12c): los puntos con que se dibujan las curvas, de 2 a 4000 (sin él, 240). Una
  portadora de 100 kHz modulada a 1 kHz en 2 ms son 200 ciclos: `muestras: 4000` (tarjeta `grafica-portadora`).
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

**Curvas paramétricas, palitos, misma escala y curvas ocultas (1.2, motor12e).** Ejemplos probados en el catálogo de
motor12e (`web/tests/lecciones12-catalogo/cap01/sec-1.12.yaml`, tarjetas `explore-lissajous`, `explore-palitos`,
`explore-erfc` y `prediga-curva`):

```yaml
widget:
  tipo: grafica
  aspecto: igual                               # la misma longitud por unidad en x y en y (un círculo sale redondo)
  x: { id: u, min: -1.2, max: 1.2, unidad: V, rotulo: "x" }
  y: { min: -1.2, max: 1.2, unidad: V, rotulo: "y" }
  curvas:
    # paramétrica: x(th) e y(th) de un parámetro que no es el eje; min y max, números o expresiones («2*pi»)
    - { param: { id: th, min: 0, max: "2*pi" }, x: "cos(th)", y: "cos(th - phi*pi/180)", rotulo: "x frente a y" }
    - { param: { id: th, min: 0, max: "2*pi", muestras: 120 }, x: "cos(th)", y: "sin(th)", color: tinta, discontinua: true, rotulo: "círculo unidad" }
```

- **Paramétrica** (`param` con `x` e `y`): el diagrama de Nyquist (Re G(jω) e Im G(jω) escritas con ω como parámetro: para K/(1 + jωτ),
  `x: "K/(1 + (w*tau)^2)"`, `y: "-K*w*tau/(1 + (w*tau)^2)"`),
  las ramas del lugar de las raíces (el parámetro es la ganancia), el círculo unidad del plano z, la figura XY de I y Q,
  los círculos de la carta de Smith. `param.muestras` (2–4000; 240 por defecto) son los puntos de la curva. Lo que se
  sale de los ejes no se dibuja; el generador exige números en todo el recorrido del parámetro y algo de la curva
  dentro de los ejes. Una curva paramétrica no lleva `mide` ni `palitos`.
- **`aspecto: igual`** (en `grafica` o en la gráfica de un circuito): los dos ejes lineales y con la misma unidad; el
  eje con menos unidades por píxel se ensancha alrededor de su centro (no se recorta nada).
- **Palitos** (`palitos: true`, y `paso` si no es 1): una secuencia x[n], h[n], y[n] dibujada como en el libro, un
  palito con su punto en cada x = k·paso del eje (como mucho 400), desde y = 0. Eje x lineal; sin `discontinua`.
  Con `ruido(n, semilla)` (§3.2) se ve una secuencia con ruido:
  `- { expr: "a^n + s*ruido(n, 3)", palitos: true, color: naranja, rotulo: "con ruido" }`.
- **`ocultar: curvas`** en una predicción: además de las lecturas, **las curvas y las marcas** no se dibujan hasta
  responder (en su lugar, «¿? La curva sale al responder» y la leyenda con «(¿?)»); al responder salen. Ya no hace falta
  recortar el eje para no dar la respuesta. Para ocultar solo una curva (o una marca) y dejar las de referencia (la
  entrada, una asíntota), `ocultar: true` en el widget y `oculta: true` en esa curva o marca.
- **Marcas de los ejes**: llevan las cifras que hagan falta para que dos vecinas no se lean igual (de 99,8 a 100,4 mV:
  «99,8 mV», «99,9 mV», «100 mV», «100,1 mV»…, no «100 mV» en todas); un eje corriente sigue con dos cifras.

### 5.3 Cómo se comprueba con el simulador

El generador simula el circuito dibujado con los valores del modelo en el **estado inicial de la tarjeta, en los dos
extremos de cada mando y en cada `comprobar` con `con`**, y compara:

| Qué | Análisis | Tolerancia |
|---|---|---|
| Una lectura de `mide` en continua | `.op` | 0,1 % |
| Una lectura en alterna (`…_amp`, `…_fase`, `…_db`) a la frecuencia de la pieza `f` | `.ac` en un punto | 0,1 %; fase 0,1°; 0,01 dB |
| Una curva frente al tiempo | `.tran` (paso = eje/1000) | 1 % de la altura del eje `y` |
| Una curva frente a la frecuencia | `.ac` (40 puntos por década) | 0,1 % (+ 0,01 % del eje); fase 0,1°; 0,01 dB |

Una lectura de fase da la vuelta como una curva (1.2): 184,6° y −175,4° son la misma fase.

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
  (1.2, esquemas12c; sección 11.6) Cómo se dibuja la unión de la carga: `union`? (interruptor: la carga cuelga de un
  cruce con el hilo de salida; cerrado, con punto de unión y conectada; abierto, cruce sin punto, no conectada) o
  `etiqueta`? (interruptor: la carga va aparte, unida por una **etiqueta de red** con el nombre que es el `sim` de su
  valor; cerrado, conectada; abierto, la etiqueta de la carga lleva el `sim` de `etiqueta2`?, la mal escrita, y no
  conecta). Un toque en el cruce o en la etiqueta la cambia. Tarjetas `divisor-union` y `divisor-etiqueta`:
  `et_dr: { tipo: interruptor, sim: "SALIDA", … }`, `et2_dr: { sim: "SALDA", … }`.
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

**La impedancia (1.2):** `z_amp`, `z_fase` y `z_db` miden Z = R + j(ωL − 1/(ωC)) (en ohmios: la tensión que da 1 A en
una copia de las tres piezas, que no toca el circuito). Un condensador de desacoplo con su ESR y su ESL (sección 41.8,
pedido para `cap42`): `r` la ESR, `l` la ESL, y un eje `y` logarítmico (tarjeta `rlc-impedancia` de la lección de
catálogo):

```yaml
      esquema: rlc-serie
      piezas: { fuente: Vp_z, f: f_z, r: R_z, l: L_z, c: C_z }
      grafica:
        x: { id: nu, min: 1000, max: 1000000000, unidad: Hz, rotulo: "f", escala: log }
        y: { min: 0.01, max: 10000, unidad: Ω, rotulo: "|Z|", escala: log }
        curvas:
          - { expr: "sqrt(R_z^2 + (2*pi*nu*L_z - 1/(2*pi*nu*C_z))^2)", color: naranja, rotulo: "|Z|", mide: z_amp }
      mandos:
        - { valor: L_z, lista: [0.5e-9, 1e-9, 2e-9] }
```

Con un eje `y` logarítmico, la tolerancia de una curva en alterna es el 0,1 % del valor más el 0,01 % del fondo del eje
(no de su altura).

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

`reves`? (1.2, esquemas12c; secciones 11.2, 12.6): interruptor, el LED montado al revés: se dibuja girado, no luce y
bloquea (el modelo: corriente 0 y toda la tensión en el LED); un toque en él lo gira. Vale igual en `diodo`. Tarjetas
`led-reves` y `diodo-reves` (`I = (1 - rev)*max(0, (V - V_F)/R)`).

`etiqueta`? y `etiqueta2`? (1.2, esquemas12d; secciones 11.9, 12.5): la alimentación del LED por etiquetas de red, como en
`divisor` (§5.4 quater).

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

(1.2, esquemas12c) `vf`? un LED en el colector, en serie con R_C (su caída constante, como `led`: ± 0,2 V de 0,4 mA a
1 A; luce con la `corriente` del widget), y entonces mide además `vled`; en corte el LED casi no conduce y cae mucho
menos que V_F: lea las corrientes (sección 22.8, Práctica 8). `iref`? la corriente de colector a la que V_BE vale `vbe`
(sin ella, 1 mA): la banda de ± 0,1 V va de iref/50 a 50·iref, así que un interruptor de potencia (sección 26.3: 0,5 A
con 20 a 40 mA de base, `iref: 0.5`) o una base con R_B = 1 MΩ (unos µA: `iref: 0.0001`) se simulan vivos. Tarjetas
`bjt-interruptor-led` y `bjt-interruptor-potencia`.

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

#### `fuente-controlada` — Fuente controlada por tensión (VCCS o VCVS) con carga (1.2)

Una tensión de control v (el puerto de entrada, a la izquierda) manda una fuente dependiente, dibujada como un rombo:
con `gm`, una fuente de corriente g_m·v con r_o en paralelo (la forma Norton: el transistor en pequeña señal, sección
22.11); con `av`, una fuente de tensión A_v·v con r_o en serie (la forma Thévenin: el amplificador de tensión). Una
carga en los bornes, que conecta un interruptor. El signo es el dibujado: la corriente (o el borne +) hacia la salida,
así que v_o = +g_m·v·(r_o ∥ R_L); para una etapa inversora escriba el signo menos en el modelo y una v negativa.
(1.2, esquemas12c; secciones 43.3, 43.4, 43.6) O `invierte`? (interruptor): el rombo girado, la flecha hacia masa (o el
borne + abajo), y la salida con su signo: v_o = −g_m·v·(r_o ∥ R_L), el emisor común; `controlada` lee entonces la
corriente negativa. Tarjeta `fuente-controlada-invertida`: `I_fi = (1 - 2*inv_fi)*gm_fi*v_fi`.

Piezas: `control` tensión de control, v (V); `gm`? transconductancia, g_m (S): VCCS; `av`? ganancia, A_v (V/V): VCVS
(una de las dos, nunca las dos); `ro` resistencia de salida (Ω; obligatoria con `gm`, opcional con `av`); `carga` (Ω);
`interruptor`? conecta la carga.

Mide (`mide`, continua): `salida` tensión de salida (en los bornes); `carga` corriente por la carga; `controlada`
corriente que entrega la fuente controlada; `ro` corriente por r_o (con `gm`, la que baja por ella; con `av`, la de la
carga). Pedido para `cap23/sec-23.11`.

```yaml
modelo:
  valores:
    v_c: { sim: "v", nombre: "tensión de control", unidad: V, valor: 0.01 }
    g_m: { sim: "g_{m}", nombre: "transconductancia", unidad: S, valor: 0.04 }
    r_o: { sim: "r_{o}", nombre: "resistencia de salida", unidad: Ω, valor: 100000 }
    R_C: { sim: "R_{C}", nombre: "carga", unidad: Ω, valor: 4700 }
    c_on: { tipo: interruptor, nombre: "carga conectada", valor: 1 }
  calculos:
    I_g: { expr: "g_m*v_c", sim: "g_{m} · v", nombre: "corriente controlada", unidad: A }
    V_o: { si: c_on, entonces: "I_g*par(r_o, R_C)", sino: "I_g*r_o", sim: "v_{o}", nombre: "tensión de salida", unidad: V }
    I_L: { si: c_on, entonces: "V_o/R_C", sino: "0", sim: "I_{L}", nombre: "corriente por la carga", unidad: A }
    I_ro: { expr: "V_o/r_o", sim: "I_{ro}", nombre: "corriente por r_o", unidad: A }
tarjetas:
  - # … id, tipo, titulo, texto, libro
    widget:
      tipo: circuito
      esquema: fuente-controlada
      piezas: { control: v_c, gm: g_m, ro: r_o, carga: R_C, interruptor: c_on }
      lectura: { valor: V_o, rotulo: "Tensión de salida" }
      corriente: I_L
      mide: { salida: V_o, carga: I_L, controlada: I_g, ro: I_ro }
      mandos:
        - { valor: v_c, min: 0, max: 0.02, paso: 0.002, rotulo: "Tensión de control, v" }
```

Con `av` (VCVS): `piezas: { control: v_c, av: A_v, ro: r_s, carga: R_C, interruptor: c_on }`, con
`I_L = A_v·v_c/(r_s + R_C)` (0 en vacío) y `V_o = A_v·v_c − I_L·r_s`; `mide: { salida: V_o, carga: I_L, controlada: I_L }`.

#### `fuente-corriente-y-tension` — La figura 22.9: fuente de tensión, resistencia y fuente de corriente (1.2)

El circuito de partida de la figura 22.9 (sección 22.8, transformación de fuentes): una fuente de tensión con su
resistencia en serie, una resistencia y una fuente de corriente, las tres entre los mismos dos terminales; carga
opcional con su interruptor. El dibujo es siempre el circuito de partida: la cadena de transformaciones (3 A ∥ 4 Ω,
5 A ∥ 1,71 Ω, 8,57 V con 1,71 Ω) la cuentan el modelo y las tarjetas, o los esquemas `norton` y `thevenin` paso a paso.

Piezas: `fuente` tensión de la fuente (V); `rs` resistencia en serie con ella (Ω); `rp` resistencia entre los
terminales (Ω); `corriente` corriente de la fuente de corriente, hacia el terminal de arriba (A); `carga`? (Ω);
`interruptor`? conecta la carga (solo con `carga`).

Mide (`mide`, continua): `salida` tensión entre los terminales; `rama` corriente que la rama de la fuente de tensión
lleva al terminal; `paralelo` corriente por `rp`; `fuentei` corriente de la fuente de corriente; `carga` corriente por
la carga (con `carga`). Pedido para `cap23/sec-23.8`.

```yaml
modelo:
  valores:
    V_f: { sim: "V", nombre: "tensión de la fuente", unidad: V, valor: 12 }
    R_f1: { sim: "R₁", nombre: "resistencia en serie", unidad: Ω, valor: 4 }
    R_f2: { sim: "R₂", nombre: "resistencia entre los terminales", unidad: Ω, valor: 3 }
    I_f: { sim: "I", nombre: "corriente de la fuente de corriente", unidad: A, valor: 2 }
  calculos:
    V_fa: { expr: "(V_f/R_f1 + I_f)/(1/R_f1 + 1/R_f2)", sim: "V", nombre: "tensión entre los terminales", unidad: V }
    I_f1: { expr: "(V_f - V_fa)/R_f1", sim: "I₁", nombre: "corriente de la rama de 12 V", unidad: A }
    I_f2: { expr: "V_fa/R_f2", sim: "I₂", nombre: "corriente por R₂", unidad: A }
tarjetas:
  - # … id, tipo, titulo, texto, libro
    widget:
      tipo: circuito
      esquema: fuente-corriente-y-tension
      piezas: { fuente: V_f, rs: R_f1, rp: R_f2, corriente: I_f }
      lectura: { valor: V_fa, rotulo: "Tensión entre los terminales" }
      corriente: I_f1
      mide: { salida: V_fa, rama: I_f1, paralelo: I_f2, fuentei: I_f }
      mandos:
        - { valor: I_f, lista: [0, 2, 4] }
```

#### `sallen-key` — Filtro activo Sallen-Key paso bajo de ganancia unidad (1.2)

Fuente senoidal; R₁ y R₂ en serie hasta la entrada +; C₁ de su unión a la salida (la realimentación positiva que crea
el Q, sección 24.5) y C₂ de la entrada + a masa; el operacional como seguidor. Ideal,
H = 1/(1 + s·C₂·(R₁ + R₂) + s²·R₁·R₂·C₁·C₂); con R₁ = R₂ = R, f₀ = 1/(2π·R·√(C₁·C₂)) y Q = ½·√(C₁/C₂). En alterna (frente a
la frecuencia o, a la frecuencia `f` de la fuente, una lectura) o en el tiempo (desde el régimen permanente en t = 0).

Piezas: `fuente` amplitud de pico (V); `f` frecuencia de la fuente (Hz); `fase`? fase inicial (°); `r1` desde la
fuente (Ω); `r2` hacia la entrada + (Ω); `c1` de la unión a la salida (F); `c2` de la entrada + a masa (F); `gbw`?
producto ganancia-ancho de banda del operacional (Hz; sin él, ideal); `rsal`? su resistencia de salida en lazo abierto
(Ω; sin ella, 0).

Mide: `entrada`, `salida` (transitorio); `salida_amp`, `salida_fase` (grados, la de la fuente incluida), `salida_db`
(alterna). Pedido para `cap25/sec-25.5`.

```yaml
modelo:
  valores:
    V_p: { sim: "V_{p}", nombre: "amplitud de la fuente", unidad: V, valor: 1 }
    f_s: { sim: "f", nombre: "frecuencia de la fuente", unidad: Hz, valor: 1000 }
    R_1: { sim: "R₁", nombre: "resistencia desde la fuente", unidad: Ω, valor: 11000 }
    R_2: { sim: "R₂", nombre: "resistencia hacia la entrada +", unidad: Ω, valor: 11000 }
    C_1: { sim: "C₁", nombre: "condensador a la salida", unidad: F, valor: 22e-9 }
    C_2: { sim: "C₂", nombre: "condensador a masa", unidad: F, valor: 10e-9 }
  calculos:
    f_0: { expr: "1/(2*pi*sqrt(R_1*R_2*C_1*C_2))", sim: "f_{0}", nombre: "frecuencia propia", unidad: Hz }
tarjetas:
  - # … id, tipo, titulo, texto, libro
    widget:
      tipo: circuito
      esquema: sallen-key
      piezas: { fuente: V_p, f: f_s, r1: R_1, r2: R_2, c1: C_1, c2: C_2 }
      lectura: { valor: f_0, rotulo: "Frecuencia propia" }
      grafica:
        x: { id: nu, min: 10, max: 100000, unidad: Hz, rotulo: "f", escala: log }
        y: { min: 0, max: 1.5, unidad: V, rotulo: "amplitud" }
        curvas:
          - { expr: "V_p/sqrt((1 - (2*pi*nu)^2*R_1*R_2*C_1*C_2)^2 + (2*pi*nu*C_2*(R_1 + R_2))^2)", color: naranja, rotulo: "v_{o}", mide: salida_amp }
      mandos:
        - { valor: C_1, lista: [10e-9, 22e-9, 47e-9] }
```

**El operacional real** (lo que deja pasar muy por encima del corte, bloque 147 de `cap25`): con `gbw` el operacional
tiene un polo, A(s) = A₀/(1 + s/ω_p) con A₀ = 10⁵ y ω_p = 2π·GBW/A₀, y con `rsal` esa resistencia en serie con su
salida. Entonces H = N(s)/D(s), con R_o = `rsal`:

- n₀ = A₀·ω_p; n₁ = C₁·R_o·ω_p; n₂ = C₁·R_o·(1 + C₂·R₂·ω_p); n₃ = C₁·C₂·R₂·R_o;
- d₀ = (A₀ + 1)·ω_p; d₁ = 1 + ω_p·((A₀ + 1)·C₂·(R₁ + R₂) + C₁·(R₁ + R_o));
  d₂ = C₁·(R₁ + R_o) + C₂·(R₁ + R₂) + ω_p·C₁·C₂·((A₀ + 1)·R₁·R₂ + R_o·(R₁ + R₂)); d₃ = C₁·C₂·(R₁·R₂ + R_o·(R₁ + R₂));

y |H(jω)| = √((n₀ − n₂ω²)² + (n₁ω − n₃ω³)²) / √((d₀ − d₂ω²)² + (d₁ω − d₃ω³)²). Muy por encima del corte tiende a
n₃/d₃ ≈ R_o/R₁: el suelo de la atenuación. Escriba los coeficientes como `calculos` (A₀ = 100000) y la curva con ellos;
la tarjeta `sallen-key-real` de la lección de catálogo de las pruebas (`web/tests/lecciones11-catalogo/cap01/sec-1.5.yaml`)
lo hace, comprobada con ngspice de 100 Hz a 10 MHz.

#### `sallen-key-alto` — Filtro activo Sallen-Key paso alto de ganancia unidad (1.2)

El `sallen-key` con resistencias y condensadores cambiados: C₁ y C₂ en serie hasta la entrada +, R₁ de su unión a la
salida y R₂ de la entrada + a masa. Ideal, H = s²·R₁·R₂·C₁·C₂/(1 + s·R₁·(C₁ + C₂) + s²·R₁·R₂·C₁·C₂); con C₁ = C₂ = C,
f₀ = 1/(2π·C·√(R₁·R₂)) y Q = ½·√(R₂/R₁). La fase de la salida es π − atan2(ω·R₁·(C₁ + C₂), 1 − ω²·R₁·R₂·C₁·C₂).

Piezas: `fuente`, `f`, `fase`?, `c1` desde la fuente (F), `c2` hacia la entrada + (F), `r1` de la unión a la salida
(Ω), `r2` de la entrada + a masa (Ω), `gbw`?, `rsal`? (como en `sallen-key`). Mide: lo mismo que `sallen-key`.

```yaml
      esquema: sallen-key-alto
      piezas: { fuente: V_p, f: f_s, c1: C_1, c2: C_2, r1: R_1, r2: R_2 }
      grafica:
        x: { id: nu, min: 10, max: 100000, unidad: Hz, rotulo: "f", escala: log }
        y: { min: 0, max: 1.5, unidad: V, rotulo: "amplitud" }
        curvas:
          - { expr: "V_p*(2*pi*nu)^2*R_1*R_2*C_1*C_2/sqrt((1 - (2*pi*nu)^2*R_1*R_2*C_1*C_2)^2 + (2*pi*nu*R_1*(C_1 + C_2))^2)", color: naranja, rotulo: "v_{o}", mide: salida_amp }
```

Con `gbw` y `rsal` (paso alto): n₁ = C₁·R_o·ω_p; n₂ = C₁·R_o + ω_p·C₁·C₂·R₂·(A₀·R₁ + R_o); n₃ = C₁·C₂·R₂·R_o (n₀ = 0);
d₀ = (A₀ + 1)·ω_p; d₁ = 1 + ω_p·((A₀ + 1)·R₁·(C₁ + C₂) + R_o·(C₁ + C₂) + C₂·R₂);
d₂ = C₁·(R₁ + R_o) + C₂·(R₁ + R₂ + R_o) + ω_p·C₁·C₂·R₂·((A₀ + 1)·R₁ + R_o); d₃ = C₁·C₂·R₂·(R₁ + R_o). Por encima de
GBW la ganancia del operacional se acaba y la banda de paso también.

### 5.4 bis Los esquemas de 1.2 (esquemas12): MOSFET, operacional, regulador, 555, muestreo, segundo orden, trifásica, fuente simétrica, LM3914

Todos tienen su tarjeta en la lección de catálogo de las pruebas (`web/tests/lecciones11-catalogo/cap01/sec-1.5.yaml`,
comprobada con ngspice en el estado inicial y en los extremos de cada mando): los ejemplos de aquí son esas tarjetas.
Las piezas con «?» son opcionales.

#### El operacional de la app (para todos los esquemas con operacional)

El mismo modelo en `ao-no-inversor`, `ao-inversor`, `ao-sumador`, `ao-integrador`, `comparador-schmitt`,
`muestreo-retencion` y `regulador-lineal` (fichero `esquemas/comun-ao.ts`). Piezas del operacional, todas opcionales:

- `vsat`? y `vsatneg`? — la salida no sale de [−V_sat, +V_sat] (`vsatneg` por defecto −`vsat`; 0 con alimentación
  simple). Sin ellas, sin límite.
- `a0`? — ganancia en lazo abierto A₀ (por defecto 10⁵). Con A₀ finito la ganancia de un inversor es
  −(R₂/R₁)/(1 + (1 + R₂/R₁)/A₀): la fórmula ideal del libro cabe en el 0,1 % hasta una ganancia de unos 100.
- `gbw`? — producto ganancia-ancho de banda (Hz): un polo, A(s) = A₀/(1 + s·A₀/(2π·GBW)). Sin él, 1 GHz (ideal para
  cualquier señal de la app). En alterna, el no inversor da |G| = A₀/√((1 + A₀·β)² + (f/f_p)²), con β = R₁/(R₁ + R₂) y
  f_p = GBW/A₀ (tarjeta `ao-no-inversor`).
- `sr`? — velocidad de subida (V/s). Sin ella, sin límite.

Cómo lo simula ngspice: en el transitorio, la salida x sigue dx/dt = 2π·GBW·(v₊ − v₋) − (2π·GBW/A₀)·x, recortada a
±SR, y no sale de los raíles (sin «wind-up»: una salida saturada vuelve en cuanto las entradas se cruzan). En alterna,
la parte de pequeña señal. En continua, la parte lineal de la región en que está (la fuente de ganancia A₀, o una
fuente en el raíl): por eso el circuito vivo colorea los hilos por tensión también con operacional. Un comparador con
realimentación positiva conmuta en el transitorio con un interruptor con memoria sobre v₊ − v₋ (el bucle regenerativo es
más rápido que cualquier paso de tiempo): `gbw` no se aplica ahí, `sr` sí.

**La entrada** de `ao-*`, `comparador-schmitt` y `muestreo-retencion`: `entrada` (continua, V; con señal, su valor
medio) y, para una señal, `amplitud` (V de pico), `f` (Hz), `forma`? (0 senoidal, 1 cuadrada, 2 triangular; sin ella,
senoidal) y `fase`? (°, la senoidal). Cuadrada: `entrada + amplitud` la primera mitad de cada periodo y
`entrada − amplitud` la segunda; triangular: de `entrada − amplitud` en t = 0 a `entrada + amplitud` en T/2. En continua
cuenta `entrada`; en alterna, `amplitud`.

(1.2, esquemas12c; sección 8.3, la ventana del comparador) `forma: 3`, una **rampa** en diente de sierra:
`entrada − amplitud + 2·amplitud·(f·t − floor(f·t))`, de `entrada − amplitud` en t = 0 a `entrada + amplitud` en T y
vuelta de golpe. `ruido`? (V): un «ruido» repetible que se suma a la entrada solo en el transitorio, tres senoidales a
37, 61 y 97 veces `f` que valen 0 en t = 0: `ruido*(sin(2*pi*37*f*t) + sin(2*pi*61*f*t) + sin(2*pi*97*f*t))/3`;
escriba la misma suma en el modelo y el simulador comprueba flanco a flanco cómo «rebota» un comparador sin histéresis
(tarjeta `comparador-rampa-ruido`).

Medidas comunes: `vo` (continua), `entrada` y `salida` (frente al tiempo), `salida_amp`, `salida_fase`, `salida_db`
(alterna).

**Saltos en las curvas.** Un modelo con saltos (una cuadrada, un comparador, un 555, un pedestal) los dibuja en un
instante exacto; el simulador los da en el paso de tiempo siguiente. Cerca de un salto la curva se compara con lo que
da el modelo en ± 0,15 % del eje (± 0,4 % en el 555, que acumula un paso por conmutación): elija un eje de unos pocos
periodos. Para escribir saltos sin condicionales: `floor`, `ceil`, `min`, `max` y `abs` (un escalón en t₀ es
`ceil((t - t0)/1e9)`, 0 hasta t₀ y 1 después; la fase dentro del periodo, `t - T*floor(t/T)`).

#### `mosfet` — MOSFET de canal N con carga en el drenador (1.2)

V_DD, R_D al drenador, la puerta desde una fuente por R_G (R_GS a masa y R_S en la fuente, opcionales). La ley
cuadrática del libro (sección 7.2): en saturación I_D = ½·k·(V_GS − V_th)²; en zona óhmica
I_D = k·((V_GS − V_th)·V_DS − V_DS²/2); nada por debajo de V_th. Es exactamente el LEVEL=1 de ngspice con KP = k y
VTO = V_th (sustrato unido a la fuente). El diodo interno se dibuja, no se simula. Pedido para `cap07` (7.2 curvas y
frontera de regiones, 7.4 R_DS(on), 7.5 PWM, 7.10 punto de trabajo, 7.11 problema 7.C con R_S, 7.1 y 7.3) y `cap08`
(8.8 interruptor analógico).

Piezas: `vdd` (V); `rd` (Ω); `entrada` tensión de la fuente de puerta (V; con `f`, el nivel alto del PWM); `rg`? (Ω);
`rgs`? de la puerta a masa (Ω); `rs`? resistencia de fuente (Ω); `k` (A/V²); `vth` (V); `lambda`? modulación de la
longitud del canal (1/V: I_D·(1 + λ·V_DS)); `f`? frecuencia del PWM (Hz); `ciclo`? ciclo de trabajo (0–1, en alto al
principio de cada periodo; sin él, 0,5).

Mide (continua): `id`, `vds`, `vgs`, `vs`, `vd`. Frente al tiempo: `corriente` (I_D), `drenador` (v_D), `puerta` (v_G).

**R_DS(on) de tabla** (1.2, esquemas12c; secciones 12.3, 12.10, tabla 12.A): con `rdson`? (Ω) el canal es esa
resistencia mientras V_GS ≥ V_th (y nada por debajo), sin ley cuadrática: la tabla de la hoja de datos (20, 36 y 70 mΩ
a 10, 4,5 y 3,3 V) no cabe en una sola k y V_th. El modelo elige el valor (una lista con las filas de la tabla, o la
resistencia a una temperatura, R_DS(on)·(1 + α·ΔT)) y la pieza lo recibe; `k` se da pero no se usa. Tarjeta
`mosfet-rdson`: `I = V_DD/(R_L + R_DS(on))`, `V_DS = I·R_DS(on)`.

Sin condicionales, V_DS en las tres regiones (R_S = 0): `V_ov = max(0, V_GS − V_th)`; `b = k·V_ov + 1/R_D`;
`V_tri = (b − √(max(0, b² − 2·k·V_DD/R_D)))/k`; `V_sat = V_DD − R_D·k·V_ov²/2`; `V_DS = max(V_sat, min(V_ov, V_tri))`.

```yaml
modelo:
  valores:
    VDD_m: { sim: "V_{DD}", nombre: "alimentación", unidad: V, valor: 12 }
    RD_m: { sim: "R_{D}", nombre: "resistencia de drenador", unidad: Ω, valor: 470 }
    Vi_m: { sim: "V_{GS}", nombre: "tensión de puerta", unidad: V, valor: 5 }
    k_m: { sim: "k", nombre: "parámetro de transconductancia", unidad: "A/V²", valor: 0.002 }
    Vth_m: { sim: "V_{th}", nombre: "tensión umbral", unidad: V, valor: 2 }
  calculos:
    Vov_m: { expr: "max(0, Vi_m - Vth_m)", sim: "V_{ov}", nombre: "tensión de saturación", unidad: V }
    b_m: { expr: "k_m*Vov_m + 1/RD_m", sim: "b", nombre: "coeficiente", unidad: "" }
    Vtri_m: { expr: "(b_m - sqrt(max(0, b_m^2 - 2*k_m*VDD_m/RD_m)))/k_m", sim: "V_{tri}", nombre: "V_DS en zona óhmica", unidad: V }
    Vsat_m: { expr: "VDD_m - RD_m*k_m*Vov_m^2/2", sim: "V_{sat}", nombre: "V_DS en saturación", unidad: V }
    VDS_m: { expr: "max(Vsat_m, min(Vov_m, Vtri_m))", sim: "V_{DS}", nombre: "tensión drenador-fuente", unidad: V }
    ID_m: { expr: "(VDD_m - VDS_m)/RD_m", sim: "I_{D}", nombre: "corriente de drenador", unidad: A }
tarjetas:
  - # … id, tipo, titulo, texto, libro
    widget:
      tipo: circuito
      esquema: mosfet
      piezas: { vdd: VDD_m, rd: RD_m, entrada: Vi_m, k: k_m, vth: Vth_m }
      lectura: { valor: ID_m, rotulo: "I_{D}" }
      corriente: ID_m
      mide: { id: ID_m, vds: VDS_m, vgs: Vi_m, vd: VDS_m }
      mandos:
        - { valor: Vi_m, min: 0, max: 8, paso: 0.5 }
        - { valor: RD_m, lista: [470, 1000, 2200] }
```

PWM (tarjeta `mosfet-pwm`): `piezas: { …, f: f_w, ciclo: D_w }` y la curva
`VDD_m - (1 - ceil(t*f_w - floor(t*f_w) - D_w))*(VDD_m - Von_w)` con `mide: drenador` (V_DS(on) de la zona óhmica con
la puerta alta).

**Carga inductiva y diodo de rueda libre** (esquemas12b; sección 4.5, el pico al apagar; sección 14.5, el motor con
PWM). Piezas: `l`? bobina en serie con R_D (H; R_D es entonces la resistencia del devanado); `bv`? tensión de avalancha
del MOSFET (V; obligatoria con `l`: sin diodo, la corriente de la bobina sigue por la avalancha); `vf`? caída del diodo
de rueda libre en paralelo con la carga (V; caída constante a 0,1 A, se admiten ± 0,15 V); `rueda`? interruptor que lo
conecta (sin él, conectado). Mide además `icarga` (la corriente de la bobina frente al tiempo); `corriente` sigue
siendo la del drenador (avalancha incluida: con diodo cae a cero al apagar). En t = 0 la puerta está alta y la bobina
lleva ya la corriente de conducción I₀ = (V_DD − V_DS(on))/R_D, así que un PWM de periodo largo (`f`, `ciclo`) muestra
el apagado desde el reposo, en t_off = ciclo/f. Tras el apagado la corriente cae con V_ext = V_F (con diodo; el drenador
en V_DD + V_F) o V_ext = BV − V_DD (sin él; el drenador en BV): i = (I₀ + V_ext/R)·e^(−(t − t_off)·R/L) − V_ext/R hasta
cero, en el tiempo del libro t = (L/R)·ln(1 + I₀·R/V_ext). Luego el drenador vuelve a V_DD.

```yaml
    rueda_i: { tipo: interruptor, nombre: "diodo de rueda libre conectado", valor: 1 }
  calculos:   # (con V_DS(on) = Von_i como en el ejemplo de arriba, I0_i = (VDD_i - Von_i)/R_i, to_i = 1/(2*f_i))
    Vx_i: { expr: "rueda_i*Vf_i + (1 - rueda_i)*(BV_i - VDD_i)", sim: "V_{ext}", nombre: "tensión de extinción", unidad: V }
    tx_i: { expr: "L_i/R_i*ln(1 + I0_i*R_i/Vx_i)", sim: "t_{ext}", nombre: "tiempo de extinción", unidad: s }
…
      esquema: mosfet
      piezas: { vdd: VDD_i, rd: R_i, l: L_i, entrada: Vg_i, k: k_i, vth: Vth_i, f: f_i, bv: BV_i, vf: Vf_i, rueda: rueda_i }
      grafica:
        x: { id: t, min: 0, max: 0.00095, unidad: s, rotulo: "t" }
        y: { min: 0, max: 70, unidad: V, rotulo: "v_{D}" }
        curvas:
          - { expr: "Von_i*(1 - ceil((t - to_i)/1e9)) + ceil((t - to_i)/1e9)*(VDD_i + Vx_i*ceil(max(0, (I0_i + Vx_i/R_i)*exp(-(t - to_i)*R_i/L_i) - Vx_i/R_i)/1e9))", color: naranja, rotulo: "v_{D}", mide: drenador }
      mandos:
        - { valor: rueda_i }
```

(12 V, 10 Ω, 1 mH, k = 20 A/V², V_th = 1,5 V, 5 V en la puerta, 1 kHz, BV = 60 V, V_F = 0,7 V: tarjetas
`mosfet-inductiva` y `mosfet-inductiva-i`, esta con `icarga` y `corriente`, la segunda multiplicada por `1 - rueda_i`.)
El eje de tiempo no debe llegar al final del periodo (la puerta vuelve a subir en t = 1/f).

#### `ao-no-inversor` — Amplificador no inversor y seguidor (1.2)

La entrada a la entrada +, R₂ de la salida a la entrada − y R₁ de ella a masa: v_o = (1 + R₂/R₁)·v_in; sin R₁ ni R₂, el
seguidor. Pedido para `cap08` (8.2; 8.9 seguidor del muestreo).

Piezas: la entrada y el operacional (arriba); `r1`? (Ω), `r2`? (Ω; las dos o ninguna); `carga`? (Ω). Mide además
`vmenos` (continua), `i1` (por R₁, a masa), `carga`.

**Como bloque de ganancia con recorte (el LM386, sección 14.3; esquemas12b).** «Quitar realimentación sube la
ganancia»: R₂/R₁ de 19 (ganancia 20) a 199 (ganancia 200, el condensador entre las patillas 1 y 8), y `vsat` la
excursión de pico (unos 6 V pico a pico con 9 V: `vsat` 3). La salida, sin condicionales:
`max(-Vs, min(Vs, G*Ap*sin(2*pi*f*t)))` (tarjeta `ao-no-inversor-lm386`: 20 mV de pico a 1 kHz, `mandos: [{ valor:
R2_386, lista: [19000, 199000] }]`, eje de −4 a 4 V). El modelo no tiene el nivel de continua V_s/2 del LM386 ni su
condensador de salida: centre la señal en 0 y dígalo en la nota si importa.

```yaml
      esquema: ao-no-inversor
      piezas: { entrada: cero_ao, amplitud: Ap_ai, f: f_ai, r1: R1_an, r2: R2_an, gbw: gbw_an }
      grafica:
        x: { id: nu, min: 100, max: 10000000, unidad: Hz, rotulo: "f", escala: log }
        y: { min: 0, max: 12, unidad: V, rotulo: "amplitud" }
        curvas:
          - { expr: "Ap_ai*100000/sqrt((1 + 100000/G_an)^2 + (nu/fp_an)^2)", color: naranja, rotulo: "v_{o}", mide: salida_amp }
      mandos:
        - { valor: R2_an, lista: [0, 9000, 99000] }
```

(`G_an = 1 + R2_an/R1_an`, `fp_an = gbw_an/100000`.) El seguidor: `piezas: { entrada: Vi_ai, vsat: Vs_ao }`,
`mide: { vo: Vi_ai, vmenos: Vi_ai }`.

#### `ao-inversor` — Amplificador inversor (1.2)

La entrada por R₁ a la entrada −, R₂ de ella a la salida, la entrada + a masa: v_o = −(R₂/R₁)·v_in hasta saturar.
Saturado, la entrada − deja de ser masa virtual: v₋ = (v_in·R₂ + v_o·R₁)/(R₁ + R₂). Pedido para `cap08` (8.1, 8.2).

Piezas: la entrada y el operacional; `r1`, `r2` (Ω); `carga`? (Ω). Mide además `vmenos`, `i1` (por R₁, hacia la
entrada −), `carga`.

```yaml
modelo:
  valores:
    Vi_ai: { sim: "v_{in}", nombre: "tensión de entrada", unidad: V, valor: 1 }
    R1_ai: { sim: "R₁", nombre: "resistencia de entrada", unidad: Ω, valor: 2200 }
    R2_ai: { sim: "R₂", nombre: "resistencia de realimentación", unidad: Ω, valor: 11000 }
    Vs_ao: { sim: "V_{sat}", nombre: "tensión de saturación", unidad: V, valor: 12 }
  calculos:
    Vo_ai: { expr: "max(-Vs_ao, min(Vs_ao, -R2_ai/R1_ai*Vi_ai))", sim: "v_{o}", nombre: "tensión de salida", unidad: V }
    Vn_ai: { expr: "(Vi_ai*R2_ai + Vo_ai*R1_ai)/(R1_ai + R2_ai)", sim: "v_{−}", nombre: "tensión de la entrada −", unidad: V }
    I1_ai: { expr: "(Vi_ai - Vn_ai)/R1_ai", sim: "I₁", nombre: "corriente por R₁", unidad: A }
tarjetas:
  - # … id, tipo, titulo, texto, libro
    widget:
      tipo: circuito
      esquema: ao-inversor
      piezas: { entrada: Vi_ai, r1: R1_ai, r2: R2_ai, vsat: Vs_ao }
      lectura: { valor: Vo_ai, rotulo: "v_{o}" }
      corriente: I1_ai
      mide: { vo: Vo_ai, i1: I1_ai }
      mandos:
        - { valor: Vi_ai, min: -3, max: 3, paso: 0.5 }
        - { valor: R2_ai, lista: [4700, 11000, 22000] }
```

En el tiempo (tarjeta `ao-inversor-tiempo`): `piezas: { entrada: cero_ao, amplitud: Ap_ai, f: f_ai, … }` y la curva
`max(-Vs_ao, min(Vs_ao, -R2_ai/R1_ai*Ap_ai*sin(w_ai*t)))` con `mide: salida`: el recorte.

#### `ao-sumador` — Sumador inversor (1.2)

Dos o tres entradas, cada una por su resistencia a la entrada −, R_f a la salida: v_o = −R_f·(v₁/R₁ + v₂/R₂ + v₃/R₃).
La entrada 1 puede llevar señal; la 2 y la 3 son continuas. Pedido para `cap08` (8.2).

Piezas: la entrada (la 1) y el operacional; `r1`; `entrada2`, `r2`; `entrada3`?, `r3`? (juntas); `rf`. Mide además
`vmenos`, `i1`, `i2`, `i3`, `irf`.

```yaml
      esquema: ao-sumador
      piezas: { entrada: Vi_as, r1: R_as, entrada2: V2_as, r2: R_as, entrada3: V3_as, r3: R_as, rf: Rf_as }
      lectura: { valor: Vo_as, rotulo: "v_{o}" }
      mide: { vo: Vo_as, i1: I1_as, i2: I2_as, i3: I3_as }
```

(`Vo_as = -Rf_as*(Vi_as/R_as + V2_as/R_as + V3_as/R_as)`, `I1_as = Vi_as/R_as`…)

#### `ao-integrador` — Integrador (1.2)

La entrada por R a la entrada −, C de ella a la salida (y R_f en paralelo, opcional): v_o(t) = v₀ − (1/RC)·∫v_in dt; en
alterna −1/(jωRC), o −(R_f/R)/(1 + jωR_fC). Con raíles la salida se para en ellos (el modelo del autor vale mientras no
llegue). Pedido para `cap08` (8.2).

Piezas: la entrada y el operacional; `r` (Ω); `c` (F); `rf`? (Ω); `v0`? salida en t = 0 (V). Mide además `ic`
(frente al tiempo: la corriente por R).

```yaml
      esquema: ao-integrador
      piezas: { entrada: cero_ao, amplitud: Ap_ag, f: f_ag, forma: forma_cuad, r: R_ag, c: C_ag, vsat: Vs_ao }
      grafica:
        x: { id: t, min: 0, max: 0.006, unidad: s, rotulo: "t" }
        y: { min: -4, max: 2, unidad: V, rotulo: "v" }
        curvas:
          - { expr: "Ap_ag*(1 - 2*floor(2*(t/T_ag - floor(t/T_ag))))", color: tinta, rotulo: "v_{in}", mide: entrada, discontinua: true }
          - { expr: "-Ap_ag/(R_ag*C_ag)*(T_ag/2 - abs(t - T_ag*floor(t/T_ag) - T_ag/2))", color: naranja, rotulo: "v_{o}", mide: salida }
      mandos:
        - { valor: C_ag, lista: [47e-9, 100e-9, 220e-9] }
```

(`forma_cuad` vale 1: cuadrada; `T_ag = 1/f_ag`.)

#### `comparador-schmitt` — Comparador y disparador de Schmitt (1.2)

La entrada a la entrada −; la + por R₁ a una referencia (masa sin ella) y, para el Schmitt, por R₂ a la salida. Umbral
V₊ = (V_ref·R₂ ± V_sat·R₁)/(R₁ + R₂): con V_ref = 0, ±V_sat·R₁/(R₁ + R₂) (±1,09 V con 10 kΩ, 100 kΩ y ±12 V, sección
8.3). Sin R₂, comparador simple en V_ref. Pedido para `cap08` (8.1 transferencia en lazo abierto, 8.3, 8.9).

Piezas: la entrada y el operacional, con `vsat` obligatoria; `r1`? (Ω), `r2`? (Ω; con R₁), `ref`? (V), `alto`?
(interruptor: dónde estaba la salida — en continua, dentro de la ventana valen las dos; en el transitorio, el estado en
t = 0; sin él, alto). Mide además `vmas` (continua) y `umbral` (frente al tiempo): la tensión de la entrada +.

```yaml
modelo:
  valores:
    Vi_ac: { sim: "v_{in}", nombre: "tensión de entrada", unidad: V, valor: 0 }
    R1_ac: { sim: "R₁", nombre: "resistencia a masa", unidad: Ω, valor: 10000 }
    R2_ac: { sim: "R₂", nombre: "realimentación positiva", unidad: Ω, valor: 100000 }
    Vs_ao: { sim: "V_{sat}", nombre: "tensión de saturación", unidad: V, valor: 12 }
    alto_ac: { tipo: interruptor, nombre: "salida en alto antes", valor: 1 }
  calculos:
    Vh_ac: { expr: "Vs_ao*R1_ac/(R1_ac + R2_ac)", sim: "V_{U}", nombre: "umbral", unidad: V }
    hi_ac: { expr: "1 - ceil((Vi_ac - Vh_ac)/1e9)", sim: "a", nombre: "el alto se sostiene", unidad: "" }
    lo_ac: { expr: "ceil((Vi_ac + Vh_ac)/1e9)", sim: "b", nombre: "el bajo se sostiene", unidad: "" }
    Vo_ac: { expr: "Vs_ao*(2*(alto_ac*hi_ac + (1 - alto_ac)*(1 - lo_ac)) - 1)", sim: "v_{o}", nombre: "tensión de salida", unidad: V }
    Vp_ac: { expr: "Vo_ac*R1_ac/(R1_ac + R2_ac)", sim: "v_{+}", nombre: "tensión de la entrada +", unidad: V }
tarjetas:
  - # … id, tipo, titulo, texto, libro
    widget:
      tipo: circuito
      esquema: comparador-schmitt
      piezas: { entrada: Vi_ac, r1: R1_ac, r2: R2_ac, vsat: Vs_ao, alto: alto_ac }
      lectura: { valor: Vo_ac, rotulo: "v_{o}" }
      mide: { vo: Vo_ac, vmas: Vp_ac }
      mandos:
        - { valor: Vi_ac, min: -3, max: 3, paso: 0.5 }
        - { valor: alto_ac, tipo: interruptor, rotulo: "Salida en alto antes" }
```

Con una senoidal de amplitud A y frecuencia f (tarjeta `comparador-schmitt-tiempo`), empezando en alto: con
`th_ac = asin(Vh_ac/A)`, la salida es `Vs_ao*(2*abs(floor((2*pi*f*t - 2*pi*floor(f*t) - th_ac)/pi)) - 1)`.

#### `regulador-lineal` — Regulador lineal: elemento de paso, referencia y lazo (1.2)

«Un divisor de tensión cuya parte superior se ajusta sola» (sección 8.4): un elemento de paso en serie entre la entrada
y la carga, gobernado por un amplificador de error que compara V_ref con la salida (o con la toma de R₁–R₂):
V_out = V_ref·(1 + R₁/R₂) mientras V_in − V_out supere el dropout; por debajo, V_out = V_in − V_do. El paso es ideal: la
corriente de entrada es igual a la de salida (lo dice el libro), así que P = (V_in − V_out)·I. Solo continua; el
circuito vivo lo colorea entero. Pedido para `cap08` (8.4, 8.10 problema 8.A).

Piezas: `entrada` (V); `ref` (V); `r1`?, `r2`? (Ω, juntas; sin ellas V_out = V_ref); `dropout`? (V; sin él, 0: el 78xx
pide unos 2 V, un LDO de 0,2 a 0,5 V); `carga` (Ω); `interruptor`? conecta la carga; `a0`?. Mide (continua): `vout`,
`iin`, `iout` (lo que entrega el paso: carga y divisor), `icarga`, `vpaso` (V_in − V_out), `p_paso` (W), `vb` (salida
del amplificador de error).

```yaml
modelo:
  valores:
    Vi_rg: { sim: "V_{in}", nombre: "tensión de entrada", unidad: V, valor: 12 }
    Vr_rg: { sim: "V_{ref}", nombre: "tensión de referencia", unidad: V, valor: 1.25 }
    R1_rg: { sim: "R₁", nombre: "divisor, arriba", unidad: Ω, valor: 3000 }
    R2_rg: { sim: "R₂", nombre: "divisor, abajo", unidad: Ω, valor: 1000 }
    Vd_rg: { sim: "V_{do}", nombre: "dropout", unidad: V, valor: 2 }
    RL_rg: { sim: "R_{L}", nombre: "carga", unidad: Ω, valor: 5 }
    on_rg: { tipo: interruptor, nombre: "carga conectada", valor: 1 }
  calculos:
    Vset_rg: { expr: "Vr_rg*(1 + R1_rg/R2_rg)", sim: "V_{nom}", nombre: "salida nominal", unidad: V }
    Vo_rg: { expr: "min(Vset_rg, Vi_rg - Vd_rg)", sim: "V_{out}", nombre: "tensión de salida", unidad: V }
    IL_rg: { si: on_rg, entonces: "Vo_rg/RL_rg", sino: "0", sim: "I_{L}", nombre: "corriente de carga", unidad: A }
    Io_rg: { expr: "IL_rg + Vo_rg/(R1_rg + R2_rg)", sim: "I", nombre: "corriente de salida", unidad: A }
    P_rg: { expr: "(Vi_rg - Vo_rg)*Io_rg", sim: "P", nombre: "potencia en el paso", unidad: W }
tarjetas:
  - # … id, tipo, titulo, texto, libro
    widget:
      tipo: circuito
      esquema: regulador-lineal
      piezas: { entrada: Vi_rg, ref: Vr_rg, r1: R1_rg, r2: R2_rg, dropout: Vd_rg, carga: RL_rg, interruptor: on_rg }
      lectura: { valor: Vo_rg, rotulo: "V_{out}" }
      corriente: Io_rg
      mide: { vout: Vo_rg, iin: Io_rg, iout: Io_rg, icarga: IL_rg, p_paso: P_rg }
      mandos:
        - { valor: Vi_rg, min: 4, max: 15, paso: 0.5 }
        - { valor: on_rg, tipo: interruptor, rotulo: "Carga" }
```

#### `ne555-astable` — Temporizador NE555 en modo astable (1.2)

R_a de V_CC a la patilla de descarga, R_b de ella al condensador C, unido a umbral y disparo; dentro, dos comparadores a
⅓ y ⅔ de V_CC, el biestable y el transistor de descarga. t_alto = ln 2·(R_a + R_b)·C, t_bajo = ln 2·R_b·C (1 kΩ, 10 kΩ y
100 nF: 0,762 ms, 0,693 ms, 687 Hz; sección 8.5). C empieza en `v0` (por defecto ⅓·V_CC: la oscilación estable desde
t = 0; 0 V para la primera carga, más larga) con la salida en alto. En ngspice, comparadores y biestable son un
interruptor con histéresis sobre v_C (exactamente los dos umbrales y la memoria del 555). Pedido para `cap08` (8.5).

Piezas: `vcc` (V); `ra`, `rb` (Ω); `c` (F); `v0`? (V, menos de ⅔·V_CC). Frente al tiempo: `vc`, `salida` (V_CC o 0),
`i` (por R_b hacia C, positiva al cargar), `descarga` (patilla de descarga).

```yaml
    calculos:
      th_5: { expr: "ln(2)*(Ra_5 + Rb_5)*C_5", sim: "t_{alto}", nombre: "tiempo en alto", unidad: s }
      tl_5: { expr: "ln(2)*Rb_5*C_5", sim: "t_{bajo}", nombre: "tiempo en bajo", unidad: s }
      T_5: { expr: "th_5 + tl_5", sim: "T", nombre: "periodo", unidad: s }
    # …
      esquema: ne555-astable
      piezas: { vcc: Vcc_5, ra: Ra_5, rb: Rb_5, c: C_5 }
      grafica:
        x: { id: t, min: 0, max: 0.005, unidad: s, rotulo: "t" }
        y: { min: 0, max: 10, unidad: V, rotulo: "v" }
        curvas:
          - { expr: "(1 - min(1, floor((t - T_5*floor(t/T_5))/th_5)))*(Vcc_5 - 2*Vcc_5/3*exp(-(t - T_5*floor(t/T_5))/((Ra_5 + Rb_5)*C_5))) + min(1, floor((t - T_5*floor(t/T_5))/th_5))*2*Vcc_5/3*exp(-(t - T_5*floor(t/T_5) - th_5)/(Rb_5*C_5))", color: naranja, rotulo: "v_{C}", mide: vc }
          - { expr: "Vcc_5*(1 - min(1, floor((t - T_5*floor(t/T_5))/th_5)))", color: azul, rotulo: "v_{o}", mide: salida, discontinua: true }
      mandos:
        - { valor: Rb_5, lista: [4700, 10000, 22000] }
```

(`min(1, floor(τ/t_alto))` vale 0 cargando y 1 descargando, porque t_bajo < t_alto.)

#### `muestreo-retencion` — Muestreo y retención (1.2)

Interruptor con R_on de la entrada al condensador C_h, leído por un seguidor: cerrado (muestreo) hasta `tm`, abierto
después (retención). Al abrir, la puerta inyecta la carga `carga`: el pedestal Q/C_h (10 pC en 1 nF, 10 mV); durante la
retención una fuga `fuga` lo descarga, I/C_h (1 nA en 1 nF, 1 mV por ms; sección 8.9). Con entrada continua V y fuga
I: v_C = V' + (v₀ − V')·e^(−t/(R_on·C_h)) hasta t_m (V' = V − I·R_on), luego v_C(t_m) + Q/C_h − I·(t − t_m)/C_h. Pedido
para `cap08` (8.9, 8.10 problema 8.C).

Piezas: la entrada y el operacional (el seguidor); `ron` (Ω); `ch` (F); `tm` (s); `carga`? (C, positiva: sube);
`fuga`? (A); `v0`? (V). Frente al tiempo: `entrada`, `vc`, `salida`.

```yaml
      esquema: muestreo-retencion
      piezas: { entrada: V_sh, ron: Ron_sh, ch: C_sh, tm: tm_sh, carga: Q_sh, fuga: I_sh }
      grafica:
        x: { id: t, min: 0, max: 0.000003, unidad: s, rotulo: "t" }
        y: { min: 0, max: 2.5, unidad: V, rotulo: "v" }
        curvas:
          - { expr: "(1 - ceil((t - tm_sh)/1e9))*Vt_sh*(1 - exp(-t/tau_sh)) + ceil((t - tm_sh)/1e9)*(Vm_sh + Q_sh/C_sh - I_sh*(t - tm_sh)/C_sh)", color: naranja, rotulo: "v_{o}", mide: salida }
      mandos:
        - { valor: Ron_sh, lista: [50, 100, 200] }
```

(`tau_sh = Ron_sh*C_sh`, `Vt_sh = V_sh - I_sh*Ron_sh`, `Vm_sh = Vt_sh*(1 - exp(-tm_sh/tau_sh))`.) Para ver el pedestal y la
caída, un eje `y` estrecho alrededor de V (tarjeta `muestreo-pedestal`: de 1,98 a 2,03 V).

#### `rlc-escalon` — Escalón en un RLC en serie (1.2)

Un RLC en serie conectado en t = 0 a una fuente continua (con el conmutador de `carga-rc`: 0 lo pone en cortocircuito,
el timbre de un condensador cargado). ω₀ = 1/√(LC), ζ = (R/2)·√(C/L); sobreamortiguado, crítico o subamortiguado, con
la sobreoscilación e^(−πζ/√(1−ζ²)) (sección 24.3; 24.6, 24.10, 42.6). Pedido para `cap24` y `cap42`.

Piezas: `fuente` (V); `r` (Ω); `l` (H); `c` (F); `v0`? (V); `i0`? (A); `interruptor`?. Frente al tiempo: `vc`, `i`
(hacia el condensador), `vl`, `vr`.

```yaml
    calculos:
      a_re: { expr: "R_re/(2*L_re)", sim: "α", nombre: "amortiguamiento", unidad: "1/s" }
      wd_re: { expr: "sqrt(1/(L_re*C_re) - a_re^2)", sim: "ω_{d}", nombre: "pulsación amortiguada", unidad: "rad/s" }
    # …
      esquema: rlc-escalon
      piezas: { fuente: V_re, r: R_re, l: L_re, c: C_re }
      grafica:
        x: { id: t, min: 0, max: 0.005, unidad: s, rotulo: "t" }
        y: { min: -2, max: 20, unidad: V, rotulo: "v" }
        curvas:
          - { expr: "V_re*(1 - exp(-a_re*t)*(cos(wd_re*t) + a_re/wd_re*sin(wd_re*t)))", color: verde, rotulo: "v_{C}", mide: vc }
      mandos:
        - { valor: R_re, lista: [10, 20, 50] }
```

La corriente subamortiguada: `V_re/(L_re*wd_re)*exp(-a_re*t)*sin(wd_re*t)` con `mide: i`. Crítico (ζ = 1):
v_C = V·(1 − (1 + α·t)·e^(−αt)); sobreamortiguado, con s₁,₂ = −α ± √(α² − ω₀²):
v_C = V·(1 + (s₂·e^(s₁t) − s₁·e^(s₂t))/(s₁ − s₂)).

#### `trifasica` — Sistema trifásico con carga en estrella o en triángulo (1.2)

Tres fuentes de la misma amplitud a 0°, −120° y +120° y tres cargas resistivas: en estrella, con el neutro conectado o
cortado (el punto de estrella flota: 139, 263 y 331 V con 26,45, 52,9 y 264,5 Ω, a 112,7 V del neutro), o en
triángulo (R₁ de L1 a L2, R₂ de L2 a L3, R₃ de L3 a L1). Eficaces o de pico, igual (es lineal). Pedido para `cap24`
(sec-new-24-trifasica).

Piezas: `fuente` tensión de fase (V); `f` (Hz); `r1`, `r2`, `r3` (Ω); `neutro`? (interruptor; sin él, conectado);
`triangulo`? (interruptor; sin él, estrella; no con `neutro`). Mide (en alterna, `_amp`, `_fase`, `_db`): `v1`, `v2`,
`v3` (las cargas), `i1`, `i2`, `i3` (las líneas), `ir1`, `ir2`, `ir3` (las cargas), `in` (el neutro), `vn` (el punto de
estrella); frente al tiempo, `t_v1`, `t_v2`, `t_v3`, `t_i1`, `t_in`, `t_vn`.

Millman, sin condicionales: `a = V_f·(1/R₁ + cos(2π/3)/R₂ + cos(2π/3)/R₃)`, `b = V_f·(−sin(2π/3)/R₂ + sin(2π/3)/R₃)`,
`G = 1/R₁ + 1/R₂ + 1/R₃`; con `n` el interruptor del neutro, el punto de estrella es `x = (1 − n)·a/G`,
`y = (1 − n)·b/G`, la corriente del neutro `n·√(a² + b²)` y cada carga `|V_k∠θ_k − (x + jy)|`:

```yaml
      esquema: trifasica
      piezas: { fuente: Vf_3f, f: f_3f, r1: R1_3f, r2: R2_3f, r3: R3_3f, neutro: n_3f }
      lectura: { valor: V3_3f, rotulo: "V₃" }
      mide: { v1_amp: V1_3f, v2_amp: V2_3f, v3_amp: V3_3f, vn_amp: Vn_3f, in_amp: In_3f }
      mandos:
        - { valor: n_3f, tipo: interruptor, rotulo: "Neutro" }
```

(Los cálculos completos, en la lección de catálogo: `sr_3f`, `si_3f`, `xr_3f`, `xi_3f`, `V1_3f`…; estrella y triángulo,
tarjeta `trifasica-triangulo`.)

#### `transformador-real` — Transformador real en alterna (1.2)

La fuente con R_s, la dispersión L_d en serie (L₁·(1 − k²), referida al primario), la magnetizante L_m en paralelo, un
transformador ideal de N₁ y N₂ espiras y la carga (con C_p en paralelo, opcional). Su banda: abajo la corta L_m
(f = (R_s ‖ R'_L)/(2π·L_m), R'_L = (N₁/N₂)²·R_L), arriba L_d (sección 23.9). Solo en alterna. Pedido para `cap24`.

Piezas: `fuente`, `f`, `fase`?; `rs` (Ω); `lm` (H); `ld`? (H); `n1`, `n2`; `carga` (Ω); `cp`? (F). Mide (alterna):
`salida_*` (el secundario), `primario_*` (tras L_d), `i1_*` (la corriente del primario), `im_*` (la magnetizante).

Sin C_p: |v₂| = (N₂/N₁)·V·ω·L_m·R'_L/√((R_s·R'_L − ω²·L_d·L_m)² + (ω·(L_m·(R_s + R'_L) + L_d·R'_L))²):

```yaml
      esquema: transformador-real
      piezas: { fuente: Vp_tr, f: f_tr, rs: Rs_tr, lm: Lm_tr, ld: Ld_tr, n1: N1_tr, n2: N2_tr, carga: RL_tr }
      grafica:
        x: { id: nu, min: 1, max: 1000000, unidad: Hz, rotulo: "f", escala: log }
        y: { min: -40, max: 5, unidad: dB, rotulo: "v_{2}" }
        curvas:
          - { expr: "20*log10(N2_tr/N1_tr*Vp_tr*2*pi*nu*Lm_tr*Rp_tr/sqrt((Rs_tr*Rp_tr - (2*pi*nu)^2*Ld_tr*Lm_tr)^2 + (2*pi*nu*(Lm_tr*(Rs_tr + Rp_tr) + Ld_tr*Rp_tr))^2))", color: naranja, rotulo: "v_{2}", mide: salida_db }
      mandos:
        - { valor: Lm_tr, lista: [0.1, 1, 10] }
```

(`Rp_tr = RL_tr*(N1_tr/N2_tr)^2`.)

#### `rectificador-toma-media` — Fuente simétrica con secundario de toma media (1.2)

Secundario con toma media a masa (15-0-15: cada mitad da su pico), un puente de cuatro diodos en el que, al ser la toma
media la masa, cada rama atraviesa un solo diodo (sección 5.6), y un condensador en cada raíl: +V y −V con rizado a 2f.
Opcionales, un 78xx/79xx en cada raíl como recorte ideal con dropout (sección 8.4): la salida es ±V_reg, o la tensión
del condensador menos el dropout si no llega, y el regulador toma de su condensador la corriente que da a su carga. La
carga de cada raíl es una resistencia, una corriente constante (la de un regulador con su carga fija: la descarga
lineal del libro, ΔV = I/(2f·C)) o las dos. Diodos de caída constante (± 0,2 V, como en `puente`). Solo en el tiempo.
Pedido para `cap15` (14.2: 21,2 → 20,5 V, 2,27 V de rizado, 18,2 V de mínimo).

Piezas: `fuente` (V de pico de cada mitad), `f` (Hz), `vd` (V); `c`? (F, cada raíl); `carga`? (Ω, cada raíl); `i`? (A,
cada raíl; necesita `c`); `reg`? (V); `dropout`? (V, con `reg`). Mide (frente al tiempo): `positivo` y `negativo` (los
condensadores), `salida_pos` y `salida_neg` (con `reg`), `entrada` (la mitad superior), `id_pos` e `id_neg` (los pulsos
de recarga), `icarga`.

Sin condicionales: tras cada pico el condensador baja en recta a I/C hasta que la senoide lo alcanza,
`max(abs(Vp*sin(2*pi*f*t)) - Vd, (Vp - Vd) - I/C*(t - 1/(4*f) - floor(2*f*t - 0.5)/(2*f)))` (el tiempo desde el último
pico). El rizado medido queda algo por debajo del I/(2f·C) del libro, porque la recarga empieza antes del pico
siguiente (1,9 V frente a 2,27 V con los números de 14.2).

```yaml
      esquema: rectificador-toma-media
      piezas: { fuente: Vp_tm, f: f_tm, vd: Vd_tm, c: C_tm, i: I_tm, reg: Vr_tm, dropout: Vdo_tm }
      grafica:
        x: { id: t, min: 0, max: 0.04, unidad: s, rotulo: "t" }
        y: { min: -22, max: 22, unidad: V, rotulo: "v" }
        curvas:
          - { expr: "max(abs(Vp_tm*sin(2*pi*f_tm*t)) - Vd_tm, Vpk_tm - I_tm/C_tm*(t - 1/(4*f_tm) - floor(2*f_tm*t - 0.5)/(2*f_tm)))", color: naranja, rotulo: "condensador", mide: positivo }
          - { expr: "min(Vr_tm, max(abs(Vp_tm*sin(2*pi*f_tm*t)) - Vd_tm, Vpk_tm - I_tm/C_tm*(t - 1/(4*f_tm) - floor(2*f_tm*t - 0.5)/(2*f_tm))) - Vdo_tm)", color: verde, rotulo: "salida", mide: salida_pos }
      mandos:
        - { valor: Vdo_tm, lista: [2, 5, 8] }
```

(`Vpk_tm = Vp_tm - Vd_tm`; 21,21 V, 50 Hz, 0,7 V, 2 200 µF, 0,5 A, 12 V: tarjetas `rectificador-toma-media` y
`rectificador-toma-media-reg`; con 8 V de dropout la salida cae en los valles.) La curva de `negativo` es la misma con
el signo cambiado; la de `salida_neg`, `max(-Vr, -(…) + Vdo)`.

#### `lm3914` — Indicador de nivel LM3914 (1.2)

Un convertidor flash en miniatura (sección 14.4): una escalera de diez resistencias iguales entre V_LO y V_HI, diez
comparadores (el k-ésimo, de 1 a 10, en V_LO + k·(V_HI − V_LO)/10) con la entrada por un buffer, y diez salidas de
corriente constante a diez LED alimentados desde V_LED. La resistencia R_ref de la salida de referencia a masa fija la
corriente de cada LED, «unas diez veces» la suya: I_LED = factor·V_ref/R_ref. Modo barra (todos hasta el nivel) o punto
(solo el último). Cada salida disipa I_LED·(V_LED − V_F) dentro del integrado. Solo en continua. Pedido para `cap15`
(14.4: 1 kΩ, unos 12 mA; 10 LED a 10 mA con 4 V de exceso, 400 mW).

Piezas: `entrada` (V), `vref` (V), `rref` (Ω), `vhi`? (V; sin ella, V_ref), `vlo`? (V; sin ella, 0), `vled` (V), `vf`
(V, la caída de un LED a su corriente), `factor`? (sin él, 10), `barra`? (interruptor: 1 barra, 0 punto; sin él,
barra). Mide (continua): `encendidos` (el número de LED), `iled` (la corriente total), `iref`, `p_chip` (la disipación
de las salidas), `vsalida` (la salida del primer LED, V_LED − V_F si está encendido).

Justo en un umbral el comparador cuenta como encendido, pero `floor` puede redondear a un lado u otro: ponga los mandos
fuera de los umbrales (un deslizador de 0,06 a 1,26 V en pasos de 0,1 con escalones de 0,125 V).

```yaml
    Nb_lm: { expr: "min(10, max(0, floor(10*Vin_lm/Vref_lm)))", sim: "N_{barra}", nombre: "LED encendidos en modo barra", unidad: "" }
    N_lm: { expr: "barra_lm*Nb_lm + (1 - barra_lm)*min(1, Nb_lm)", sim: "N", nombre: "LED encendidos", unidad: "" }
    Iref_lm: { expr: "Vref_lm/Rref_lm", sim: "I_{ref}", nombre: "corriente de R_ref", unidad: A }
    It_lm: { expr: "N_lm*10*Iref_lm", sim: "I_{total}", nombre: "corriente de los LED", unidad: A }
    P_lm: { expr: "It_lm*(Vled_lm - Vf_lm)", sim: "P", nombre: "disipación en el integrado", unidad: W }
…
      esquema: lm3914
      piezas: { entrada: Vin_lm, vref: Vref_lm, rref: Rref_lm, vled: Vled_lm, vf: Vf_lm, barra: barra_lm }
      lectura: { valor: N_lm, rotulo: "LED encendidos" }
      mide: { encendidos: N_lm, iled: It_lm, iref: Iref_lm, p_chip: P_lm }
      mandos:
        - { valor: Vin_lm, min: 0.06, max: 1.26, paso: 0.1 }
        - { valor: barra_lm }
```

(1,25 V, 1 250 Ω, 6 V y 2 V: 10 mA por LED y 400 mW con los diez; tarjeta `lm3914`.)

### 5.4 ter Los esquemas de 1.2 (esquemas12c): etapas con transistores, estabilidad, instrumentación y más

Cada uno tiene su tarjeta probada en la lección de catálogo de las pruebas (`web/tests/lecciones11-catalogo/cap01/
sec-1.5.yaml`, con el mismo nombre que el esquema salvo que se diga otro): copie de allí el modelo. «?» marca una pieza
opcional. **Los transistores de pequeña señal** (`emisor-comun`, `par-diferencial`) caen exactamente `vbe` en el punto
de trabajo que el esquema calcula con el modelo del libro (V_BE constante, I_C = β·I_B): sus lecturas en continua son
las del libro y las de alterna las del modelo en π con g_m = I_C/V_T (V_T = 25,85 mV), r_π = β/g_m y sin r_o, al 0,1 %.

#### `emisor-comun` — Etapa en emisor común en alterna (1.2)

Divisor R₁–R₂ en la base, R_C, R_E con su condensador de desvío C_E (un interruptor lo conecta), R_E1? sin desacoplar
encima, acoplo de entrada C_in desde una fuente senoidal con R_S, acoplo de salida C_out a la carga R_L. Secciones
43.3 a 43.5 (ganancia, Z_in con resistencia en serie, corte inferior).

Piezas: `vcc`, `r1`, `r2`, `rc`, `re` (Ω), `re1`?, `ce`? (F), `desvio`? (interruptor), `beta`, `vbe`, `fuente` (V de
pico), `f` (Hz), `fase`?, `rs`?, `cin`? y `cout`? (F; sin ellos, acoplo ideal), `carga`? (Ω).

Mide: continua `ib`, `ic`, `vb`, `ve`, `vc`; frente al tiempo `entrada`, `base`, `colector`, `salida` (tras C_out); en
alterna `salida_amp|fase|db`, `base_amp|…` y `ientrada_amp|…` (la corriente de la fuente: Z_in = v/i).

Con acoplos ideales, v_o/v_s = −β·(R_C ∥ R_L)/(r_π + (β + 1)·Z_E), Z_E = R_E1 + R_E ∥ 1/(jω·C_E): con a = r_π +
(β + 1)·R_E1, b = (β + 1)·R_E y τ = R_E·C_E, |A| = β·R_L'·√(1 + (ωτ)²)/√((a + b)² + (ωτ·a)²) y la fase
180° + atan(ωτ) − atan(ωτ·a/(a + b)). El transitorio empieza en el punto de trabajo y simula antes los periodos que
asientan los acoplos (diez veces su constante de tiempo, como mucho 400): la curva es la del régimen permanente.
Tarjetas `emisor-comun` (ganancia frente a la frecuencia, con y sin C_E; Z_in) y `emisor-comun-tiempo` (la salida
invertida con C_in y C_out). Sin desacoplar no se nota la curvatura del transistor; desacoplado, una entrada de más de
unos milivoltios ya se deforma (el libro lo dice: la ganancia depende de I_C).

#### `par-diferencial` — Par diferencial con fuente de cola (1.2)

Dos NPN con los emisores unidos a una cola: R_EE a −V_EE o una fuente de corriente I con su r_o?; R_C en cada colector.
Sección 43.6 y figura 44.12.

Piezas: `vcc`, `vee` (el valor absoluto del raíl negativo), `rc`, `drc`? (R_C2 = R_C·(1 + drc)), `ree` o `icola` (y
`ro`?), `beta`, `vbe`, `v1`, `v2` (continua de las bases), `ad`? (diferencial: +ad/2 en la base 1 y −ad/2 en la 2),
`acm`? (modo común) y `f` con ellas.

Mide: continua `ic1`, `ic2`, `icola`, `vc1`, `vc2`, `ve`; frente al tiempo `salida1`, `salida2`, `dif`, `entrada1`,
`entrada2`; en alterna `salida1_*`, `salida2_*`, `dif_*`, `cola_*`.

v_c2 = +g_m·R_C·ad/2; en modo común v_c = −β·R_C·acm/(r_π + 2(β + 1)·R_EE) (con fuente, r_o; ideal, 0); CMRR =
(r_π + 2(β + 1)·R_EE)/(2r_π) ≈ g_m·R_EE. Con cola ideal y bases a distinta tensión, el reparto del libro:
I_C1 = α·I/(1 + e^(−(v₁ − v₂)/V_T)). Tarjetas `par-diferencial`, `par-diferencial-comun`, `par-diferencial-reparto`.

#### `etapa-clase-ab` — Etapa de salida complementaria con multiplicador de V_BE (1.2)

Q₁ (NPN) desde +V y Q₂ (PNP) desde −V como seguidores, R_E en cada emisor hasta la salida y la carga a masa; como en la
figura 52.12, una fuente de bias I_B de +V a la base de Q₁ y el multiplicador de V_BE (Q₃, R₁ de colector a base y R₂
de base a emisor) entre las bases; el driver (la etapa anterior, aquí una fuente) fija la base de Q₂. Un interruptor
`puente` cortocircuita el multiplicador: clase B, la zona muerta de ± V_BE. Secciones 43.7, 51.4, 51.5; averías de
51.9 y 51.10.

Piezas: `vcc` (±), las de la entrada del operacional (`entrada` el nivel del driver, `amplitud`, `f`, …), `ib` (A),
`r1`, `r2`, `puente`?, `re`, `re2`? (la de Q₂; sin ella, `re`), `carga`, `beta`, `vbe` (la de los transistores de
salida a `iref`), `iref`? (A), `vbem`? (la del multiplicador; sin ella, `vbe`), `betam`? (sin ella, 10⁶).

Mide: continua `iq`, `iq2`, `vbb`, `vo`, `il`, `vbe1`; frente al tiempo `entrada` (la base de Q₂), `salida`, `ic1`,
`ic2`, `carga`.

El modelo del libro: V_BB = V_BE·(1 + R₁/R₂) (Q₃ sin corriente de base: β de 10⁶ salvo `betam`), I_E de reposo
(V_BB − 2·V_BE)/(R_E1 + R_E2) e I_Q = β/(β + 1)·I_E de colector. **Dé a `iref` la I_Q del modelo (un cálculo)**: los
transistores caen entonces exactamente `vbe` en reposo y la corriente de reposo del simulador es la del libro (es
4,5 A/V de sensible a V_BB con 0,22 Ω: unos milivoltios la cambian mucho); con señal se admiten ± 0,1 V de V_BE entre
iref/50 y 50·iref. Centre la salida con `entrada = −V_BB/2`. Sin la señal, con el multiplicador puenteado, Q₁ no
conduce y su caída no se comprueba. La curva de salida, con E₁ = v + V_BB/2 − V_BE, E₂ = v − V_BB/2 + V_BE y k = R_E/R_L:
`max(E₂/(1 + k), min(E₁/(1 + k), (E₁ + E₂)/(2 + k)))` en clase AB y `max(E₁/(1 + k), 0) + min(E₂/(1 + k), 0)` en clase B
(tarjeta `etapa-clase-ab`). La deriva térmica: los transistores de salida calientes bajan `vbe` 2 mV/°C; el multiplicador
sobre el disipador baja `vbem` con ellos. Para una avería (§10.4) se rompen `re` o `re2` (abiertas, `1e9`: falta medio
ciclo), `r1` o `r2` (el bias se dispara o desaparece) y el `puente` (cerrado: cruce); la lección de catálogo aún no tiene
una tarjeta `averia` con esta etapa, así que compruebe la suya con el generador: en cada estado averiado el modelo debe
dar el punto de trabajo roto, y un transistor que en reposo deja de conducir solo se compara por sus corrientes.

#### `ao-estabilidad` — Segundo polo, carga capacitiva, R_iso y snubber (1.2)

Seguidor (o no inversor con `r1` y `r2`) con un operacional de dos polos, A(s) = A₀/((1 + s/ω₁)(1 + s/ω₂)), ω₁ =
2π·GBW/A₀, ω₂ = 2π·polo2, y resistencia de salida R_o, con carga C_L, R_iso entre la salida y C_L (la realimentación
antes de R_iso, fuera del lazo, o después con `dentro`) y una red snubber R_s–C_s. Lineal (sin raíles ni slew rate).
Secciones 27.8 a 27.10.

Piezas: las de la entrada (`entrada`, `amplitud`, `f`, `forma`), `r1`?, `r2`?, `a0`?, `gbw`, `polo2`?, `rsal`?, `cl`?,
`riso`?, `dentro`?, `rsn`? y `csn`?.

Mide: continua `vo`; frente al tiempo `entrada`, `salida` (en la carga), `patilla` (antes de R_iso); en alterna
`salida_*` y **`lazo_amp|fase|db`, la ganancia de lazo T(jω)**, medida en una copia del circuito con el lazo abierto en
la entrada − (exacto: no entra corriente). El margen de fase es 180° + arg T donde |T| = 1.

Con dos polos y sin R_o el lazo cerrado es de segundo orden: ω_n² = ω₁ω₂(1 + A₀β), 2ζω_n = ω₁ + ω₂ (β = R₁/(R₁ + R₂));
10 Hz y 1 MHz con A₀ = 10⁵: un seguidor con ζ = 0,5, 16 % de sobreoscilación y 52° de margen. R_o y C_L añaden a T un
polo en 1/(2π·R_o·C_L) (50 Ω y 1 nF: 3,2 MHz). Tarjetas `ao-estabilidad` (el escalón de una cuadrada que empieza en
alto: `G₀·(e + a) − 2a·G₀·ceil((t − t₀)/1e9)·(1 − e^(−ζω_n·τ)·(cos ω_d·τ + ζω_n/ω_d·sen ω_d·τ))`, τ = max(0, t − t₀)) y
`ao-estabilidad-lazo` (|T| con C_L: `A₀/√((1 + (ω/ω₁)²)(1 + (ω/ω₂)²)(1 + (ω·R_o·C_L)²))`).

#### `ao-instrumentacion` — Amplificador de instrumentación de tres operacionales (1.2)

U₁ y U₂ seguidores con ganancia (R de cada salida a su entrada −, R_G entre las dos entradas −), U₃ diferencial (R₃ y
R₄, la patilla de referencia). v_o = (1 + 2R/R_G)·(R₄/R₃)·(v₂ − v₁) + V_ref. Operacionales lineales de A₀ = 10⁷ (`a0`?).
Sección 27.7 y problema 26.A.

Piezas: `v1`, `v2` (continua), `ad`?, `acm`?, `f`?, `r`, `rg`, `r3`, `r4`, `desajuste`? (la R₄ de la referencia,
R₄·(1 + ε)), `ref`?, `a0`?.

Mide: continua `vo`, `vo1`, `vo2`, `irg`; frente al tiempo `salida`, `entrada1`, `entrada2`; en alterna `salida_*`.

Con desajuste, la ganancia de modo común es R₄(1 + ε)(R₃ + R₄)/(R₃(R₃ + R₄(1 + ε))) − R₄/R₃ (con R₃ = R₄, ε/(2 + ε)).
Tarjetas `ao-instrumentacion` y `ao-instrumentacion-cm`.

#### `transimpedancia` — Amplificador de transimpedancia (1.2)

Una fuente de corriente (el fotodiodo) con su capacidad C_in a la entrada −, la + a masa, R_f ∥ C_f de realimentación,
el operacional de la app (§ «El operacional de la app»). Problema 26.B y la fila TIA de 27.3.

Piezas: las de la entrada del operacional **en amperios** (`entrada`, `amplitud`, `f`, `forma`), `rf`, `cf`?, `cin`?,
las del operacional (`gbw`, `vsat`, …).

Mide: continua `vo`; frente al tiempo `entrada` (la corriente) y `salida`; en alterna `salida_*` (V por la amplitud de
la corriente). Ideal v_o = −R_f·i; con un polo, v_o/i = −1/(Y_f + (s·C_in + Y_f)/A(s)), Y_f = 1/R_f + s·C_f: con ω = 2πf y
ω_p = 2π·GBW/A₀, Re = 1/R_f + (1/R_f − ω²(C_in + C_f)/ω_p)/A₀, Im = ω·C_f + (ω(C_in + C_f) + ω/(R_f·ω_p))/A₀ y
|v_o| = i/√(Re² + Im²); sin bastante C_f, un pico cerca de √(GBW/(2π·R_f·C_in)). No use 0 F en una lista: un condensador
de 0 se simula como 1 nF; ponga 0,1 pF.

#### `comparador-no-inversor` — Comparador no inversor con histéresis (1.2)

La señal por R₁ a la entrada +, R₂ de la salida a ella, la referencia en la entrada −. Problema 26.C (el termostato:
3,9 kΩ, 100 kΩ y 2,5 V). Sube cuando la entrada pasa de V_ref·(1 + R₁/R₂) − V_bajo·R₁/R₂ y baja bajo
V_ref·(1 + R₁/R₂) − V_alto·R₁/R₂ (2,5975 y 2,4025 V con salida de 0 a 5 V). No invierte, a diferencia de
`comparador-schmitt`.

Piezas: las de la entrada, `r1`, `r2`, `ref`?, `alto`?, las del operacional (`vsat` obligatoria).

Mide: `vo`, `vmas` (continua), `entrada`, `salida`, `mas` (frente al tiempo). Con una triangular de `e ± a`, la salida
está alta entre las fases φ₁ = (V_alto − e + a)/(4a) y φ₂ = ½ + (e + a − V_bajo)/(4a) de cada periodo (tarjeta
`comparador-no-inversor`).

#### `mosfet-p` — MOSFET de canal P en el lado alto (1.2)

Fuente en V_DD, la carga del drenador a masa, la puerta desde V_G por R_G?, R_GS? de la puerta a la fuente. La ley
cuadrática con V_SG = V_DD − V_G y |V_th| (`vth` positiva): conduce con la puerta baja. Sección 8.8.

Piezas: `vdd`, `rd`, `entrada` (V_G respecto de masa), `rg`?, `rgs`?, `k`, `vth`, `lambda`?. Mide (continua): `id`,
`vsd`, `vsg`, `vd`. Las fórmulas de `mosfet` con V_ov = max(0, V_DD − V_G − |V_th|) y V_SD en lugar de V_DS.

#### `puerta-transmision` — Puerta de transmisión CMOS (1.2)

NMOS y PMOS en paralelo entre la entrada y la salida, carga a masa; `ctrl` (interruptor) pone la puerta del NMOS a V_DD
y la del PMOS a 0 (conduce) o al revés; un toque en las puertas lo cambia. Sección 8.8 y figura 44.17.

Piezas: `vdd`, `entrada`, `carga`, `kn`, `vtn`, `kp`, `vtp` (valor absoluto), `ctrl`?. Mide (continua): `vout`,
`corriente`, `caida`. Con k_n = k_p y los dos conduciendo, los términos en V_DS² se anulan: R_on = 1/(k·(V_DD − V_tn −
|V_tp|)), sin depender de la entrada; cerca de un raíl conduce uno solo. Tarjeta: R_on = 1/(k·(max(0, V_DD − V_in − V_tn)
+ max(0, V_in − |V_tp|))) y V_out = V_in·R_L/(R_L + R_on) (exacta al 0,1 % en V_out).

#### `lm317` — Regulador ajustable LM317 (1.2)

La referencia V_ref (1,25 V) entre OUT y ADJ, R₁ de OUT a ADJ, R₂ de ADJ a masa, la corriente I_adj de la patilla:
V_out = V_ref·(1 + R₂/R₁) + I_adj·R₂, mientras V_in − V_out pase del dropout (si no, V_in − V_do). Sección 8.4.

Piezas: `entrada`, `r1`, `r2`, `ref`?, `iadj`?, `dropout`?, `carga`, `interruptor`?, `a0`?. Mide (continua): `vout`,
`vadj`, `vref`, `iin` (la de la carga, la del divisor y I_adj), `ir1`, `icarga`, `p_paso`. Tarjeta `lm317`.

#### `sonda-x10` — La sonda ×10 y su compensación (1.2)

9 MΩ ∥ C₁ en la punta y 1 MΩ ∥ C₂ en la entrada del osciloscopio (C₂ con el trimmer, dibujado con su flecha); una
cuadrada de calibración de `entrada` voltios (alta la primera mitad, desde el reposo en t = 0). Secciones 20.5 y 22.11.

Piezas: `entrada`, `f`, `r1`, `c1`, `r2`, `c2`. Mide: `entrada`, `salida` (frente al tiempo), `salida_*` (alterna).

En cada flanco dividen primero los condensadores, K₀ = C₁/(C₁ + C₂), y luego las resistencias, K∞ = R₂/(R₁ + R₂), con
τ = (R₁ ∥ R₂)·(C₁ + C₂): la primera mitad V·(K∞ + (K₀ − K∞)·e^(−t/τ)); la segunda (v(T/2) − V·K₀)·e^(−(t − T/2)/τ).
La cuadrada sube en t = 0: multiplique la primera mitad por `ceil(t/1e9)` (tarjeta `sonda-x10`). Compensada
(R₁·C₁ = R₂·C₂), plana.

### 5.4 quater Los esquemas de 1.2 (esquemas12d): potencia, máquinas, térmica, buses y osciladores

Cada uno tiene su tarjeta probada en la lección de catálogo de las pruebas (`web/tests/lecciones11-catalogo/cap01/
sec-1.5.yaml`, con el nombre del esquema o el que se diga): copie de allí el modelo. «?» marca una pieza opcional.
Las cifras del libro que reproducen están comprobadas con ngspice en `web/tests/lecciones12-esquemas12.spec.ts`
(«esquemas12d frente a ngspice»).

#### `tiristor` — Control por ángulo de fase con SCR o TRIAC (1.2)

La red senoidal, un SCR o un TRIAC en serie y la carga R (con L?). Se enclava como dice el libro (sección 10.1): un
pulso de puerta a α en cada semiciclo (el positivo con SCR; los dos con TRIAC) lo enciende y conduce sin la puerta
hasta que su corriente se anula. Secciones 10.1, 56.4 (arrancador suave).

Piezas: `fuente` (V de pico), `f`, `r`, `l`?, `alfa` (°, de 0 a 180), `triac`? (interruptor: cerrado TRIAC; abierto o
sin la pieza, SCR; un toque en el símbolo lo cambia), `ancho`? (duración del pulso de puerta, °; 10° sin ella).

Mide (frente al tiempo): `red`, `carga` (la tensión de la carga), `corriente`, `tiristor` (la del dispositivo) y
`resistencia` (la de R, con `l`). Solo transitorio; empieza en el cero de subida de la red, apagado.

En ngspice cada sentido es un interruptor con memoria en serie con un diodo: cae unos 0,7 V, como un tiristor real
(«una caída de uno o dos voltios»), y 100 kΩ en paralelo hacen de fuga en corte (unos mA): ambas cosas caben en el 1 %
del eje. Carga resistiva, fase dentro del semiciclo `φ = 360·f·t − 180·floor(2·f·t)`: v = V_p·sen(2πft) cuando φ ≥ α
(`ceil((φ − α)/1e9)`), y con SCR solo en el semiciclo positivo (`1 − (floor(2·f·t) − 2·floor(f·t))`); la potencia
relativa con TRIAC, 1 − α/180 + sen(2α)/(2π) (97, 50 y 20 % con 30, 90 y 120°, figura 10.3). Carga R-L con SCR,
θ = 2πft − α reducido a [0, 2π) (`u − 2π·floor(u/(2π))`): i = (V_p/Z)·(sen(θ + α − φ) − sen(α − φ)·e^(−θ/tan φ)), con
`max(0, …)` y cortada en θ < 2π + φ − α (después la fórmula vuelve a ser positiva antes del disparo siguiente). Tarjetas
`tiristor` y `tiristor-inductiva`.

#### `crowbar` — Crowbar con SCR y fusible (1.2)

La entrada (V, y desde `t0` la tensión de la avería, `falla`) con su R_s?, el fusible, la carga y, sobre el raíl, el
Zener, R_G y el SCR del bloque 210. Pasado V_Z + V_GT el SCR cortocircuita el raíl y, enclavado, lo mantiene hasta
que el fusible funde. Sección 10.9.

Piezas: `fuente`, `falla`, `t0`, `rs`? (1 mΩ sin ella), `rf`, `i2t` (A²·s), `inom`? (A que aguanta para siempre),
`carga`, `vz`, `vgt`? (0,7 V), `rg`? (se dibuja; el disparo es el umbral ideal V_Z + V_GT), `vt`? (caída del SCR, 1 V),
`ron`? (1 mΩ).

Mide: continua `vo`, `ifus` (el estado normal); frente al tiempo `entrada`, `salida` (el raíl), `fusible`, `scr`,
`energia` (la I²t acumulada). El cortocircuito: I_cc = (V_falla − V_T)/(R_s + R_f + R_on); funde en
t_f = t₀ + I²t/(I_cc² − I_n²). Compare las **corrientes** (`fusible`, `scr`: en el salto pasan por valores entre los
del modelo); la tensión del raíl sube un instante hasta el umbral antes de caer y no casa punto a punto con un salto
del modelo (dibújela sin `mide`). Tarjeta `crowbar`.

#### `motor-cc` — Motor de corriente continua: inducido y mecánica (1.2)

El inducido R + L con E = k·ω y la mecánica como la simula el libro (bloque 49): el par k·I una fuente de corriente
hacia el nodo de la velocidad, la inercia J un condensador de J faradios, el par de carga otra fuente y el rozamiento
b? una resistencia de 1/b. Secciones 34.3 (56.3) y 56.8.

Piezas: `fuente` (V), `r`, `l`, `k` (V·s/rad), `j` (kg·m²), `carga`? (N·m), `tcarga`? (s, cuándo entra la carga),
`b`?, `rampa`? (s: la tensión sube de 0 a V), `w0`? (rad/s: ya gira en vacío en t = 0, para frenar).

Mide: continua `ia`, `omega` (rad/s), `par`, `fem`; frente al tiempo `corriente`, `velocidad`, `par_t`, `fem_t`,
`inducido`. Continua: I = T/k, ω = V/k − R/k²·T. Arranque desde parado sin carga: s₁,₂ = −a/2 ± √(a²/4 − b) con
a = R/L, b = k²/(L·J); i = V/L/(s₁ − s₂)·(e^(s₁t) − e^(s₂t)) y ω = ω₀ + ω₀·(s₂e^(s₁t) − s₁e^(s₂t))/(s₁ − s₂)
(tarjetas `motor-cc`, `motor-cc-arranque`, `motor-cc-velocidad`). Las cifras del libro (46,96 A de pico, el 63 % a los
20 ms, 4,80 A con la rampa de 0,2 s, 4 392,7 y 4 106,2 rpm, −24 A al bajar a 12 V desde 480 rad/s) salen tal cual.
No se colorea por tensión (la bobina y la inercia parten de su condición inicial) y la mecánica no lleva `data-red`:
su «tensión» es una velocidad.

#### `induccion` — Motor de inducción: circuito equivalente por fase (1.2)

La figura 34.5 en alterna: la tensión de fase, R₁ + jX₁, R_Fe? ∥ jX_m en el entrehierro y el rotor jX₂′ + R₂′ +
R₂′·(1 − s)/s (la carga mecánica, con su flecha: arrastrarla mueve el deslizamiento). Secciones 34.4 (56.4), 56.6
(V/f) y 56.8.

Piezas: `fuente` (V eficaces de fase: las corrientes salen eficaces), `f`, `fn`? (la frecuencia a la que se dan las
reactancias: con un variador, X = X_n·f/f_n), `r1`, `x1`, `xm`, `rfe`?, `x2`, `r2`, `s` (0 < s ≤ 1).

Mide (alterna): `linea_*` (I₁), `rotor_*` (I₂′), `magnetizante_*`, `entrehierro_*` (E), `eje_*` (la tensión en la
carga mecánica). El par no es un fasor: escríbalo en el modelo desde la corriente del rotor que se comprueba,
T = 3·I₂′²·(R₂′/s)/ω_s (Ec. 2). Las cifras del bloque 72 salen al 0,1 % (49,84 A y 48,54 N·m parado, 86,51 N·m con
s = 0,264, 7,887 A y 26,61 N·m con s = 0,0339). Tarjeta `induccion` (con `comprobar` de esas cifras y el rendimiento
interno).

#### `snubber` — Apagado de una carga inductiva con snubber RC (1.2)

El circuito de la figura 10.11: el bus, la corriente de carga I₀ (una bobina grande), el MOSFET que se abre en t = 0
con su C_oss, el diodo de libre circulación por la inductancia parásita L del lazo (R_p? sus pérdidas) y la red R_s–C_s
en paralelo con el interruptor. Sección 10.6 (y 15.5).

Piezas: `vb`, `i0`, `l`, `rp`?, `coss`, `rsn`? y `csn`? (las dos), `snubber`? (interruptor que la conecta).

Mide (frente al tiempo): `drenador`, `bobina` (la corriente del diodo), `isnubber`. Sin snubber: hasta t₁ = V_B·C_oss/I₀
la rampa I₀·t/C_oss; después V_B + I₀/(C_oss·ω_d)·e^(−α·τ)·sen(ω_d·τ), τ = t − t₁, α = 1/(2·R_p·C_oss),
ω_d = √(1/(L·C_oss) − α²) (tarjeta `snubber`: 585 V de pico con 400 V, 10 A, 100 nH, 250 pF y 200 Ω). **Con el
snubber conectado** el circuito es de tercer orden y la app no tiene su fórmula cerrada: el pico baja a 448 V con
20 Ω y 1 nF (comprobado en la prueba de modelo), pero una tarjeta no puede comparar su curva. Para el `ajuste` de la
sección 10.6 use el criterio del libro como medidor (R_s frente a Z₀ = √(L/C_oss), bloque 140) con el esquema dibujado,
o el `banco`.

#### `termica` — Cadena térmica: unión, cápsula, disipador y ambiente (1.2)

«La analogía no es una metáfora» (bloque 133): P una fuente de corriente hacia la unión, R_jc, R_cs? y R_sa en serie
hasta el ambiente T_a (una fuente de tensión); sin disipador (`disipador` abierto, con `rja`), la cápsula va al
ambiente por R_ja − R_jc. Capacidades térmicas `cj`?, `cc`?, `cs`? (J/°C) a la referencia, que parten de T_a; con
`duracion`? la potencia se corta. Las tensiones del dibujo son temperaturas: el circuito vivo las rotula y las
leyenda en °C (`Lienzo nodos`). Secciones 10.5 y 10.11 (10.B).

Mide: continua `tj`, `tc`, `ts` (°C), `flujo` (W); frente al tiempo `union`, `capsula`, `radiador`. T_j = T_a +
P·(R_jc + R_cs + R_sa) (92,5 °C del bloque 127; 350 °C sin disipador; 99,5, 106,5 y 124 °C del problema 10.B). Con una
sola capacidad (la del disipador) la subida es exponencial con τ = R_sa·C_s (tarjetas `termica`, `termica-tiempo`).

#### `rs485` — Bus RS-485 en reposo (1.2)

R_p de D1 (B) a V_CC, las terminaciones R_T entre hilos en los dos extremos (`t1`?, `t2`?: el puente de cada una), las
`n` cargas unidad («12 kΩ de cada hilo a su tensión interna», `ru`?, `ref`? = V_CC/2 sin ella) y R_pd? (R_p sin ella)
de D0 (A) a masa; `activa`?: la terminación activa de PROFIBUS, la polarización también en el extremo lejano.
Secciones 45.6 (Modbus), 45.11, 45.14 y el bloque 221.

Mide (continua): `vba` (V_BA = v(D1) − v(D0)), `vd1`, `vd0`, `ipol`, `it`. Con `ref` en V_CC/2 las cargas son
24 kΩ/n entre hilos y vale el lazo en serie del libro: Z_d = 1/(2/R_T + n/24 kΩ), V_BA = V_CC·Z_d/(2R_p + Z_d) (211 y
196 mV con 680 Ω; PROFIBUS, 1,1 V y 987 mV con 32 cargas). Tarjetas `rs485` y `rs485-profibus`.

#### `wien`, `desfase` y `cristal` — Redes de los osciladores (1.2)

- `wien`: R₁ y C₁ en serie, R₂? ∥ C₂? (sin ellas, iguales) a masa. Piezas `fuente`, `f`?, `r1`, `c1`, `r2`?, `c2`?.
  Mide `salida_*`. 1/β = 1 + R₁/R₂ + C₂/C₁ + j(ωR₁C₂ − 1/(ωR₂C₁)): fase nula y 1/3 en 1/(2πRC) (1 592 Hz con 10 kΩ y
  10 nF). Tarjeta `wien`.
- `desfase`: tres células con C en serie y R a masa; `separadores`? (interruptor) pone seguidores entre ellas. Piezas
  `fuente`, `f`?, `r`, `c`. Mide `salida_*`, `celula1_*`, `celula2_*`. Directas, con x = ωRC:
  |β| = 1/√((1 − 5/x²)² + (1/x³ − 6/x)²), 180° y 1/29 en 1/(2π·√6·RC) (las células dan unos 56°, 56° y 68°); con
  seguidores (x/√(1 + x²))³, 60° por célula y 1/8 en 1/(2π·√3·RC). Tarjeta `desfase`.
- `cristal`: el modelo BVD, R₁ L₁ C₁ en serie en paralelo con C₀; se mide su impedancia (`z_*`, con 1 A) y la corriente
  de la rama serie (`serie_*`). |Z| = √(R₁² + X²)/(ωC₀)/√(R₁² + (X − 1/(ωC₀))²), X = ωL₁ − 1/(ωC₁): R₁ en f_s y el
  máximo C₁/(2C₀) más arriba. Barra en un eje lineal cerca de f_s (Q de 10⁴ a 10⁵) con el eje y en `escala: log`.
  Tarjeta `cristal`.

#### `reductor` — Convertidor reductor (buck) (1.2)

V_in, el interruptor S con un PWM de frecuencia `f` y ciclo `ciclo` (cerrado al principio de cada periodo), diodo de
libre circulación (`vf`?, su caída a la corriente de salida) o rectificador síncrono (sin `vf`, o con `sincrono`?
cerrado), L con su `dcr`?, C con su `esr`? y la carga. Interruptores ideales (1 µΩ). Secciones 33.2, 33.6, 33.7, 33.13
y el problema 33.A.

Mide (frente al tiempo): `nodo` (el de conmutación), `il`, `salida`, `entrada` (la corriente de V_in) y `bajo` (la del
diodo o el síncrono). El transitorio **parte del régimen permanente en conducción continua**: la bobina en su valle
I − ΔI/2 y el condensador en V_out − ΔI·(1 − 2D)/(12·f·C), con V_out = (D·V_in − (1 − D)·V_F)/(1 + DCR/R) e
ΔI = (V_in − V_out − I·DCR)·D/(L·f); en conducción discontinua (diodo y poca carga) ese arranque no es periódico: pida
`asentar` periodos antes del eje (hasta 2 000). Con la fase φ = f·t − floor(f·t): i_L = I − ΔI/2 + ΔI·min(φ/D,
(1 − φ)/(1 − D)); la salida, la parábola de la carga de C más ESR·(i_L − I) (tarjetas `reductor` y `reductor-rizado`:
207 mA de rizado con 12 V, D = 0,417, 47 µH y 300 kHz; 0,9 mV por C con 100 µF y unos 10 mV por 50 mΩ de ESR).

#### `led` con etiqueta de red (1.2, esquemas12d)

`etiqueta`? (interruptor) y `etiqueta2`? en `led`, como en `divisor`: el hilo de la fuente acaba en una etiqueta con
el `sim` de `etiqueta` y R y el LED cuelgan de otra; cerrado, las dos iguales y luce; abierto, la del LED lleva el `sim`
de `etiqueta2` («+5V» frente a «VCC», sección 11.9; una red VCC sin fuente, 12.5) y el LED queda sin alimentación
(corriente 0 y 0 V en el LED: `I = et*max(0, (V - V_F)/R)`, `V_LED = et*(V - I*R)`). Un toque en la etiqueta del LED
la corrige. Tarjeta `led-etiqueta`.

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

1. estar en el texto de **algún bloque citado** en `libro` (también tablas, celda a celda; listas, ejercicios y su
   solución), o
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
- 1.2: los pasos de aprender haciendo, cada uno con sus reglas (§10), y la escalera de pistas (aviso si una pregunta
  no tiene ninguna).

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

## 10. Aprender haciendo (1.2): pistas escalonadas y siete pasos nuevos

### 10.0 Cuándo usarlos

- **Solo donde enseñan algo** que una pregunta no enseña: equivocarse con un número y ver por qué, diseñar con
  tolerancias, razonar con medidas, ajustar con las manos, medir de verdad. **Nunca de adorno**.
- Orientativo: **una de cada tres lecciones** lleva uno (rara vez dos). Sustituye a un `reto` o a una `pregunta`, no se
  suma a ellos. Las secciones de taller, instrumentos y proyectos los piden más; las de teoría pura, menos.
- Cada paso nuevo es **una tarjeta** con `tipo: <paso>` y un bloque del mismo nombre (`simular:`, `diseno:`…). Lleva
  sus campos comunes (`id`, `titulo`, `texto`, `libro`, `fijar`, `inicio`, `widget`, `comprobar`) y las mismas reglas
  de palabras y de números (§6): los números de sus explicaciones salen del libro o del modelo.
- Ejemplos completos y probados de los siete: `web/tests/lecciones12-catalogo/cap01/sec-1.4.yaml` (lección de prueba;
  no se publica). Cópielos.

| tipo | Para qué | Cuándo | Cuenta como pregunta |
|---|---|---|---|
| `simular` | estimar un número con su unidad y ver lo que da el simulador | el error típico es instructivo (olvidar la carga, pico por eficaz) | sí |
| `diseno` | elegir valores E12/E24 que cumplan una especificación **con las tolerancias** | la sección da una especificación y una tolerancia | sí |
| `averia` | medir con el multímetro (y el osciloscopio) y nombrar la pieza averiada | la sección explica síntomas o medidas de diagnóstico | sí |
| `ajuste` | mover un mando hasta que una medida entre en su banda | polarización, compensación de sonda, polos, periodo de muestreo | no (abre «Continuar») |
| `banco` | montarlo en casa, medir y comparar (opcional) | hay una ficha del cuaderno de prácticas o un montaje sencillo | no |
| `dibujar` | dibujar una forma de onda o una curva y compararla | la forma importa más que un número (rectificada, carga RC, Bode) | sí |
| `sql` | consultar la base de ejemplo de la sección 17.10 | solo en la sección de SQLite y SQL | sí |

Los que cuentan como pregunta van también a «Práctica inteligente» y al repaso (deben entenderse solos: §9) y dan XP
una vez. `ajuste` y `banco` no se puntúan.

### 10.1 Explicación por opción y pistas escalonadas (todas las preguntas)

Cada opción ya lleva su `porque` (§4): **en la incorrecta, la confusión que lleva a ella y dónde falla**. Además, toda
tarjeta que se responde (opciones, estimar, ordenar, emparejar, reto y los pasos nuevos) debe llevar su **escalera**:

```yaml
escalera:                      # una o dos pistas, de la más suave a la más directa (≤ 40 palabras cada una)
  - "La carga queda en paralelo con R₂."
  - "Calcule primero R₂ ‖ R_{L} y úsela como resistencia de abajo."
solucion: "Abajo quedan 5 ‖ 10 = 3,33 kΩ: la salida cae a 3,00 V."   # el último peldaño
```

El lector las abre con «Pista», «Otra pista» y «Ver la solución»; la solución sale también sola tras dos fallos. Los
peldaños abiertos cuentan como ayuda en el dominio. El generador **avisa** (no para) de las preguntas sin ninguna pista
(`escalera`, `solucion`, `pistas` o `ayuda`). En lecciones nuevas, póngala siempre; `solucion` sustituye a `ayuda`.

### 10.2 `simular` — Prediga y simule

El lector escribe un número con su unidad («4,2 V», «4k7», «150 m»), lo fija con «Comprobar» (una sola vez) y la app
simula el circuito de la tarjeta con su ngspice y enseña su estimación, lo que da el simulador y el error relativo. La
explicación sale del primer **error típico** que encaja; si ninguno, la app reconoce sola un prefijo equivocado (un
factor mil), el signo, «cerca» o, si no, la primera `pista`.

```yaml
  - id: simule-carga
    tipo: simular
    titulo: "Prediga con la carga"
    texto: "Con 12 V, 10 kΩ y 5 kΩ, y la carga de 10 kΩ conectada: ¿cuánto marca la salida?"
    libro: [83, 84]
    fijar: { V_in: 12, R_1: 10000, R_2: 5000, R_L: 10000, carga: 1 }
    widget:
      tipo: circuito
      esquema: divisor
      piezas: { fuente: V_in, arriba: R_1, abajo: R_2, carga: R_L, interruptor: carga }
      lectura: { valor: V_out, rotulo: "Tensión de salida" }
      mide: { salida: V_out }
      ocultar: true                      # la lectura sale «¿?» hasta que fija la estimación
      mandos: []
    simular:
      objetivo: V_out                    # expresión del modelo: el valor bueno
      unidad: V
      tol: 0.03                          # error relativo que cuenta como acierto
      rotulo: "Tensión de salida, V_{salida}"
      medida: salida                     # la medida de «widget.mide» que simula la app (debe ser el objetivo)
      errores:                           # al menos uno: lo que da la confusión (expr) o una razón estimación/valor
        - { expr: "V_vacio", texto: "Esos 4,00 V son los del divisor en vacío: ha olvidado la carga, que queda en paralelo con R₂." }
        - { razon: { min: 1.35, max: 1.48 }, texto: "Ha usado el valor de pico: el eficaz es √2 veces menor." }
    exito: "La carga baja la rama de abajo y la salida cae a 3,00 V."
```

El generador comprueba: el objetivo da un número; cada `expr` de error da otro valor **fuera** de la tolerancia (si no,
no es un error); una `razon` no incluye la respuesta buena; `medida` es una medida de `widget.mide` que vale lo mismo
que el objetivo (el circuito se comprueba con ngspice como cualquier otro, §5.3).

Sin circuito (sin `medida`, o con una gráfica: un presupuesto de incertidumbre, una fórmula) no se simula nada: la app
compara con el modelo y la ayuda bajo el campo dice «“Comprobar” la fija y se calcula con el modelo» (1.2, motor12e;
tarjeta `simule-modelo` del catálogo de motor12e).

### 10.3 `diseno` — Diseñe con tolerancias

Mandos de serie E12/E24 (o E6 para electrolíticos; §5.1), `condiciones` como un reto (la especificación) y las tolerancias de las piezas. Al
comprobar, la app calcula el diseño nominal y el mismo diseño con las tolerancias: **todas las esquinas** (cada pieza
en sus dos extremos, 2ⁿ placas) o **Monte Carlo** (`muestras` placas con cada pieza al azar, uniforme dentro de su
tolerancia, siempre las mismas) y enseña la banda, el nominal, la dispersión y cuántas placas cumplen.

```yaml
    condiciones:
      - { valor: V_out, objetivo: 3.3, tol: 0.02, rotulo: "Salida: {{V_out}}" }
    diseno:
      tolerancias: { R_1: 0.01, R_2: 0.01 }   # valor del modelo → tolerancia (0.01 = ± 1 %)
      metodo: esquinas                         # o montecarlo (con muestras: 200)
      exigir: todas                            # nominal | todas | 0.95 (fracción de placas que deben cumplir)
      si_tolerancias: "El nominal cumple, pero con ± 5 % no siempre: pase a resistencias del 1 %."   # opcional
    exito: "…"
    pistas: [ … ]                              # como en un reto: una para cada fallo del nominal
```

El generador exige al menos una posición de los mandos que **apruebe con las tolerancias**, que no empiece aprobado,
y las comprobaciones de un reto (§4). Úselo para la lección del libro: con E12 y ± 5 % un divisor de 3,3 V ± 2 % no
sale; el lector lo descubre.

- Un mando de `lista` (un catálogo de disipadores, de cables) vale como valores normalizados: no sale el aviso «sin un
  mando de serie» (1.2, motor12e). Los electrolíticos (± 20 %) se eligen en `serie: E6` (1, 1,5, 2,2, 3,3, 4,7, 6,8).
- El recorrido (`tests/lecciones11-recorrido.spec.ts`) resuelve el diseño con una posición que **aprueba con las
  tolerancias** (esquinas o Monte Carlo, como la app), no con la primera que cumple en nominal: no hace falta ordenar
  las listas ni empezar los mandos lejos para que el recorrido pase (tarjeta `disene-tolerancias` del catálogo de
  motor12e: 2,7 kΩ y 1 kΩ cumplen en nominal y no con el 1 %; 3,9 kΩ y 1,5 kΩ sí).

### 10.4 `averia` — Busque la avería

El circuito de la tarjeta tiene una avería escondida (el dibujo ya muestra la placa averiada: un LED apagado, la
corriente que no circula). El lector mide en los puntos de `sondas` con un multímetro virtual (cada punto nuevo
gasta una de las `pasos` medidas; uno con `curva` sale además en un osciloscopio), elige la pieza y comprueba. Un
sospechoso equivocado se explica **con sus propias medidas** («Si fuera R₁ (abierta), en «Salida» mediría 0 V; usted
ha medido 12,0 V»). Hallada, puede probar «Otra placa con otra avería» (no se puntúa otra vez).

```yaml
    fijar: { V_in: 12, R_1: 10000, R_2: 5000, carga: 0 }
    widget: { tipo: circuito, esquema: divisor, piezas: { fuente: V_in, arriba: R_1, abajo: R_2 }, mide: { salida: V_out, corriente: I }, mandos: [] }
    averia:
      pasos: 2                                 # medidas permitidas
      eleccion: fija                           # fija: por orden, una por ronda; azar: otra al azar cada vez que se abre
      preguntar_tipo: false                    # true: además, qué le pasa (abierta, corto…)
      sospechosos:
        - { id: r1, rotulo: "R₁" }
        - { id: r2, rotulo: "R₂" }
      sondas:
        - { id: salida, rotulo: "Salida", valor: V_out }
        - { id: corriente, rotulo: "Corriente", valor: I }
        # osciloscopio: { …, curva: { expr: "…t…", x: { id: t, min: 0, max: 0.04, unidad: s, rotulo: "t" }, y: { min: -15, max: 15, unidad: V, rotulo: "v" } } }
      fallos:                                  # tipo: abierta, corto, alto, bajo, reves, base-abierta o valor
        - { id: r2-abierta, pieza: r2, tipo: abierta, con: { R_2: 1e9 }, texto: "R₂ abierta: no circula corriente y la salida sube hasta la tensión de la pila." }
        - { id: r1-abierta, pieza: r1, tipo: abierta, con: { R_1: 1e9 }, texto: "…" }
        - { id: r2-corto, pieza: r2, tipo: corto, con: { R_2: 0.001 }, texto: "…" }
```

- Una avería son **valores del modelo** con la pieza rota: abierta `1e9` Ω, corto `1e-3` Ω, otro valor; un diodo al
  revés o un transistor averiado, con un interruptor del modelo que su cálculo use. Cada avería se simula con ngspice
  como un estado más (§5.3).
- El widget no lleva `lectura`, `barras`, `datos` ni mandos (se mide con las sondas). El multímetro tiene la resolución
  de un milésimo de la mayor lectura de cada punto: por debajo, lee 0.
- El generador comprueba: cada avería se distingue del circuito sano en alguna sonda; dos averías de piezas distintas
  se distinguen en alguna (si no, añada una sonda); cada sospechoso tiene al menos una avería (para poder explicar por
  qué no es él); y avisa si con `pasos` medidas fijas no se distinguen todas.
- `eleccion: azar` se puede recorrer (1.2, motor12e): el recorrido mide como el lector y deduce la avería de lo que
  marca el multímetro en cada sonda. Ponga primero las sondas que separan las averías (con las `pasos` primeras deben
  quedar como mucho dos posibles); tarjeta `averia-azar` del catálogo de motor12e.

### 10.5 `ajuste` — Ajuste hasta la banda

Un mando o varios (el deslizador, o la pieza del esquema, que se arrastra) y un medidor con la banda: la aguja se mueve en vivo
y el texto dice hacia dónde ir. «Continuar» se abre dentro de la banda.

```yaml
    inicio: { R_2: 500 }                       # que no empiece dentro
    widget: { tipo: circuito, esquema: divisor, …, mandos: [ { valor: R_2, min: 100, max: 5000, paso: 10 } ] }
    ajuste:
      valor: V_out
      objetivo: 3.3                            # o min / max
      tol: 0.02
      rotulo: "Salida"
      escala: { min: 0, max: 5 }               # opcional (por defecto, la banda ± 3 anchos)
      bajo: "Falta tensión: suba R₂."
      alto: "Sobra tensión: baje R₂."
      dentro: "Dentro de la banda."
```

El generador comprueba que alguna posición entra en la banda y que no se empieza dentro.

**Banda abierta (1.2, motor12e).** Una especificación de un solo lado («el año cabe en 3 000 mA·h», «la vida, al menos
10 años», «no pasar de 110 °C») es una banda con solo `max` o solo `min`; el consejo del lado que no existe no hace
falta (si lo pone, avisa). La escala del medidor, si no la da, va de lo que alcanzan los mandos al borde de la banda
(sin pasar de 0 si la magnitud no cambia de signo). El generador comprueba además que no se esté dentro en todas las
posiciones (no habría nada que ajustar). Tarjetas `ajuste-consumo` y `ajuste-minimo` del catálogo de motor12e:

```yaml
    ajuste:
      valor: I
      max: 0.002                               # solo un máximo: dentro por debajo de 2 mA
      rotulo: "Consumo"
      alto: "Consume demasiado: suba R₁."      # (sin «bajo»: nunca se diría)
      dentro: "Por debajo de 2 mA."
```

**Dos mandos (1.2, motor12e).** Un `ajuste` puede llevar varios mandos en su widget (colocar dos polos con k₁ y k₂, un
divisor con R₁ y R₂): el medidor sigue a la medida, que depende de todos, y el generador recorre todas sus
combinaciones (hasta 250 000) buscando una dentro de la banda. Los consejos `bajo`/`alto` deben decir qué mover
(«suba R₂ o baje R₁»). Tarjeta `ajuste-dos` del catálogo de motor12e. Para dos condiciones a la vez (ω_n y σ), sigue
siendo un `reto` con dos `condiciones`.

### 10.6 `banco` — En el banco (opcional)

Para montarlo de verdad: lo que hace falta, qué medir, lo que debería leer con su tolerancia; el lector escribe lo
que ha medido y la app lo compara y aconseja. Siempre se puede seguir sin hacerlo; nada se guarda.

```yaml
    banco:
      piezas: ["Fuente de 12 V", "R₁ = 10 kΩ y R₂ = 5 kΩ", "Brymen en V⎓"]
      medir: "La tensión entre la salida y masa, sin carga."
      esperado: V_out                          # expresión del modelo
      unidad: V
      tol: 0.05                                # tolerancias de las piezas y del instrumento
      consejos:                                # el primero que se cumple; «desviacion» = medida/esperado − 1, o «medida»
        - { cuando: { valor: desviacion, mayor: 0.05 }, texto: "Mide de más: compruebe que R₂ es la de abajo." }
        - { texto: "Mide de menos: ¿queda algo conectado a la salida, como una carga?" }
      ficha: { n: 1, titulo: "El voltímetro forma parte del circuito" }   # la del cuaderno de prácticas, si la hay
```

### 10.7 `dibujar` — Dibuje la forma de onda

El lector dibuja la curva sobre los ejes con el dedo o el ratón (o, con el teclado, punto a punto: «◀ ▶» o Mayús + ←/→
eligen el punto y el deslizador su valor). Al comprobar se compara con la curva del modelo: el error es el valor
eficaz de la diferencia sobre la altura del eje, perdonando un pequeño desfase en x y un pequeño escalón en y
(`holgura`). Tras acertar o dos fallos se dibuja la curva buena encima. Las pistas pueden mirar `error`, `amplitud`
(1 = la buena), `media` (+ = dibujada alta) y `desfase` (+ = tarde).

```yaml
    dibujar:
      x: { id: r, min: 0, max: 20000, unidad: Ω, rotulo: "R₂" }   # el id no es del modelo
      y: { min: 0, max: 12, unidad: V, rotulo: "V_{salida}" }
      curva: "V_in*r/(R_1 + r)"
      puntos: 21                               # de 9 a 61
      tol: 0.08                                # error que cuenta como acierto (8 % de la altura)
      holgura: 0.03
      rotulo: "La salida frente a R₂"
    exito: "…"
```

El generador exige que la curva quepa en el eje y y avisa si es casi plana.

**Eje x logarítmico (1.2).** Para dibujar un Bode frente a la frecuencia, `escala: log` en `x` (como en las gráficas,
§5.2; el eje empieza por encima de 0, y el eje y es siempre lineal): los puntos van espaciados por igual en log x (con
`puntos: 17` y cuatro décadas, cuatro por década), las marcas son las de las gráficas y el desfase que se perdona
(`holgura`) y el que miran las pistas (`desfase`) son fracciones del eje en esa escala (0,25 = una década de cuatro).

```yaml
    dibujar:
      x: { id: nu, min: 10, max: 100000, unidad: Hz, rotulo: "f", escala: log }
      y: { min: -45, max: 5, unidad: dB, rotulo: "|H|" }
      curva: "-10*log10(1 + (nu/f_c)^2)"
      puntos: 17
```

### 10.8 `sql` — SQL con la base de ejemplo (sección 17.10)

SQLite compilado a WebAssembly, sin red, sobre una **base de ejemplo** con el esquema del libro (`sensores`, `medidas`,
`horas`) y datos que la app genera (cuatro sensores cada 10 minutos, del 25 de febrero al 3 de abril de 2026: no son
medidas reales; dígalo si importa). El lector ejecuta, ve la tabla o el error explicado en español y comprueba: se
compara su resultado con el de la solución (columnas por su número, filas y valores; el orden solo si la solución
lleva ORDER BY). Tres modos:

```yaml
    sql:                                       # consulta: la escribe entera
      modo: consulta
      inicial: "SELECT s.nombre, count(*) AS n\nFROM medidas AS m JOIN sensores AS s ON s.id = m.sensor\n"
      solucion: "SELECT s.nombre, count(*) AS n FROM medidas AS m JOIN sensores AS s ON s.id = m.sensor GROUP BY s.id ORDER BY s.id"
    sql:                                       # rellenar: huecos [[1]], [[2]]… con opciones o texto libre
      modo: rellenar
      plantilla: "SELECT date(t, 'unixepoch') AS dia, [[1]](valor) AS maxima FROM medidas WHERE sensor = 1 GROUP BY [[2]] ORDER BY dia;"
      huecos: [ { solucion: max, opciones: [max, min, avg, count] }, { solucion: dia } ]
    sql:                                       # ordenar: las cláusulas en su orden (la app las baraja siempre igual)
      modo: ordenar
      clausulas: ["SELECT sensor, count(*) AS n", "FROM medidas", "WHERE valor > 0", "GROUP BY sensor", "ORDER BY sensor;"]
```

El generador ejecuta la solución con el mismo SQLite: debe funcionar, devolver de 1 a 200 filas y **no depender del
día** (sin `now`, `random`, `current_date`); guarda su resultado en la lección. Las consultas del libro valen tal cual
salvo las que usan `'now'`: cámbielas por fechas de marzo de 2026.

## 11. Figuras y circuitos lógicos (1.2): `figura`, `logica` y sus pasos

Dos widgets más, para lo que no es un esquema analógico: **`figura`** (una figura o foto del libro, o una foto de
placa del explorador «Consolas», con zonas que se tocan) y **`logica`** (un circuito digital vivo: puertas,
biestables, contador, multiplexor, decodificador, interruptores, reloj y LED, con su cronograma y su tabla de verdad).
Con ellos van dos pasos nuevos (`tocar` y `tabla`) y tres modos de pasos que ya existían (`averia`, `diseno` y
`dibujar` sobre un circuito lógico). Ejemplos completos y probados de todos:
`web/tests/lecciones12-catalogo/cap29/sec-29.2.yaml` (lección de prueba; no se publica). Cópielos.

| tipo de tarjeta | widget | Para qué | Cuenta como pregunta |
|---|---|---|---|
| `explorar` | `figura` | tocar zonas y leer qué es cada una | no |
| `explorar` | `logica` | mover interruptores, dar pulsos de reloj, mover el cursor del cronograma | no |
| `predecir` / `pregunta` | `logica` con `ocultar: true` | prediga la salida: los LED dicen «?» y los interruptores no se mueven | sí |
| `tocar` | `figura` | «toque el defecto», «toque la pieza»: la zona es la respuesta | sí |
| `tabla` | `logica` | rellenar la tabla de verdad, comprobada con el circuito | sí |
| `averia` | `logica` | buscar la avería con la sonda lógica | sí |
| `diseno` | `logica` | construir una función con el mínimo de puertas | sí |
| `dibujar` | `logica` con `cronograma` | dibujar una señal tramo a tramo (modo digital, ajustado a los flancos) | sí |

Una lección sin valores numéricos lleva `modelo: { valores: {}, calculos: {} }`. Los números de los textos siguen la
regla de §6 (los «0» y «1» de los niveles están en las tablas del libro: cítelas).

### 11.1 `figura` — Una figura o foto con zonas

```yaml
widget:
  tipo: figura
  figura: fig-13.5                 # la etiqueta de la figura (de cualquier parte), o el bloque «cap13#64»
  # imagen: img/foto_nes.jpg       # o una foto del libro sin figura (web/public/libro/img/)
  # consola: { maquina: nes, foto: cara-a }   # o una foto del explorador (sin «foto»: la principal)
  zonas:
    - { id: fria, rotulo: "Arriba en el centro", rect: [159, 2, 136, 126], texto: "Fría: mate y grumosa." }
    - { id: puente, rotulo: "Abajo en el centro", poligono: [[159, 138], [295, 138], [295, 270], [159, 270]] }
    - { id: decodificador, hotspot: U3, rotulo: "Chip pequeño, arriba a la izquierda" }   # solo en fotos de consola
```

- Coordenadas **de la propia figura**: las del `svg_vista` de una figura SVG del libro (la etiqueta y el tamaño se ven
  en `partes/<parte>.json`), o los píxeles de una foto. `rect: [x, y, ancho, alto]`; `poligono` de 3 a 24 puntos.
- `hotspot`: la caja de una pieza ya identificada en el explorador (`web/public/consolas/<maquina>.json`, sus
  `hotspots` con `cajas`): el curso «Consolas por dentro» reutiliza así las piezas identificadas. Sin `rotulo` ni
  `texto`, toma su nombre y su pieza del explorador.
- `rotulo`: el nombre de la zona en la **lista de zonas** (teclado y lector de pantalla; ≤ 8 palabras). En una
  pregunta, **neutro** («Arriba en el centro», «Chip largo, a la izquierda»): un rótulo que dice «Puente» responde la
  pregunta. `texto`: lo que se lee al tocarla en una tarjeta `explorar` (≤ 40 palabras, números del libro).
- 1 a 12 zonas. El generador avisa de una zona que en un teléfono mide menos de 24 px (se puede ampliar con «+» o con
  dos dedos, y está la lista, pero conviene que se pueda tocar) y de dos zonas que se tapan en más de la mitad (un
  toque elige la más pequeña).
- `explorar` con figura: `requiere: { mover: [fria, puente] }` pide tocar esas zonas (sin él, una cualquiera).
- La figura SVG sale sobre la placa de figuras del libro (también en oscuro y sepia); la foto, con su crédito.

**Un listado de código (1.2, motor12e).** En lugar de una figura, `codigo`: un bloque de código del libro
(`codigo: "apK#20"`) o uno propio (`codigo: { lenguaje: c, texto: "…" }`, para citar solo el trozo que importa; como
mucho 40 líneas). Sale en letra de ancho fijo, con los comentarios atenuados y las líneas de `resaltar` marcadas; el
lector de pantalla lo lee entero, línea a línea. Sin zonas, es el visual de una pregunta («¿qué hace este
fragmento?»); con zonas, cada una son **líneas enteras** (`lineas: [5]` o `[5, 7]`) y vale para `explorar` y `tocar`
como las de una figura. Tarjetas `pregunta-relleno` y `toque-campo` del catálogo de motor12e:

```yaml
widget:
  tipo: figura
  codigo: "apK#20"                 # el bloque «codigo» del libro (o { lenguaje: c, texto: "…" })
  resaltar: [3, 4, 5, 6, 7]        # opcional: líneas marcadas (1 = la primera)
  zonas:                           # opcional: para tocar líneas
    - { id: instante, lineas: [5], rotulo: "Segundo campo" }
```

### 11.2 `logica` — Un circuito lógico vivo

```yaml
widget:
  tipo: logica
  entradas: [A, B, { id: CLK, reloj: true }, { id: EN, valor: 1, rotulo: "EN" }]   # interruptores (y un reloj)
  piezas:
    - { id: n1, tipo: nand, entradas: [A, B] }            # and, or, not, nand, nor, xor, xnor, buf (2–4 entradas)
    - { id: f1, tipo: d, entradas: [f1.nq, CLK] }        # d [D, CLK] · jk [J, K, CLK] · t [T, CLK]; salidas f1.q, f1.nq
    - { id: c1, tipo: contador, bits: 4, modulo: 10, entradas: [CLK] }   # [CLK] o [CLK, R]; salidas c1.q0 … c1.q3
    - { id: l1, tipo: latch, entradas: [D, EN] }         # cerrojo D (1.2, motor12e): copia D mientras EN = 1; l1.q, l1.nq
    - { id: m1, tipo: mux, bits: 1, entradas: [A, B, EN] }   # [S0…, D0…]; salida m1
    - { id: d1, tipo: decodificador, bits: 2, entradas: [A, B, EN] }   # [A0…, EN?]; salidas d1.y0 … d1.y3
  salidas:
    - { id: Y, de: n1 }                                   # un LED por salida
  tabla: true                                             # opcional: su tabla de verdad debajo, con la fila marcada
  cronograma: { ciclos: 4, estimulo: { A: "0110" }, senales: [CLK, A, Y] }   # opcional (§11.7)
  ocultar: false                                          # true: LED «?» e interruptores quietos hasta responder
```

- Una entrada puede leer `0` o `1` fijos (una patilla a masa o a la alimentación). Hasta 6 entradas, 16 piezas y
  8 LED. Ids de piezas en minúsculas (`n1`, `ff-a`); entradas y LED con letras y cifras (`A`, `CLK`, `Q0`).
- La simulación es **por eventos, determinista**: cada pieza tarda una unidad; un biestable toma su entrada en el
  **flanco de subida**, así que dos biestables del mismo reloj desplazan una etapa por flanco (registro) y un D con su
  Q̄ en su D divide por dos. Al encender, los biestables valen su `inicial` (0) y un cerrojo de dos NAND cae en uno de
  sus dos estados. El generador rechaza un circuito que **oscila** (un anillo de inversores).
- El dibujo se hace solo (entradas a la izquierda, LED a la derecha, cada pieza tras su fuente, cables en ángulo recto
  con puntos de unión). Cada cable lleva el color de su nivel (1 rojo y grueso, 0 azul y fino) y su «1»/«0» escrito.
- Se toca el interruptor dibujado o su botón (teclado); el reloj, con «Pulso de reloj»; «Reiniciar» vuelve al
  encendido. El lector de pantalla oye la descripción del circuito y el estado de los LED.
- `explorar` con circuito: `requiere: { mover: [A, B] }` pide cambiar esas entradas; con cronograma, mover el cursor.
- **Predecir la salida**: `predecir` (o `pregunta`) con `opciones` y `ocultar: true`; ponga en `entradas` los `valor`
  de la combinación por la que pregunta (los interruptores no se mueven hasta responder).

### 11.3 `tocar` — Toque la zona

```yaml
  - id: toque-puente
    tipo: tocar
    titulo: "Un cortocircuito"
    texto: "Toque la unión que cortocircuita dos islas."
    libro: ["cap13#64"]
    widget: { tipo: figura, figura: fig-13.5, zonas: [ … ] }
    tocar:
      bien: [puente]                 # una o varias zonas buenas
      todas: false                   # true: hay que tocar todas las buenas (y ninguna mala)
      porque:                        # cada zona que no es la buena, con su porqué (≤ 40 palabras)
        fria: "Está mate y grumosa, pero en una sola isla."
        …
    exito: "El puente une dos islas vecinas: un cortocircuito."
    escalera: ["Busque la que toca dos patillas."]
    solucion: "Abajo en el centro: el estaño une las dos islas."
```

Se toca en la figura o en la lista. Una zona mala se explica con su `porque` y queda tachada; la buena se marca al
acertar. Las pistas (`pistas`) pueden mirar `mal` (zonas malas elegidas) y `faltan` (buenas sin tocar).

### 11.4 `tabla` — Rellene la tabla de verdad

```yaml
    widget: { tipo: logica, entradas: [A, B], piezas: [ … ], salidas: [ { id: Y, de: n3 } ], ocultar: true }
    tabla:
      salidas: [Y]                   # las columnas que rellena (por defecto, todos los LED); de 1 a 3
    exito: "Es la OR: una NAND con las entradas invertidas."
```

Las filas salen solas del circuito (de 1 a 4 entradas, en orden binario: 00, 01, 10, 11); cada celda se pulsa para
poner 0 o 1. Al comprobar se marcan las filas mal. Con `ocultar: true` el lector razona sin ver el LED; sin él, puede
probar en el circuito y anotar (también es aprender). Solo circuitos combinacionales. Pistas: `error` (fracción de
filas mal), `filas_mal`.

### 11.5 `averia` en un circuito lógico — Con la sonda lógica

```yaml
    widget: { tipo: logica, entradas: [A, B], piezas: [ { id: n1, tipo: nand, entradas: [A, A], rotulo: "N1" }, … ], salidas: [ { id: Y, de: n3 } ] }
    averia:
      sospechosos: [ { id: n1, rotulo: "N1 (invierte A)" }, … ]   # piezas (por defecto, todas)
      fallos:
        - { id: n3-al-aire, pieza: n3, tipo: sin-conexion, pin: 1, texto: "…en TTL tiende a leerse como un 1." }
        - { id: n1-a-cero, pieza: n1, tipo: atascada-0, texto: "…" }    # atascada-0 | atascada-1 (su salida, o `senal`)
      # puntos: [ { id, rotulo, senal | pieza + pin } ]   # por defecto, cada cable (y cada patilla si hay «sin-conexion»)
      # pasos: 6                                          # medidas permitidas (por defecto, sin límite)
      eleccion: fija                                      # o azar
      preguntar_tipo: false
```

El lector mueve los interruptores, mide con la **sonda lógica** (un toque en un cable, o el punto elegido en la lista
y «Medir»: ALTO, BAJO o sin nivel en una patilla al aire) y elige la pieza. Los cables no muestran su nivel (lo dice
la sonda); los LED sí, son el síntoma. Una entrada sin conectar **se lee como 1** (TTL, sección 9.3). Un sospechoso
equivocado se explica con una de sus medidas («Si fuera N1 (salida atascada a 0), con A = 0, B = 0 la sonda en
«Salida de N1» marcaría nivel bajo (0); usted midió nivel alto (1).»). El generador comprueba que cada avería se ve
con alguna combinación en algún punto y que las de piezas distintas se distinguen. Solo combinacionales; sin `ocultar`
ni cronograma.

### 11.6 `diseno` en un circuito lógico — Con el mínimo de puertas

```yaml
    widget: { tipo: logica, entradas: [A, B], piezas: [], salidas: [ { id: Y, de: "0" } ] }   # sin piezas
    diseno:
      salida: Y
      permitidas: [nand]             # las puertas de la paleta
      referencia:                    # un circuito mínimo (p1, p2… son las puertas anteriores)
        - { tipo: nand, entradas: [A, A] }
        - { tipo: nand, entradas: [B, B] }
        - { tipo: nand, entradas: [p1, p2] }
      # columna: "0111"              # opcional: la salida fila a fila (debe coincidir con la referencia)
      exigir_minimo: true            # true: solo vale con el mínimo; false: vale y se le dice que se puede con menos
      # max_puertas: 6
    exito: "Dos inversores y una tercera NAND: la OR del banco."
```

El lector añade puertas, elige su tipo y sus entradas en listas, conecta el LED y prueba moviendo los interruptores;
al comprobar se compara la tabla de verdad («Con A = 0, B = 0 su circuito da 1 y debe dar 0.») y se cuentan las
puertas. El generador **busca un circuito más pequeño** con las puertas permitidas (todas las combinaciones hasta el
mínimo − 1): si existe, es un error; si la búsqueda es demasiado grande, lo avisa. No necesita `pistas` (puede llevar;
miran `puertas`).

### 11.7 `dibujar` en modo digital y el cronograma

```yaml
    widget:
      tipo: logica
      entradas: [{ id: CLK, reloj: true }]
      piezas: [ { id: f1, tipo: d, entradas: [f1.nq, CLK] } ]
      salidas: [ { id: Q, de: f1.q } ]
      cronograma: { ciclos: 4, senales: [CLK] }   # filas: entradas, reloj, señales o LED
      dibujo: false                               # solo el cronograma (el circuito se vio antes)
    dibujar:
      senal: Q                                    # la señal (o LED) que se dibuja
```

El **cronograma** tiene dos tramos por ciclo: el reloj bajo (las entradas de `estimulo` cambian ahí, una cifra por
ciclo) y el reloj alto (el flanco de subida en medio del ciclo, con las entradas quietas). En una tarjeta `explorar`
el lector mueve el cursor (un deslizador) y el circuito enseña ese momento: compare el reloj con Q. En `dibujar` el
lector pone el nivel de cada tramo (tocar arriba o abajo, arrastrar; con el teclado ← → y ↑ ↓): el dibujo solo cambia
en los flancos. Al comprobar se marcan los tramos mal y se dice el primer ciclo con error; tras acertar o dos fallos se
dibuja la onda buena. Pistas: `error` (fracción de tramos mal), `tramos_mal`.

**Nombres de los ciclos (1.2, motor12e).** `etiquetas` en el cronograma, uno por ciclo y de hasta 6 caracteres,
sustituye 1…N bajo los flancos: una trama UART bit a bit, un arbitraje CAN. El cursor y el aviso de un dibujo mal
también los dicen («ciclo 2 (inicio)»). Tarjeta `explore-ciclos` del catálogo de motor12e:

```yaml
      cronograma: { ciclos: 4, senales: [CLK, Q], etiquetas: [reposo, inicio, dato, fin] }
```

### 11.8 Otros cambios de 1.2 (motor12c)

- Nombres de un mando de lista con cifras (§5.1): «Sn63Pb37», «SAC305», «0805», «12-0-12» valen; un nombre que es su
  propio valor, no.
- `averia` (§10.4): el aviso «hacen falta N medidas fijas» ya no sale cuando `pasos` ≥ log₂(averías + 1) redondeado
  arriba (una bisección, eligiendo cada medida tras la anterior) o con `adaptativa: true`.
- Avisos nuevos: un `widget` de circuito o gráfica con `ocultar: true` y sin `lectura` (no oculta nada); un `estimar`
  cuyo `inicio` está en el extremo del deslizador más alejado del objetivo (no se puede fallar por los dos lados).

### 11.9 Otros cambios de 1.2 (motor12e)

- **Números de las tablas** (§6): las celdas de una tabla citada se leen una a una. Antes «4», «5», «5», «100» de
  celdas vecinas se leían como «5 100» (un número con separador de miles) y el 4, el 5 o el 100 de la tabla no se
  podían escribir. Las citas literales siguen buscándose en el texto seguido.
- Funciones nuevas del modelo: `erfc`, `erf` y `ruido(x, semilla)` (§3.2); `asin`, `acos` y `log2` ya existían.
- Gráficas (§5.2): curvas paramétricas, palitos, `aspecto: igual`, `ocultar: curvas` y `oculta`, y marcas de los ejes
  con las cifras que hacen falta.
- Pasos (§10): `ajuste` de banda abierta y de varios mandos; `simular` sin circuito dice «se calcula con el modelo»;
  `diseno` con un mando de `lista` sin aviso de serie E; `formula` con una ecuación de dentro de un bloque (§4,
  «Fórmula»); nombres de ciclo en el cronograma (§11.7); el aviso de una coma decimal en `nombres` (§5.1).
- Recorrido (`tests/lecciones11-recorrido.spec.ts`): un `diseno` se resuelve con una posición que aprueba con las
  tolerancias; una `averia` con `eleccion: azar` se sigue por lo que mide el multímetro; un `ajuste` busca entre todos
  sus mandos; con `EPA_RECORRER_CATALOGO=1` recorre las lecciones de catálogo de `web/tests/lecciones12-catalogo/`
  (generadas al vuelo) en lugar de las publicadas.
- Listados de código como figura (`codigo`, `resaltar`, zonas de `lineas`: §11.1) y el **cerrojo D** (`tipo: latch`,
  sensible al nivel: §11.2). Con la habilitación del cerrojo en el reloj invertido y el estímulo cambiando con el reloj
  bajo, el cronograma enseña la diferencia con el biestable: el cerrojo cambia medio ciclo antes (tarjeta
  `explore-latch` del catálogo de motor12e).
- No hechos (pedirlos de nuevo si hacen falta): las salidas de colector abierto y tri-estado (necesitan un nivel «Z»
  y redes con varios conductores en la simulación y en el dibujo) y el perro guardián; véase el estado de motor12e en
  las peticiones.

## 12. Lecciones que no son secciones del libro: «Consolas por dentro» (1.2)

El curso 11, «Consolas por dentro» (`cursos.ts`, id `consolas`), recorre las placas de las siete consolas del
explorador «Consolas», en su orden (NES, Neo Geo AES, Master System II, Mega Drive, Game Boy, Game Boy Color, Super
Nintendo). Sus lecciones no son secciones del libro, pero se escriben, se comprueban y se publican igual que las demás:
el mismo YAML, las mismas tarjetas y pasos, el mismo generador, el mismo recorrido. Solo cambia de dónde salen los
bloques que se citan.

### 12.1 Dónde va

```
contenido/lecciones11/consolas.yaml                    # el manifiesto: partes, lecciones (label y título) y fuentes externas
contenido/lecciones11/consola-<maquina>/<label>.yaml   # una lección, p. ej. consola-snes/snes-relojes.yaml
```

- Cada consola es una **parte** `consola-<maquina>` (`nes`, `neogeo`, `sms`, `megadrive`, `gb`, `gbc`, `snes`). Sus
  lecciones son las de su entrada del manifiesto, **en ese orden** y con ese **título** (el YAML no lleva `titulo`).
  Una lección que no esté en el manifiesto da «no existe la sección». El `label` (`snes-relojes`) es la clave del
  progreso: no lo cambie una vez publicada.
- Siete lecciones por consola, siempre las mismas ideas: `<m>-placa` (la placa de un vistazo, sobre la foto),
  `<m>-alimentacion`, `<m>-relojes` (cristales y divisores, PAL y NTSC), `<m>-buses` (buses y decodificación),
  `<m>-video-audio`, `<m>-bloqueo` (bloqueo regional) y `<m>-averias` (averías típicas y reparación).
- Se publican en `web/public/libro/lecciones11/consola-<maquina>/<label>.json`, con su entrada en `indice.json`, y el
  generador escribe además `lecciones11/partes.json`: las siete partes (tipo `consola`, solo con las lecciones ya
  escritas). La app las añade al índice del libro al arrancar (`lib/partes-extra.ts`, `lib/datos.ts`) y
  `conceptos11.mjs` también, así que el curso, el mapa del curso, el progreso, el dominio, el repaso y «Práctica
  inteligente» las tratan como capítulos. No están en ningún tomo: el lector del libro no las enseña.

### 12.2 Qué se cita: los datos de la consola, sus fuentes y el libro

La regla de §1 (nunca inventar) se cumple con otra fuente, aprobada por el propietario (12-11): **los datos del
explorador de la consola**, **los capítulos del libro** con los que se relaciona y, en las lecciones de averías y
reparación, **fuentes externas** (manuales de servicio, ConsoleMods…), cada hecho con su fuente. El generador
(`scripts/consolas11.mjs`) los convierte en bloques que se citan como los del libro:

| Clave | Qué es |
|---|---|
| `"snes#26": "un 65C816 que gobierna el bus A y el bus B"` | un bloque de los datos de la consola: aviso, fotos y cada zona de cada foto (`hotspots`), equivalencias, notas, revisiones, fuentes, buses, los bloques del diagrama de arquitectura, el decodificador sobre las direcciones de ejemplo del explorador, los hechos externos del manifiesto y las redes de alimentación del esquema |
| `"cap37#331": "1,789773 MHz"` | un bloque del libro, como siempre (de cualquier parte) |

Para ver los bloques de una consola y su número:

```sh
cd web && node --input-type=module -e "
const { src } = await import('./scripts/libro-node.mjs');
const { consolas11 } = await import('./scripts/consolas11.mjs');
const c = await consolas11({ fuentes: '../contenido/lecciones11', publico: 'public', src });
c.bloques('snes').forEach((b, i) => console.log(i, b.html.slice(0, 140)));"
```

Los números siguen la regla de §6: cada cifra de una tarjeta está en un bloque citado (datos de la consola, libro o
hecho externo) o la da el modelo. Si el índice de un bloque se mueve (se añade una foto o un hecho), el generador lo
encuentra por su cita, como con el libro.

**Fuentes externas.** Van en el manifiesto, en la entrada de la consola, con su título y su dirección; cada `hechos`
es lo que **dice la página**, en español, y se convierte en un bloque citable de la consola. Escriba solo lo que la
página dice (léala antes); lo que no pueda apoyar en una fuente, déjelo fuera.

```yaml
  consola-snes:
    maquina: snes
    titulo: "Super Nintendo"
    lecciones:
      - { label: snes-placa, titulo: "La placa de la Super Nintendo de un vistazo" }
    externas:
      - titulo: "ConsoleMods, «SNES:Power Supply Fuse»"
        url: "https://consolemods.org/wiki/SNES:Power_Supply_Fuse"
        hechos:
          - "Fusible de la SNES y la Super Famicom originales: axial, rápido, de 125 V y 1,5 A; no se debe poner uno lento."
```

**Lo que ve el lector.** Bajo cada tarjeta de una lección de consola, en lugar de «Del libro: sección…», salen sus
fuentes: «Fuente: Explorador «Consolas» · Super Nintendo: …» (la vista del explorador del primer dato que cita),
«Fuente: ConsoleMods, …» (la página externa, que se abre fuera) y «Del libro: sección 8.4» (la sección de cada bloque
del libro que cita). No hay lección por pasos de la 1.0; «Cerrar» y «Volver al curso» llevan al curso.

### 12.3 Las fotos de las placas: `figura` con `consola`

Las tarjetas de estas lecciones ponen casi siempre la foto de la placa encima (§11.1): `widget: { tipo: figura,
consola: { maquina, foto }, zonas }`, con zonas `hotspot` (las piezas ya identificadas en el explorador). Las fotos de
cada consola están en `web/public/consolas/<maquina>.json` (`foto`, la principal, y `fotos`); por ejemplo, la NES tiene
solo la principal (la de la figura 38.16 del libro: sin `foto`), y la Super Nintendo `cara-a` (la placa PAL desnuda, la
principal), `ntsc` (la placa NTSC con sus chips) y `cara-b` (la cara de soldadura PAL). Use la foto que **enseñe la
pieza**: una zona sobre una placa desnuda marca el sitio de la pieza, no la pieza.

Tarjeta de catálogo probada (la `toque-cpu` de `consola-snes/snes-placa.yaml`, recorrida por
`tests/lecciones11-recorrido.spec.ts`):

```yaml
  - id: toque-cpu
    tipo: tocar
    titulo: "¿Cuál es la CPU?"
    texto: "Toque el chip que gobierna los dos buses de la consola."
    libro: ["snes#26", "snes#27", "snes#28", "snes#30"]
    widget:
      tipo: figura
      consola: { maquina: snes, foto: ntsc }
      zonas:
        - { id: cpu, hotspot: n-cpu, rotulo: "Chip cuadrado, abajo a la derecha" }   # rótulo neutro en una pregunta
        - { id: ppu1, hotspot: n-ppu1, rotulo: "Chip cuadrado, en el centro a la derecha" }
        - { id: ppu2, hotspot: n-ppu2, rotulo: "Chip cuadrado, en el centro" }
        - { id: wram, hotspot: n-wram, rotulo: "Chip alargado, abajo en el centro" }
    tocar:
      bien: [cpu]
      porque:
        ppu1: "Es la PPU1: lee la memoria de vídeo, no gobierna los buses."
        ppu2: "Es la PPU2: mezcla las capas y saca el vídeo."
        wram: "Es la WRAM, la memoria de trabajo: contesta a la CPU, no la gobierna."
    exito: "La S-CPU B, un 65C816: gobierna el bus A y el bus B."
    escalera: ["Lea las marcas: busque «S-CPU».", "Es el chip cuadrado de abajo a la derecha, junto a la WRAM."]
    solucion: "Abajo a la derecha: Nintendo S-CPU B, 5A22-02."
```

Las zonas pequeñas de una placa entera dan el aviso «en un teléfono mide menos de 24 px» (§11.1): se ve con «+» y
está la lista de zonas; no es un error.

**Una avería sobre la foto.** Un paso `averia` (§10.4) puede llevar la foto de la placa como widget en lugar de un
circuito: el multímetro mide los valores del modelo en las `sondas` y la foto enseña dónde está cada pieza (tarjeta
`averia-no-enciende` de `consola-snes/snes-averias.yaml`: adaptador, fusible o 7805, con la tensión de la clavija, la
continuidad del fusible y la salida del regulador; `averia-vias` de `consola-nes/nes-alimentacion.yaml`: dos
condensadores de desacoplo en dos vías). Cada valor del modelo sale de una fuente citada (10 V del adaptador SNS-002,
5 V del 7805…).

### 12.4 Qué paso para qué idea

- **La placa**: `explorar` y `tocar` sobre la foto, `emparejar` marca ↔ papel.
- **Alimentación**: `ordenar` el camino de la corriente, `ajuste` del dropout del 78xx (§8.4 del libro), `formula`
  de la potencia disipada, `averia` en las vías.
- **Relojes**: `simular` (prediga el reloj de un acceso: XIN ÷ ciclos), `ajuste` de un divisor o de las líneas por
  cuadro hasta la frecuencia de la norma, `formula` con la ecuación del libro cuando la hay (sección 38.11 para la NES).
- **Buses**: un circuito `logica` con el decodificador de la placa (las mitades del 74LS139, los bits altos del bus B)
  y su `tabla`, `emparejar` dirección ↔ selección, los espejos por la decodificación incompleta.
- **Vídeo y sonido**: `ordenar` el camino, `tocar` la etapa.
- **Bloqueo**: `logica` y `tabla` de cuándo sale del reset, `estimar` el periodo del bucle de reset.
- **Averías**: lo simple primero (capítulo 55 del libro), síntoma ↔ causa con fuentes externas, `averia` cuando los
  valores están en las fuentes. `banco` solo con medidas seguras y con fuente (ninguna de las catorce primeras lo usa).

### 12.5 Comprobar

```sh
cd web
node scripts/lecciones11.mjs --solo consola-snes/snes-relojes      # una lección (y partes.json, el índice y conceptos)
node scripts/lecciones11.mjs --comprobar                           # todas
EPA_RECORRER='^consola-' … npx playwright test … tests/lecciones11-recorrido.spec.ts
EPA_SIN_SERVIDOR=1 … npx playwright test … tests/lecciones11-unidad.spec.ts -g "lecciones de consola"
```

Hechas en la 1.2: las siete de la Super Nintendo, la NES, la Mega Drive, el Master System II y la Neo Geo AES (las
21 últimas, consolas-B: `-bloqueo` explica lo que hay en vez de un CIC —TMSS y puentes de región, la cabecera
«TMR SEGA», la BIOS con región y modo— y un `estimar` del «clic de la muerte» del watchdog en `neogeo-averias`; la
`tabla` de un circuito `logica` con tres columnas de rótulos largos desborda a 360 px: dos columnas). Para otra consola: escriba sus siete entradas
en el manifiesto (con sus `externas`), mire sus bloques, escriba las lecciones con el mismo patrón y añada la consola a
la lista de `tests/grupoA11.spec.ts` si cambia el número mínimo de lecciones.
