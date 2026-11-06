// 1.0 «Guía de uso»: the in-app user guide, as data. The view (componentes/guia/PaginaGuia.svelte) renders it and its
// filter searches it (lib/guia/buscar.ts). Everything here is bundled with the app (no fetch), so it works offline.
//
// Keeping it current: tests/guia10-contenido.spec.ts fails when a link points to a route that does not exist, when a
// «label» quoted here is not in the app's source (or in the list of quotes that are examples, not labels), when a
// section of the rail (lib/navegacion.svelte.ts HERRAMIENTAS) is not mentioned, or when a «¿Cómo funciona?» link of
// the app points to a section or subsection that is not here. A change of a label or a feature updates this file.
//
// Text rules: Spanish, «usted», plain text (no HTML); «…» only around what the app shows (labels, buttons, notices),
// so the test can check them against the source.

export interface EnlaceGuia {
  /** Visible text of the link. */
  texto: string;
  /** Hash route of the app (#/…). */
  ruta: string;
}

export type BloqueGuia =
  | { t: 'p'; texto: string }
  /** A bulleted list. */
  | { t: 'lista'; items: string[] }
  /** Numbered steps. */
  | { t: 'pasos'; items: string[] }
  /** A practical tip. */
  | { t: 'consejo'; texto: string }
  /** Something to be careful with (data, updates). */
  | { t: 'aviso'; texto: string }
  /** Keys and what they do. */
  | { t: 'teclas'; filas: [string, string][] };

export interface ApartadoGuia {
  /** Id in the route (#/guia/<seccion>/<apartado>): lowercase, digits and hyphens. */
  id: string;
  titulo: string;
  bloques: BloqueGuia[];
}

export interface SeccionGuia {
  /** Id in the route (#/guia/<seccion>): lowercase, digits and hyphens. */
  id: string;
  titulo: string;
  /** One sentence for the index of the guide. */
  resumen: string;
  apartados: ApartadoGuia[];
  /** «Abrir en la aplicación»: where the section's features live. */
  enlaces: EnlaceGuia[];
  /** Extra words for the filter (synonyms the text does not use). */
  claves?: string[];
}

export const GUIA: SeccionGuia[] = [
  {
    id: 'primeros-pasos',
    titulo: 'Primeros pasos y navegación',
    resumen: 'Cómo moverse por la aplicación, leer el libro, buscar y ajustar el tema y el tamaño del texto.',
    claves: ['menú', 'carril', 'índice', 'leer', 'lector', 'tema', 'oscuro', 'sepia', 'claro', 'letra', 'buscar', 'marcadores', 'notas'],
    apartados: [
      {
        id: 'navegar',
        titulo: 'Moverse por la aplicación',
        bloques: [
          {
            t: 'p',
            texto:
              'En el ordenador y en la tableta apaisada, a la izquierda hay un carril de iconos con todas las secciones (Inicio, Libro, Cursos, Buscar, Simulador, Calculadoras, Ejercicios, Repaso…); las que no caben en la altura de la ventana pasan a «Más». En el teléfono y en la tableta en vertical hay una barra abajo con Inicio, Libro, Simulador, Ejercicios y «Más», donde está todo lo demás.',
          },
          {
            t: 'lista',
            items: [
              'Junto al carril está el índice del libro: tomos, capítulos con su anillo de lectura y secciones. Se oculta y se muestra con el botón de la barra superior o pulsando «Libro» mientras lee; en el teléfono «Libro» lo abre como un cajón.',
              'El filtro del índice admite palabras sin tildes o números: 5.8, cap 33, ap B.',
              'Si se ha desplazado el índice, «Ir a la sección actual» vuelve a la que está leyendo.',
              'El botón Atrás (de la aplicación, del navegador, del ratón o de Android) vuelve al punto exacto donde estaba; en Android cierra primero el cajón, la búsqueda o el visor de figuras.',
            ],
          },
        ],
      },
      {
        id: 'leer',
        titulo: 'Leer el libro',
        bloques: [
          {
            t: 'lista',
            items: [
              'En la barra superior, la miga con el capítulo y la sección abre las demás secciones del capítulo; las flechas ↑ ↓ (o Alt ↑ / Alt ↓) van a la sección anterior o siguiente.',
              'Cada referencia como 5.3 es un enlace: lleva a su destino, lo resalta un momento y ofrece un botón para volver. Con ratón, al dejar el puntero sobre la referencia se ve una vista previa; en pantalla táctil, un toque abre la vista previa y un segundo toque (o «Ir a …») salta.',
              'Un toque o clic en una figura la abre a pantalla completa: se amplía con la rueda, los botones, doble toque o pellizco, y se desplaza arrastrando.',
              'Junto al título de cada sección: «Marcar esta sección» (marcador), «Añadir una nota a esta sección», «Estudiar por pasos» (el icono de las huellas) y «Marcar la sección como leída». Los marcadores y las notas se reúnen en «Marcadores y notas».',
              'Una sección cuenta como leída sola cuando ha visto su final y ha estado en pantalla el tiempo suficiente para su longitud; también puede marcarla o desmarcarla a mano.',
              'En el inicio, «Seguir leyendo» le devuelve a la lección o a la sección que dejó a medias.',
            ],
          },
        ],
      },
      {
        id: 'buscar',
        titulo: 'Buscar en el libro',
        bloques: [
          {
            t: 'p',
            texto:
              '«Buscar» (o Ctrl K / ⌘ K, o la tecla /) busca en todas las secciones y en el glosario. No importan las tildes ni las mayúsculas, basta el comienzo de las palabras y tolera pequeñas erratas. Con ↑ ↓ elige un resultado e Intro lo abre; Esc cierra.',
          },
          {
            t: 'consejo',
            texto: 'La búsqueda es del libro. Para buscar en esta guía, use el campo «Buscar en la guía» de arriba.',
          },
        ],
      },
      {
        id: 'aspecto',
        titulo: 'Tema y tamaño del texto',
        bloques: [
          {
            t: 'p',
            texto:
              'El botón «Aa» de la barra superior abre los ajustes: tema «Sistema» (el del dispositivo), «Claro», «Sepia» u «Oscuro», y el «Tamaño del texto», de 14 a 26 píxeles (18 por defecto, con «Restablecer»). El tema y el tamaño son de cada dispositivo: no se sincronizan.',
          },
          {
            t: 'p',
            texto:
              'En «Aa» también están el «Objetivo diario», «Sonido y vibración», el «Recordatorio diario» (solo en Android), «Su nombre» para el saludo del inicio (solo en este dispositivo), el «Diagnóstico de rendimiento», la sincronización, la copia de seguridad, «Buscar actualizaciones» y esta guía.',
          },
        ],
      },
    ],
    enlaces: [
      { texto: 'Inicio', ruta: '#/' },
      { texto: 'Glosario', ruta: '#/glosario' },
      { texto: 'Marcadores y notas', ruta: '#/marcadores' },
    ],
  },
  {
    id: 'lecciones-cursos',
    titulo: 'Lecciones y cursos',
    resumen: 'Estudiar una sección por pasos, seguir los cursos temáticos como un camino y crear cursos propios.',
    claves: ['estudiar', 'pasos', 'camino', 'saltar', 'prueba de nivel', 'superadas'],
    apartados: [
      {
        id: 'por-pasos',
        titulo: 'Estudiar por pasos',
        bloques: [
          {
            t: 'p',
            texto:
              '«Estudiar por pasos», junto al título de cada sección, la abre como una lección a pantalla completa: una pantalla por subapartado, con sus figuras, ecuaciones, calculadoras y simulaciones. Tras los pasos vienen algunas prácticas y las preguntas de Repaso de esa sección, y al final «Sección completada», que la marca como leída, con «Siguiente sección» y «Volver al libro».',
          },
          {
            t: 'teclas',
            filas: [
              ['→ o Intro', 'Continuar'],
              ['←', 'Paso anterior'],
              ['Esc', 'Cerrar la lección'],
            ],
          },
          { t: 'consejo', texto: 'La lección recuerda el paso donde la dejó: el inicio la ofrece en «Seguir leyendo».' },
        ],
      },
      {
        id: 'cursos',
        titulo: 'Cursos temáticos',
        bloques: [
          {
            t: 'p',
            texto:
              '«Cursos» agrupa los capítulos por temas (Fundamentos, Electrónica analógica, Digital y programable…). Cada curso se ve como un camino («Camino») o como una lista («Lista»), con su avance y un botón para continuar donde lo dejó.',
          },
          {
            t: 'lista',
            items: [
              'En el camino, cada lección se abre al completar (o superar) la anterior. Lo que ya ha tocado nunca se bloquea.',
              '«Prueba de nivel»: unas preguntas del libro que le dicen por dónde empezar y permiten marcar lo anterior como superado.',
              '«Saltar hasta aquí», en la primera lección bloqueada y al empezar cada capítulo: una prueba corta de cuatro preguntas (con «No lo sé»), solo sobre las lecciones que se salta. Si falla como mucho una, quedan superadas por la prueba; si esas lecciones tienen menos preguntas, la prueba es más corta y hay que acertarlas todas, y si no tienen ninguna, «Saltar sin prueba» las marca igual.',
              'Las lecciones superadas por una prueba se ven distintas de las completadas, no dan XP y se pueden deshacer («Deshacer») para estudiarlas después.',
            ],
          },
        ],
      },
      {
        id: 'propios',
        titulo: 'Cursos propios',
        bloques: [
          {
            t: 'p',
            texto:
              'En el «Modo docente» puede crear su propio curso con secciones, ejercicios, problemas y preguntas del libro, en el orden que quiera. Se sigue igual que un curso temático, como camino o como lista, y lo que haga en él cuenta como en cualquier otra parte.',
          },
        ],
      },
    ],
    enlaces: [
      { texto: 'Cursos', ruta: '#/cursos' },
      { texto: 'Modo docente', ruta: '#/docente' },
    ],
  },
  {
    id: 'preguntas',
    titulo: 'Preguntas y tests',
    resumen: 'Cómo se responden las preguntas, qué explica «Por qué no» y para qué sirve «¿Qué seguridad tenía?».',
    claves: ['test', 'examen mixto', 'fallos', 'opción', 'confianza'],
    apartados: [
      {
        id: 'responder',
        titulo: 'Responder',
        bloques: [
          {
            t: 'p',
            texto:
              'Las preguntas de las lecciones, de los tests y de la práctica se corrigen al momento, con la explicación, la cita del libro de la que salen y un enlace a su sección. Solo cuenta la primera respuesta: «Probar otra vez» es para aprender y no cambia la nota.',
          },
          {
            t: 'lista',
            items: [
              'En Repaso hay un test por capítulo (también con «Test del capítulo» al final de cada capítulo del lector), el «Examen mixto» con preguntas al azar de los capítulos que elija y «Repasar fallos», que guarda las falladas hasta que las acierte.',
              'Teclado: 1–5 o A–E eligen una opción; Intro pasa a la siguiente.',
            ],
          },
        ],
      },
      {
        id: 'por-que-no',
        titulo: '«Por qué no»',
        bloques: [
          {
            t: 'p',
            texto:
              'Al elegir una opción incorrecta, si el libro dice algo concreto sobre ella, aparece «Por qué no» con esa frase del libro entre comillas y un enlace a su sección. Solo se muestran frases revisadas a mano; si el libro no da una base clara, queda la explicación general.',
          },
        ],
      },
      {
        id: 'seguridad',
        titulo: '«¿Qué seguridad tenía?»',
        bloques: [
          {
            t: 'p',
            texto:
              'Tras acertar, tres botones opcionales: «Lo sabía», «Dudaba» y «He adivinado». No bloquean nada y, si no toca ninguno, no se guarda nada. «Dudaba» y «He adivinado» hacen que esa pregunta vuelva antes en el repaso espaciado; «Lo sabía» lo deja como está.',
          },
        ],
      },
    ],
    enlaces: [{ texto: 'Repaso', ruta: '#/repaso' }],
  },
  {
    id: 'ejercicios',
    titulo: 'Ejercicios y problemas',
    resumen: 'Escribir la respuesta con unidades y prefijos, pedir pistas, ver la solución, resolver paso a paso y practicar con otros valores.',
    claves: ['comprobar', 'unidades', 'prefijos', 'coma decimal', 'pista', 'solución', 'autoevaluación', 'xp'],
    apartados: [
      {
        id: 'comprobar',
        titulo: 'Comprobar la respuesta',
        bloques: [
          {
            t: 'p',
            texto:
              'Debajo de cada ejercicio y de cada problema hay un campo por cada magnitud pedida. Escriba el valor como en el papel: coma decimal, prefijo y unidad opcionales (4,7 kΩ, 4k7, 2R2, 2,2 µF o 2,2u, 20 mA, 1,2e-3). «Comprobar» (o Intro) responde campo a campo:',
          },
          {
            t: 'lista',
            items: [
              'Correcto: dentro de la tolerancia del redondeo del libro; también valen alternativas válidas, como el valor comercial E12.',
              'Casi: las cifras están bien pero sobra o falta un prefijo, el signo está cambiado o el valor está a menos de un 10 %.',
              'No es correcto, o la unidad no es de esa magnitud (esto último no cuenta como intento).',
            ],
          },
          {
            t: 'consejo',
            texto:
              'Las mayúsculas cuentan donde cambian la unidad: 4,7 mS (milisiemens) no es 4,7 ms (milisegundos). Lo que escribe se guarda mientras lo hace, sin contar como intento.',
          },
          {
            t: 'p',
            texto:
              'Otros ejercicios se comprueban eligiendo una opción, ordenando pasos con los botones ↑ ↓, clasificando, con una tabla de verdad, una expresión lógica o dos resistencias E12. En la página «Ejercicios» están todos por capítulos, con filtros, y «Repaso de fallados» recorre uno a uno los que falló.',
          },
        ],
      },
      {
        id: 'pistas',
        titulo: 'Pistas y solución',
        bloques: [
          {
            t: 'lista',
            items: [
              '«Pista» enseña primero el planteamiento (la fórmula o el método) y después un resultado intermedio; la tercera vez abre la solución del libro.',
              '«Ver solución» la abre en cualquier momento. En los problemas, «Ocultar solución» tapa el análisis del libro mientras lo intenta.',
              'Al resolverlo, o tras dos fallos, «Ver el desarrollo» abre la solución completa del libro.',
              '«Reiniciar» borra los intentos y lo escrito en ese ejercicio.',
            ],
          },
        ],
      },
      {
        id: 'autoevaluados',
        titulo: 'Ejercicios autoevaluados',
        bloques: [
          {
            t: 'p',
            texto:
              'Lo que no se puede comprobar solo (explicar, describir, diseñar) se autoevalúa: escriba «Su respuesta» si quiere (se guarda y se sincroniza), abra la solución con la lista de lo que se pide y conteste «¿Lo tenía bien?».',
          },
          {
            t: 'aviso',
            texto:
              'Los ejercicios autoevaluados no dan XP: abrir la solución, que es como se autoevalúan, anula los XP de ese ejercicio. Sí cuentan para el progreso y el dominio.',
          },
        ],
      },
      {
        id: 'paso-a-paso',
        titulo: 'Resolver paso a paso',
        bloques: [
          {
            t: 'p',
            texto:
              'En algunos ejercicios numéricos, tras dos comprobaciones fallidas aparece «Resolver paso a paso» (también hay un botón discreto con ese nombre). Cada paso es una pregunta corta con su comprobación, su pista y, en las opciones equivocadas, «Por qué no». El último paso es el resultado del ejercicio: escríbalo en los campos del ejercicio y compruébelo.',
          },
          {
            t: 'consejo',
            texto:
              'El paso a paso cuenta como ayuda en cuanto lo usa (como una o dos pistas, según lo que vea). Abrirlo y salir sin usarlo no cuenta nada.',
          },
        ],
      },
      {
        id: 'otros-valores',
        titulo: 'Practicar con otros valores',
        bloques: [
          {
            t: 'p',
            texto:
              'Bajo los ejercicios que una fórmula del libro reproduce, «Practicar con otros valores» plantea el mismo enunciado con números distintos, siempre realistas (valores E12, alimentaciones habituales) y dentro del régimen del enunciado. Debajo dice lo que se pide en esa variante, con sus valores; si el enunciado pide un valor comercial, solo vale el valor E12 más cercano al calculado.',
          },
        ],
      },
    ],
    enlaces: [
      { texto: 'Ejercicios', ruta: '#/ejercicios' },
      { texto: 'Repasar los fallados', ruta: '#/ejercicios/repaso' },
    ],
  },
  {
    id: 'practica',
    titulo: 'Retos de práctica',
    resumen: 'Predecir, ajustar la figura viva, montar el circuito en la protoboard y encontrar la avería con el polímetro.',
    claves: ['aprender haciendo', 'predicción', 'reto', 'montar', 'protoboard', 'avería', 'polímetro', 'multímetro'],
    apartados: [
      {
        id: 'tipos',
        titulo: 'Qué prácticas hay',
        bloques: [
          {
            t: 'p',
            texto:
              'Las lecciones intercalan prácticas sacadas del libro tras el paso que las motiva. En Repaso, «Aprender haciendo» las abre todas por capítulo. Cada una tiene pistas en escalera, un segundo intento y la explicación con el fragmento del libro.',
          },
          {
            t: 'lista',
            items: [
              '«Prediga y compruebe»: diga si una magnitud sube, baja o se queda igual al cambiar un valor; la aplicación lo simula y califica con lo que sale.',
              '«Calcule»: problemas con valores distintos en cada intento.',
              '«Ajuste», «Señale en el esquema», «Complete el montaje», «Ordene» y «Una las parejas».',
            ],
          },
        ],
      },
      {
        id: 'reto',
        titulo: 'Reto con la figura',
        bloques: [
          {
            t: 'p',
            texto:
              'En lugar de escribir un número, mueva un valor del esquema vivo hasta que una magnitud llegue al objetivo del libro. Cada posición se simula y la figura cambia en su sitio; debajo, la lectura y lo lejos que está del objetivo. Los botones ‹ › mueven un paso; con el teclado, las flechas. «Comprobar» da tres intentos, y cada fallo abre una pista más.',
          },
        ],
      },
      {
        id: 'montar',
        titulo: '«Monte el circuito»',
        bloques: [
          {
            t: 'p',
            texto:
              'Algunos ejercicios se resuelven montando en la protoboard: empieza vacía con la fuente puesta y la bandeja trae las piezas necesarias. Arrastre una pieza a la placa (o tóquela y toque la placa) y toque dos agujeros para tender un cable. «Comprobar» simula lo montado y mide: vale cualquier circuito que cumpla lo pedido, y cada condición dice lo que midió y qué cambiar.',
          },
          {
            t: 'consejo',
            texto:
              'También se comprueba cómo está montado: nada directamente entre los bornes de la fuente, ninguna pata al aire y la forma del circuito que pide el ejercicio (un divisor, un puente…).',
          },
        ],
      },
      {
        id: 'averia',
        titulo: '«Encuentre la avería»',
        bloques: [
          {
            t: 'p',
            texto:
              'Un circuito del libro con una pieza estropeada: abierta, en cortocircuito o con un valor diez veces mayor o menor. Con el polímetro virtual mida la tensión entre dos puntos marcados en la figura (punta roja y punta negra; tocar un punto mueve la roja) o la corriente por una rama, con «Medir». Las lecturas salen de simular el circuito con la avería.',
          },
          {
            t: 'pasos',
            items: [
              'Mida donde crea que la avería se notará: compare con lo que daría el circuito sano.',
              'Elija la pieza en «¿Qué pieza está averiada?» y el tipo en «¿Qué le pasa?».',
              'Al final verá la avería, cada medida comparada con el circuito sano y la que más la delataba.',
            ],
          },
          {
            t: 'consejo',
            texto:
              'Pieza y tipo acertados dan la puntuación completa; solo la pieza, algo más de la mitad. A partir de la cuarta medida, cada una resta un poco, igual que cada diagnóstico fallido. Medir entre los bornes de la fuente no delata ninguna avería.',
          },
        ],
      },
    ],
    enlaces: [{ texto: 'Aprender haciendo (en Repaso)', ruta: '#/repaso' }],
  },
  {
    id: 'teoria-viva',
    titulo: 'Teoría que se mueve',
    resumen: 'Deslizadores en las fórmulas del libro para ver cómo cambia el resultado.',
    claves: ['fórmula', 'deslizador', 'gráfica', 'ecuación'],
    apartados: [
      {
        id: 'usar',
        titulo: 'Mover los valores de una fórmula',
        bloques: [
          {
            t: 'p',
            texto:
              'Bajo algunas ecuaciones del libro (divisor de tensión, ley de Ohm, carga de un RC, resonancia LC, ganancia de un operacional…) cada magnitud es un deslizador: al moverlo, el resultado y una gráfica pequeña cambian al momento. En las lecciones está abierta; en el lector, pulse «Mover los valores de esta fórmula». «Volver a los valores del libro» los restituye.',
          },
          {
            t: 'consejo',
            texto:
              'Con el teclado: flechas, Re Pág / Av Pág, Inicio y Fin. Las resistencias, condensadores y bobinas recorren la serie E12. Es cálculo puro: nada se simula.',
          },
        ],
      },
      {
        id: 'calculadoras',
        titulo: 'Calculadoras',
        bloques: [
          {
            t: 'p',
            texto:
              'Muchas ecuaciones llevan además un botón «Calcular» que abre su calculadora: despeja cualquier variable, parte de los valores del ejemplo del libro («Valores del libro» vuelve a ellos), dibuja el circuito o la curva y explica la cuenta. «Ver cómo depende» dibuja el resultado frente a una entrada. La página «Calculadoras» las reúne por familias, con búsqueda y favoritas.',
          },
        ],
      },
    ],
    enlaces: [{ texto: 'Calculadoras', ruta: '#/calculadoras' }],
  },
  {
    id: 'simulador',
    titulo: 'Simulador, editor y protoboard',
    resumen: 'Simular los circuitos del libro, dibujar esquemas propios y montarlos en una protoboard virtual.',
    claves: ['ngspice', 'netlist', 'esquema', 'circuito', 'gráfica', 'montaje'],
    apartados: [
      {
        id: 'simular',
        titulo: 'Simular',
        bloques: [
          {
            t: 'p',
            texto:
              '«Simular», junto a cada figura, sección, ejercicio o problema que tiene un circuito, abre su netlist en el simulador (ngspice, dentro de la aplicación). El simulador tiene cuatro pestañas: «Netlists del libro», «Netlist libre», «Editor de esquemas» y «Protoboard».',
          },
          {
            t: 'lista',
            items: [
              'Los deslizadores cambian los valores de las piezas y vuelven a simular al soltar; «Fijar referencia» deja el resultado actual como trazo tenue para comparar.',
              'La netlist se puede editar (Ctrl Intro simula); «Restaurar la del libro» la deshace.',
              'En las gráficas: arrastrar amplía, doble clic vuelve a verlo todo, y hay dos cursores como en un osciloscopio.',
            ],
          },
          { t: 'consejo', texto: 'La primera simulación tarda más: se prepara el motor. Las siguientes son rápidas.' },
        ],
      },
      {
        id: 'editor',
        titulo: 'Editor de esquemas',
        bloques: [
          {
            t: 'p',
            texto:
              'Dibuje un circuito con los símbolos del libro y simúlelo sin escribir la netlist. Un toque en la paleta y otro en el lienzo coloca la pieza; los cables salen arrastrando desde una patilla. Los valores se escriben como en el libro (4,7k, 4k7, 100n). «Editar el esquema» abre como dibujo cualquier netlist del libro y «Ver como netlist» vuelve al texto. Sus dibujos quedan en «Mis circuitos».',
          },
        ],
      },
      {
        id: 'protoboard',
        titulo: 'Protoboard',
        bloques: [
          {
            t: 'p',
            texto:
              'Una protoboard para montar como en el laboratorio: arrastre las piezas desde la bandeja (en «Más piezas» está la paleta completa) y toque dos agujeros para tender un cable. La barra junto a la pieza elegida la gira, cambia su valor o la quita. «Ver en protoboard», junto a los esquemas, abre ese circuito ya montado. Lo guardado está en «Mis montajes».',
          },
        ],
      },
    ],
    enlaces: [
      { texto: 'Simulador', ruta: '#/simulador' },
      { texto: 'Netlist libre', ruta: '#/simulador/nuevo' },
      { texto: 'Editor de esquemas', ruta: '#/editor' },
      { texto: 'Protoboard', ruta: '#/protoboard' },
    ],
  },
  {
    id: 'laboratorio',
    titulo: 'Animaciones, 3D, placas e instrumentos',
    resumen: 'Componentes y conceptos animados, modelos 3D, las placas KiCad del libro, las consolas, los instrumentos y el kit FM7303.',
    claves: ['3d', 'kicad', 'placa', 'consola', 'osciloscopio', 'polímetro', 'radio', 'fm'],
    apartados: [
      {
        id: 'animaciones',
        titulo: 'Componentes y conceptos animados',
        bloques: [
          {
            t: 'p',
            texto:
              '«Ver animación», junto a las secciones y figuras que la tienen, abre cómo funciona un componente por dentro (Componentes animados, también como pieza 3D con corte y explosión) o un concepto de la teoría calculado con los números del libro (Conceptos animados). En el glosario, los términos con modelo 3D tienen «Ver en 3D».',
          },
        ],
      },
      {
        id: 'placas',
        titulo: 'Proyectos KiCad y consolas',
        bloques: [
          {
            t: 'p',
            texto:
              'Proyectos KiCad reúne las placas de los proyectos del libro en 3D y en 2D, con su esquema, sus redes y sus tensiones («Ver la placa» en el libro). Consolas enseña placas base de consolas clásicas con foto interactiva, arquitectura animada y esquema. En las vistas 3D se gira arrastrando y se amplía con la rueda o pellizcando.',
          },
          {
            t: 'consejo',
            texto:
              'Las placas en 3D son lo más pesado de la aplicación. Si una tarda o falla en un dispositivo, el «Diagnóstico de rendimiento» lo mide y, si se queda en blanco, «Reintentar» la vuelve a montar.',
          },
        ],
      },
      {
        id: 'instrumentos',
        titulo: 'Instrumentos y kit FM7303',
        bloques: [
          {
            t: 'p',
            texto:
              'Instrumentos tiene un polímetro y un osciloscopio virtuales en un banco de pruebas, con las prácticas del capítulo de instrumentación guiadas («Practicar» en el libro). Kit FM7303 es el receptor de FM del libro completo: esquema, tensiones simuladas, osciloscopio en los puntos de prueba, alineación guiada y averías.',
          },
        ],
      },
    ],
    enlaces: [
      { texto: 'Componentes animados', ruta: '#/componentes' },
      { texto: 'Conceptos animados', ruta: '#/conceptos' },
      { texto: 'Proyectos KiCad', ruta: '#/proyectos' },
      { texto: 'Consolas', ruta: '#/consolas' },
      { texto: 'Instrumentos', ruta: '#/instrumentos' },
      { texto: 'Kit FM7303', ruta: '#/fm7303' },
    ],
  },
  {
    id: 'repaso',
    titulo: 'Repaso, racha y progreso',
    resumen: 'Repaso espaciado, tarjetas, práctica inteligente, problema del día, objetivo diario, racha, XP y logros.',
    claves: ['tarjetas', 'anki', 'racha', 'xp', 'nivel', 'logros', 'objetivo', 'dominio', 'problema del día', 'olvidar'],
    apartados: [
      {
        id: 'repaso-espaciado',
        titulo: 'Repaso espaciado de las lecciones',
        bloques: [
          {
            t: 'p',
            texto:
              'La aplicación calcula, con lo que ha respondido, cuándo empieza a olvidar cada sección. En el camino de los cursos, cada lección completada dice «Para repasar hoy» o cuándo toca su repaso; en el inicio, «Repaso de sus lecciones» dice cuántas tocan hoy y «Repasar» abre la primera. Lo que vence mientras la aplicación está abierta pasa solo a «Para repasar hoy».',
          },
          {
            t: 'consejo',
            texto:
              'Los aciertos en días distintos alargan el plazo mucho más que repetir el mismo día. Si contesta «Dudaba» o «He adivinado» tras un acierto, el repaso llega antes.',
          },
        ],
      },
      {
        id: 'tarjetas',
        titulo: 'Tarjetas del glosario',
        bloques: [
          {
            t: 'p',
            texto:
              'En Repaso, cada término del glosario es una tarjeta (con «Tarjetas inversas», también al revés). Tras ver la respuesta elija «Otra vez», «Difícil», «Bien» o «Fácil»: cada botón dice cuándo volverá la tarjeta.',
          },
          {
            t: 'teclas',
            filas: [
              ['Espacio o Intro', 'Ver la respuesta'],
              ['1 – 4', 'Calificar (Espacio = Bien)'],
              ['Ctrl Z / ⌘ Z', 'Deshacer la última'],
            ],
          },
          { t: 'consejo', texto: 'En pantalla táctil, tocar la tarjeta la gira; deslizar a la derecha es «Bien» y a la izquierda «Otra vez».' },
        ],
      },
      {
        id: 'practica-inteligente',
        titulo: 'Práctica inteligente y dominio',
        bloques: [
          {
            t: 'p',
            texto:
              '«Práctica inteligente» prepara unos diez ejercicios para usted: primero lo que más le cuesta y lo que empieza a olvidar, después algo nuevo de su curso y un repaso de lo que domina. «Dominio» enseña cada sección del libro en cuatro niveles (Intentado, Familiarizado, Competente y Dominado), con «Practicar esto» en lo más flojo.',
          },
        ],
      },
      {
        id: 'problema-dia',
        titulo: 'Problema del día',
        bloques: [
          {
            t: 'p',
            texto:
              'Uno al día, el mismo en todos sus dispositivos, de su curso y hasta donde ha llegado. Tiene dos intentos y pistas; resolverlo da XP y suma a la racha de problemas. Después verá la solución con los valores del día, y «La solución de ayer» enseña la de ayer. En Android, el «Recordatorio diario» de «Aa» lo anuncia a la hora elegida.',
          },
        ],
      },
      {
        id: 'racha-xp',
        titulo: 'Objetivo diario, racha, XP y logros',
        bloques: [
          {
            t: 'lista',
            items: [
              'El objetivo diario se elige en «Aa» → «Objetivo diario»: «Pasos de lección» o «Preguntas de repaso», de 1 a 10 al día. Con pasos, cada sección marcada como leída cuenta como un paso (se puede desactivar).',
              'La racha cuenta los días seguidos con el objetivo cumplido. El día empieza a las 04:00, y lo hecho el mismo día en varios dispositivos se suma.',
              'XP: una pregunta acertada da 10 (5 a la segunda o con pistas), una lección completada 20, un ejercicio resuelto 15 (8 tras un fallo o con pistas; nada si abrió antes la solución). Cada cosa cuenta una sola vez, aunque la repita o la haga en otro dispositivo.',
              '«Progreso y logros» enseña su nivel, sus XP, la racha y todos los logros, con lo que falta para cada uno.',
            ],
          },
        ],
      },
    ],
    enlaces: [
      { texto: 'Repaso', ruta: '#/repaso' },
      { texto: 'Tarjetas de hoy', ruta: '#/repaso/tarjetas' },
      { texto: 'Práctica inteligente', ruta: '#/practicar' },
      { texto: 'Problema del día', ruta: '#/problema' },
      { texto: 'Progreso y logros', ruta: '#/progreso' },
      { texto: 'Dominio', ruta: '#/progreso/dominio' },
    ],
  },
  {
    id: 'docente',
    titulo: 'Modo docente',
    resumen: 'Exámenes y cursos propios con el contenido del libro, hechos en la aplicación o exportados a PDF.',
    claves: ['examen', 'pdf', 'imprimir', 'variantes', 'nota', 'profesor', 'alumno'],
    apartados: [
      {
        id: 'crear',
        titulo: 'Crear un examen o un curso',
        bloques: [
          {
            t: 'pasos',
            items: [
              'En «Modo docente», pulse «Nuevo examen» (o «Nuevo curso») y escriba el «Título».',
              'Con «Añadir del libro» elija ejercicios, problemas y preguntas: a mano o con los filtros (capítulo, concepto, tipo), y «Elegir al azar con estos filtros» saca los que pida repartidos por los capítulos.',
              'Ajuste los «Puntos» de cada pregunta, el «Tiempo total (minutos; 0 sin límite)», las variantes con otros valores y si quiere barajar el orden de las preguntas y de las opciones.',
              'Pulse «Guardar». Desde la lista puede «Editar», «Duplicar» o borrar cada uno.',
            ],
          },
          {
            t: 'consejo',
            texto:
              'Cada examen tiene una semilla: la variante A, B, C… sale siempre igual, en la aplicación, en el PDF y en todos sus dispositivos. «Generar otras variantes» cambia la semilla.',
          },
        ],
      },
      {
        id: 'hacer',
        titulo: 'Hacer el examen en la aplicación',
        bloques: [
          {
            t: 'p',
            texto:
              '«Hacer el examen en la aplicación» enseña todas las preguntas en una página, sin pistas ni correcciones y con el tiempo que queda a la vista. Elija la «Variante» antes de «Empezar». Lo respondido se guarda mientras tanto en el dispositivo: una recarga o un «Atrás» no lo pierden, y «Seguir con el examen empezado» lo retoma.',
          },
          {
            t: 'lista',
            items: [
              'Cuando se acaba el tiempo, el examen se entrega solo.',
              'Al pulsar «Entregar el examen» verá la nota de cada pregunta y el total, lo que respondió frente a lo correcto y el desarrollo del libro.',
              'Bien vale 1, «Casi» ½ y mal o en blanco 0. Lo que hay que explicar se compara con el desarrollo del libro y se autoevalúa con «Bien», «A medias» o «Mal»; la nota se recalcula.',
              'Los resultados se guardan y se sincronizan.',
            ],
          },
        ],
      },
      {
        id: 'pdf',
        titulo: 'Exportar a PDF',
        bloques: [
          {
            t: 'p',
            texto:
              'En «Exportar a PDF» elija el documento («Examen» o «Soluciones»), la «Variante», la fecha que se imprime (vacía deja una línea para escribirla) y el espacio para responder («Sin espacio», «Unas líneas» o «Media página»), y pulse «Exportar el examen» o «Exportar las soluciones». De un curso se exporta su índice («Exportar el índice»).',
          },
          {
            t: 'consejo',
            texto:
              'El PDF se hace dentro de la aplicación, sin conexión, y la misma variante da siempre el mismo fichero. En la aplicación instalada elige dónde guardarlo; en el navegador se descarga.',
          },
        ],
      },
    ],
    enlaces: [{ texto: 'Modo docente', ruta: '#/docente' }],
  },
  {
    id: 'datos',
    titulo: 'Sus datos y la sincronización',
    resumen: 'Dónde se guarda lo que hace, cómo sincronizar con GitHub, las copias de seguridad y qué hacer al actualizar.',
    claves: ['github', 'token', 'copia', 'backup', 'restaurar', 'importar', 'exportar', 'pestaña', 'dispositivos'],
    apartados: [
      {
        id: 'donde',
        titulo: 'Dónde se guardan',
        bloques: [
          {
            t: 'p',
            texto:
              'Todo lo que hace (marcadores, notas, progreso, ejercicios, repaso, exámenes, circuitos) se guarda en el propio dispositivo mientras lo usa. Nada sale de él salvo que configure la sincronización. En Android, desinstalar la aplicación borra esos datos.',
          },
        ],
      },
      {
        id: 'sincronizacion',
        titulo: 'Sincronizar sus dispositivos',
        bloques: [
          {
            t: 'p',
            texto:
              'La sincronización lleva su progreso de un dispositivo a otro a través de un fichero en un repositorio privado suyo de GitHub. Hace falta una vez un repositorio y un token; la página de sincronización lo explica paso a paso en «Cómo crear el repositorio y el token».',
          },
          {
            t: 'pasos',
            items: [
              'Abra «Aa» → «Sincronización» → «Configurar».',
              'Pegue el token en «Token de acceso personal (fine-grained)» y revise el repositorio y la ruta del fichero (los mismos en todos sus dispositivos).',
              'Pulse «Guardar y sincronizar». Repita en cada dispositivo.',
            ],
          },
          {
            t: 'lista',
            items: [
              'Con «Sincronizar automáticamente» se sincroniza al abrir la aplicación, cada pocos minutos mientras está abierta, al pasarla a segundo plano y al volver. «Sincronizar ahora» lo hace al momento.',
              'Nunca se sobrescribe todo: de cada elemento gana el cambio más reciente, y lo borrado sigue borrado.',
              'No viajan el tema, el tamaño de letra, el sonido, el recordatorio ni el propio token: son de cada dispositivo. «Desconectar» borra el token de este dispositivo.',
            ],
          },
          {
            t: 'aviso',
            texto:
              'El token solo se guarda en el dispositivo y en pantalla solo se ven sus cuatro últimos caracteres. Si GitHub lo rechaza porque ha caducado, cree otro y péguelo con «Cambiar token».',
          },
        ],
      },
      {
        id: 'copias',
        titulo: 'Copias de seguridad',
        bloques: [
          {
            t: 'lista',
            items: [
              '«Exportar copia» (en «Aa» o en la página de sincronización) guarda todo su progreso en un fichero JSON. No lleva el token ni los ajustes del dispositivo.',
              '«Importar una copia…» la abre, la comprueba y enseña qué cambiará antes de tocar nada.',
              '«Unir con los datos de este dispositivo» (lo recomendado) aplica las mismas reglas que la sincronización: no se pierde nada de lo que ya hay, e importar dos veces la misma copia no cambia nada.',
              '«Sustituir todo» deja los datos como en la copia, también en sus otros dispositivos al sincronizar. Antes guarda una copia automática de lo que había, y «Deshacer la sustitución» la recupera.',
            ],
          },
          {
            t: 'consejo',
            texto: 'Haga una copia antes de cambiar de dispositivo o de desinstalar la aplicación en Android.',
          },
        ],
      },
      {
        id: 'una-pestana',
        titulo: 'Una sola pestaña a la vez',
        bloques: [
          {
            t: 'p',
            texto:
              'En el navegador, la aplicación se usa en una sola pestaña a la vez, para que los datos no se mezclen. Si la abre en otra, esa dice «La aplicación está abierta en otra pestaña» con «Usar aquí»: al pulsarlo, la primera guarda lo pendiente y queda en pausa («Esta pestaña está en pausa»). Si la otra pestaña no responde, a los pocos segundos se ofrece «Usar aquí de todos modos». En la aplicación instalada no pasa: tiene una sola ventana.',
          },
        ],
      },
      {
        id: 'al-actualizar',
        titulo: 'Qué pasa con sus datos al actualizar',
        bloques: [
          {
            t: 'p',
            texto:
              'Al abrir una versión nueva por primera vez, sus datos se convierten a su formato y antes se guarda una copia de cómo estaban: en la página de sincronización, «Datos anteriores a la actualización» permite guardarla en un fichero o restaurarla. Si una conversión fallase, la aplicación lo dice, deja esos datos sin tocar y ofrece «Guardar los datos originales».',
          },
          {
            t: 'aviso',
            texto:
              'Al pasar a la 1.0: sincronice cada dispositivo justo antes de actualizarlo, y no responda ejercicios en un dispositivo que siga con la 0.12 cuando otro ya tenga la 1.0. Un dispositivo con la 0.12 no puede escribir en el fichero de la 1.0 (guarda lo suyo y lo envía cuando se actualice). La página de sincronización dice qué dispositivos faltan por actualizar.',
          },
          {
            t: 'aviso',
            texto:
              'No borre el fichero de GitHub ni cambie su ruta, aunque un mensaje lo sugiera: un fichero nuevo empieza otra historia, podría volver algo borrado y sus dispositivos dejarían de verse entre sí.',
          },
        ],
      },
    ],
    enlaces: [
      { texto: 'Sincronización', ruta: '#/sincronizacion' },
      { texto: 'Copia de seguridad', ruta: '#/sincronizacion/copia' },
    ],
  },
  {
    id: 'actualizaciones',
    titulo: 'Actualizaciones',
    resumen: 'Cómo se avisa de una versión nueva y cómo se instala en el ordenador y en Android.',
    claves: ['versión', 'instalador', 'apk', 'windows', 'macos', 'android', 'reiniciar'],
    apartados: [
      {
        id: 'aviso',
        titulo: 'El aviso de versión nueva',
        bloques: [
          {
            t: 'p',
            texto:
              'Al abrir la aplicación (como mucho cada 12 horas, y sin decir nada si no hay red) se comprueba si hay una versión publicada más nueva. Si la hay, aparece abajo un aviso con el principio de las notas, el instalador de su equipo y «Ver la publicación». «Ahora no» lo oculta hasta la siguiente versión. «Aa» → «Buscar actualizaciones» lo comprueba al momento.',
          },
        ],
      },
      {
        id: 'escritorio',
        titulo: 'En Windows y macOS',
        bloques: [
          {
            t: 'p',
            texto:
              'Cuando la publicación lo permite, el aviso ofrece «Descargar e instalar»: la aplicación descarga el instalador mostrando el progreso, comprueba su firma y, al terminar, «Reiniciar para terminar» guarda lo pendiente, instala y vuelve a abrirla. Mientras descarga se puede cancelar; si se atasca, se ofrece volver a intentarlo. Si no hay instalación automática, «Ver la publicación» lleva al instalador para instalarlo encima de la versión actual.',
          },
        ],
      },
      {
        id: 'android',
        titulo: 'En Android',
        bloques: [
          {
            t: 'pasos',
            items: [
              'Sincronice el dispositivo (y, si quiere, «Exportar copia»).',
              'En el aviso, pulse «Ver la publicación» y descargue el fichero .apk.',
              'Ábralo y confirme la instalación: se instala encima de la versión actual y conserva sus datos. La primera vez, Android puede pedir permiso para instalar aplicaciones desde el navegador o el gestor de archivos.',
            ],
          },
          {
            t: 'aviso',
            texto: 'No desinstale la aplicación para actualizarla: desinstalar borra sus datos de este dispositivo.',
          },
        ],
      },
    ],
    enlaces: [{ texto: 'Sincronización y actualizaciones', ruta: '#/sincronizacion' }],
  },
  {
    id: 'diagnostico',
    titulo: 'Diagnóstico e informe de fallos',
    resumen: 'Medir el rendimiento del dispositivo y copiar el informe de fallos, que nunca sale del dispositivo.',
    claves: ['error', 'fallo', 'rendimiento', 'registro', 'informe', 'cuelga', 'lento'],
    apartados: [
      {
        id: 'rendimiento',
        titulo: 'Diagnóstico de rendimiento',
        bloques: [
          {
            t: 'p',
            texto:
              '«Aa» → «Diagnóstico de rendimiento» mide en este dispositivo lo más pesado de la aplicación: la GPU, el visor 3D, las placas en 3D, los esquemas grandes y una simulación. No se ejecuta nada hasta pulsar «Empezar». Al terminar, «Copiar resultados» deja el informe como texto para pegarlo donde quiera.',
          },
          {
            t: 'consejo',
            texto:
              'Mientras mide, tenga la aplicación en primer plano y no toque la pantalla. Si una prueba cuelga la aplicación, al volver al diagnóstico se dice en qué fase se quedó.',
          },
        ],
      },
      {
        id: 'informe',
        titulo: 'Informe de fallos',
        bloques: [
          {
            t: 'p',
            texto:
              'Al final del diagnóstico, el «Informe de fallos» apunta cada fallo de la aplicación en este dispositivo: la hora, la versión, la pantalla, el mensaje y lo último que se hizo antes. Tras un fallo aparece abajo un aviso discreto con «Ver el informe». Si la aplicación se cerró de golpe, la siguiente vez lo anota como «Cierre inesperado».',
          },
          {
            t: 'aviso',
            texto:
              'El informe se guarda solo en este dispositivo: nunca se sincroniza, no va en las copias de seguridad ni se envía a ningún sitio, y no incluye el token, el repositorio de datos, su nombre de usuario en las rutas ni sus textos y respuestas (si un mensaje de error repite algo que usted ha escrito, queda tapado como «[texto]»).',
          },
          {
            t: 'pasos',
            items: [
              'Abra el informe (desde el aviso, o «Aa» → «Diagnóstico de rendimiento», al final).',
              'Pulse «Copiar el informe»: queda en el portapapeles como texto.',
              'Péguelo en un correo o en una conversación. «Borrar» lo vacía cuando ya no lo necesite.',
            ],
          },
          {
            t: 'p',
            texto:
              'El «Registro de la aplicación», justo encima, guarda además los pasos de las vistas pesadas: «Copiar errores» copia solo los errores y avisos, «Copiar registro» lo copia entero y «Descargar» lo guarda como fichero de texto. También se queda en el dispositivo.',
          },
        ],
      },
    ],
    enlaces: [
      { texto: 'Diagnóstico de rendimiento', ruta: '#/diagnostico' },
      { texto: 'Informe de fallos', ruta: '#/diagnostico/informe' },
    ],
  },
  {
    id: 'teclado',
    titulo: 'Teclado y accesibilidad',
    resumen: 'Atajos de teclado y lo que la aplicación hace para lectores de pantalla, pantallas táctiles y movimiento reducido.',
    claves: ['atajos', 'teclas', 'lector de pantalla', 'contraste', 'movimiento'],
    apartados: [
      {
        id: 'atajos',
        titulo: 'Atajos de teclado',
        bloques: [
          {
            t: 'teclas',
            filas: [
              ['Ctrl K / ⌘ K, /', 'Buscar en el libro'],
              ['Alt ↑ / Alt ↓', 'Sección anterior / siguiente'],
              ['↑ ↓ → ← Intro (en el índice)', 'Recorrer, desplegar, plegar y abrir'],
              ['Esc', 'Cerrar la búsqueda, el visor de figuras o «Aa»'],
              ['+ − 0 (en el visor de figuras)', 'Acercar, alejar y ajustar'],
              ['Ctrl Intro', 'Guardar la nota que escribe; en el simulador, simular'],
              ['→ o espacio (en una deducción)', 'Siguiente paso; ← vuelve atrás'],
            ],
          },
          {
            t: 'consejo',
            texto: 'Las lecciones, las tarjetas y los tests tienen sus propias teclas: están en sus apartados de esta guía.',
          },
        ],
      },
      {
        id: 'accesibilidad',
        titulo: 'Accesibilidad',
        bloques: [
          {
            t: 'lista',
            items: [
              'Las lecciones, las preguntas, los ejercicios y los retos se pueden hacer solo con el teclado; con Tab se recorre la página y el foco se ve siempre.',
              'La primera pulsación de Tab en cualquier página es «Saltar al contenido». Al cambiar de página, el foco pasa a su título, y el lector de pantalla la anuncia.',
              'El editor de esquemas y la protoboard también se usan con el teclado. Las flechas mueven un cursor e Intro hace lo mismo que un toque en ese punto: coloca la pieza elegida, empieza un cable o lo termina. N elige la pieza siguiente y Mayús + flechas la mueven.',
              'Los tres temas cumplen el contraste mínimo, y el tamaño del texto se ajusta en «Aa».',
              'En pantallas táctiles, los botones tienen al menos 44 píxeles de zona de toque.',
              'Con la opción de reducir el movimiento activada en el sistema, las celebraciones son solo fundidos.',
              'Para lectores de pantalla, los deslizadores anuncian su valor con su unidad, el camino de un curso es una lista ordenada, y las correcciones se dicen con palabras («Correcto», «Casi»), nunca solo con color.',
            ],
          },
        ],
      },
    ],
    enlaces: [{ texto: 'Inicio', ruta: '#/' }],
  },
  {
    id: 'problemas',
    titulo: 'Problemas frecuentes',
    resumen: 'Qué hacer cuando algo no va como debería.',
    claves: ['ayuda', 'no funciona', 'error', 'faq', 'preguntas frecuentes'],
    apartados: [
      {
        id: 'faq',
        titulo: 'Preguntas frecuentes',
        bloques: [
          {
            t: 'lista',
            items: [
              'Una parte de la página dice «No se ha podido mostrar» con «Reintentar»: pulse «Reintentar»; el resto de la aplicación sigue funcionando. Si se repite, copie el informe de fallos.',
              'Aparece «Recargar la página»: falta una parte de la aplicación (suele pasar justo después de actualizar). Recargue.',
              'La sincronización dice que GitHub rechaza el token: ha caducado o se ha revocado. Cree otro y péguelo con «Cambiar token».',
              'Un dispositivo con la 0.12 dice que el fichero tiene la versión 2 del formato: actualícelo. No borre el fichero ni cambie la ruta.',
              '«La aplicación está abierta en otra pestaña»: use «Usar aquí» o cierre la otra pestaña.',
              'Los cambios de otro dispositivo no llegan: pulse «Sincronizar ahora» en los dos, primero en el que hizo los cambios.',
              'Ha desinstalado la aplicación en Android y ha perdido el progreso: vuelva a configurar la sincronización (lo sincronizado vuelve) o importe su última copia con «Importar una copia…».',
              'Una vista 3D va lenta o la tableta se cierra: mire el «Diagnóstico de rendimiento» y copie el informe de fallos.',
            ],
          },
        ],
      },
    ],
    enlaces: [
      { texto: 'Sincronización', ruta: '#/sincronizacion' },
      { texto: 'Informe de fallos', ruta: '#/diagnostico/informe' },
    ],
  },
];

/** The section with this id, if any. */
export function seccionGuia(id: string): SeccionGuia | undefined {
  return GUIA.find((s) => s.id === id);
}

/** Route of a section (and subsection) of the guide. */
export function hrefGuia(seccion: string, apartado?: string): string {
  return apartado ? `#/guia/${seccion}/${apartado}` : `#/guia/${seccion}`;
}
