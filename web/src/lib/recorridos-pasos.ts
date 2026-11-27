// 2.2: the steps of the app's tour and of each tool's tutorial, as data (the engine: componentes/recorridos/).
//
// A step lights a real element of the page, found by a stable data attribute (`objetivo`, a CSS selector: every
// visible match is lit together). An action step («Gire el selector a V⎓») keeps «Siguiente» disabled until the reader
// does it: `hecho` is polled against the live tool (lib/recorridos.svelte.ts `vivo`) or the page, or `pulsar` waits for
// a press of the lit element itself. The lit element takes taps only in an action step; the rest of the page is dimmed
// and inert. Only the simulated tools are used: nothing here talks to a real Brymen or FNIRSI.
//
// Text rules: Spanish (Spain), «usted», short; «…» only around what the app shows (labels, buttons). Every claim is
// checked against the app (tests/recorridos22-*.spec.ts walks every tour on the phone and the desktop).

import { ruta } from './ruta.svelte';
import { sitio, vivo, type IdRecorrido } from './recorridos.svelte';

export interface PasoRecorrido {
  titulo: string;
  /** Plain text. */
  texto: string;
  /** What is lit: a CSS selector by data attribute (every visible match). None: the card alone, centred. */
  objetivo?: string;
  /** Runs when the step opens: shows the part of the page the step talks about (the phone's bench segment). */
  preparar?: () => void;
  /** Action step: done when this returns true (polled); `inicio` is what `antes()` returned when the step opened. */
  hecho?: (inicio: unknown) => boolean;
  antes?: () => unknown;
  /** Action step: done when the lit element is pressed. */
  pulsar?: boolean;
  /** Shown once the action is done («Hecho: …»). */
  logrado?: string;
}

export interface Recorrido {
  id: IdRecorrido;
  /** Name in the Guía's list. */
  nombre: string;
  /** The card's short line above the title («Brymen · paso 2 de 5»); the app's tour shows only «Paso n de N». */
  corto?: string;
  /** The offer: title and text. */
  oferta: { titulo: string; texto: string; antetitulo: string; empezar: string };
  /** Where it runs when started from the Guía (and when the page on screen does not suit it). */
  inicio?: string;
  /** Whether the page on screen suits it (default: anywhere). */
  enSitio?: () => boolean;
  pasos: PasoRecorrido[];
}

// ------------------------------------------------------------------ helpers

function esVisible(e: Element): boolean {
  const r = e.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return false;
  const s = getComputedStyle(e);
  return s.visibility !== 'hidden' && s.display !== 'none';
}

/** The visible elements a selector names (the engine lights them together). */
export function visibles(sel: string): Element[] {
  return [...document.querySelectorAll(sel)].filter(esVisible);
}

/** On a phone the bench shows one thing at a time: the circuit, the Brymen or the FNIRSI. */
function segmento(s: 'circuito' | 'brymen' | 'fnirsi'): () => void {
  return () => {
    const t = document.getElementById(`banco-seg-${s}`);
    if (t && esVisible(t) && t.getAttribute('aria-selected') !== 'true') t.click();
  };
}

const enBanco = sitio.banco;
const brymen = () => vivo.banco?.brymen ?? null;
const fnirsi = () => vivo.banco?.fnirsi ?? null;

// ------------------------------------------------------------------ the app's tour

const APP: Recorrido = {
  id: 'app',
  nombre: 'Recorrido por la app',
  oferta: {
    antetitulo: 'Primera vez en la app',
    titulo: '¿Le enseño dónde está cada cosa?',
    texto: 'Seis pasos, unos dos minutos: los cinco grupos, el buscador y «Aa». Puede dejarlo cuando quiera y repetirlo desde la Guía de uso.',
    empezar: 'Empezar el recorrido',
  },
  enSitio: () => ruta.vista !== 'leccion',
  pasos: [
    {
      titulo: 'Inicio',
      texto: 'Lo de hoy: «Seguir» le lleva a donde lo dejó y, debajo, están su objetivo del día, la racha, el problema del día y lo que toca repasar.',
      objetivo: '[data-grupo="inicio"]',
    },
    {
      titulo: 'Aprender',
      texto: 'Cursos por temas, Repaso (tarjetas y test de cada capítulo) y Progreso (nivel, racha, logros y lo que domina de cada concepto).',
      objetivo: '[data-grupo="aprender"]',
    },
    {
      titulo: 'Libro',
      texto: 'Índice, Ejercicios, Conceptos animados, Glosario y Marcadores con sus notas. Mientras lee, «Libro» muestra u oculta el índice de capítulos y secciones.',
      objetivo: '[data-grupo="libro"]',
    },
    {
      titulo: 'Taller',
      texto: 'Simulador, Protoboard, Instrumentos (el banco con el Brymen y el FNIRSI), Calculadoras y Componentes animados. El simulador, la protoboard y los instrumentos le ofrecen un tutorial la primera vez que los abre.',
      objetivo: '[data-grupo="taller"]',
    },
    {
      titulo: 'Proyectos',
      texto: 'El kit de radio FM7303 completo y vivo, once consolas por dentro (foto, esquema, placa y averías) y las placas KiCad de los proyectos del libro.',
      objetivo: '[data-grupo="proyectos"]',
    },
    {
      titulo: 'Buscar y «Aa»',
      texto: 'La lupa busca en el libro y también las partes de la aplicación, los instrumentos, las consolas y las calculadoras. «Aa» cambia el tema y el tamaño del texto; a su pie, en «Más», están la Guía de uso (desde donde puede repetir este recorrido), el Modo docente y la Sincronización.',
      objetivo: '[data-herramienta="buscar"], [data-herramienta="aa"]',
    },
  ],
};

// ------------------------------------------------------------------ the bench

const BRYMEN: Recorrido = {
  id: 'brymen',
  nombre: 'Brymen BM869s',
  corto: 'Brymen',
  oferta: {
    antetitulo: 'Tutorial',
    titulo: '¿Le enseño a usar el Brymen?',
    texto: 'Cinco pasos con el Brymen simulado de este banco: las puntas, el selector, los botones y la lectura.',
    empezar: 'Empezar el tutorial',
  },
  inicio: '#/instrumentos/libre',
  enSitio: enBanco,
  pasos: [
    {
      titulo: 'El Brymen BM869s',
      texto: 'Un multímetro de 50 000 cuentas, simulado: mide el circuito de este banco con las escalas, la exactitud y la carga del de verdad. Arriba la pantalla, en medio los botones y el selector, abajo los bornes.',
      objetivo: '[data-recorrido="brymen"]',
      preparar: segmento('brymen'),
    },
    {
      titulo: 'Apáguelo: selector a OFF',
      texto: 'Toque la posición OFF o arrastre la rueda. El paso se completa solo cuando el selector llega ahí; con el teclado, las flechas lo giran.',
      objetivo: '[data-recorrido="brymen-selector"]',
      preparar: segmento('brymen'),
      hecho: () => brymen()?.posicion.id === 'off',
      logrado: 'Hecho: la pantalla se apaga.',
    },
    {
      titulo: 'Gire el selector a V⎓',
      texto: 'V⎓ mide tensión continua entre la punta roja y la COM. Toque la posición V⎓ o arrastre la rueda hasta ella.',
      objetivo: '[data-recorrido="brymen-selector"]',
      preparar: segmento('brymen'),
      hecho: () => brymen()?.posicion.id === 'vdc',
      logrado: 'Hecho: el Brymen mide la tensión continua entre sus puntas.',
    },
    {
      titulo: 'Los botones',
      texto: 'SELECT cambia de función, RANGE fija el rango (mantenido, vuelve a AUTO), Δ mide en relativo, HOLD congela la lectura, REC guarda máximo, mínimo y media, y CREST los picos. Pulse HOLD para probarlo.',
      objetivo: '[data-recorrido="brymen-hold"]',
      preparar: segmento('brymen'),
      hecho: () => !!brymen()?.hold,
      logrado: 'Hecho: la «H» de la pantalla dice que la lectura está congelada; HOLD otra vez la suelta.',
    },
    {
      titulo: 'La lectura y su exactitud',
      texto: 'Debajo del Brymen está lo que marca con su incertidumbre según el manual. «?» abre la ayuda: qué mide cada posición del selector y en qué borne va la punta roja.',
      objetivo: '[data-recorrido="brymen-pie"]',
      preparar: segmento('brymen'),
    },
  ],
};

const FNIRSI_OSC: Recorrido = {
  id: 'fnirsi-osc',
  nombre: 'FNIRSI · osciloscopio',
  corto: 'FNIRSI',
  oferta: {
    antetitulo: 'Tutorial',
    titulo: '¿Le enseño el osciloscopio del FNIRSI?',
    texto: 'Seis pasos con el FNIRSI simulado de este banco: la sonda, AUTO, las escalas, RUN/STOP y los menús.',
    empezar: 'Empezar el tutorial',
  },
  inicio: '#/instrumentos/practica/7',
  enSitio: enBanco,
  pasos: [
    {
      titulo: 'El FNIRSI 2C53T',
      texto: 'Osciloscopio de dos canales, multímetro y generador en un solo aparato, simulado. Empieza como osciloscopio: la pantalla dibuja la tensión frente al tiempo.',
      objetivo: '[data-recorrido="fnirsi"]',
      preparar: segmento('fnirsi'),
    },
    {
      titulo: 'La sonda del canal 1',
      texto: 'El canal 1 dibuja la tensión del nodo donde está «FNIRSI, sonda CH1» respecto a «FNIRSI, pinza de masa». En «Puntas puestas» se elige una punta y se toca un nodo del dibujo para moverla allí.',
      objetivo: '[data-recorrido="banco-puntas"]',
      preparar: segmento('circuito'),
    },
    {
      titulo: 'Pulse AUTO',
      texto: 'AUTO ajusta solo las escalas y el disparo a lo que llega a las sondas. Es lo primero que se pulsa cuando no se ve nada claro.',
      objetivo: '[data-recorrido="fnirsi-auto"]',
      preparar: segmento('fnirsi'),
      pulsar: true,
      logrado: 'Hecho: escalas y disparo ajustados.',
    },
    {
      titulo: 'Las escalas, con las flechas',
      texto: '▲ y ▼ cambian los voltios por división del canal activo; ◄ y ► la base de tiempos (los segundos por división). SELECT cambia lo que hacen las flechas: la posición y el nivel de disparo; tres pulsaciones vuelven a las escalas. Pruebe una flecha.',
      objetivo: '[data-recorrido="fnirsi-flecha"], [data-recorrido="fnirsi-run"], [data-recorrido="fnirsi-select"]',
      preparar: segmento('fnirsi'),
      // (2.2: an arrow in any of SELECT's three modes counts: scales, positions or the trigger level)
      antes: () => {
        const f = fnirsi();
        return f ? `${f.sDiv}|${f.canales.map((c) => `${c.vDiv}:${c.pos}`).join(',')}|${f.hpos}|${f.disparo.nivel}|${f.menu ?? ''}` : '';
      },
      hecho: (ini) => {
        const f = fnirsi();
        return !!f && `${f.sDiv}|${f.canales.map((c) => `${c.vDiv}:${c.pos}`).join(',')}|${f.hpos}|${f.disparo.nivel}|${f.menu ?? ''}` !== ini;
      },
      logrado: 'Hecho: la escala ha cambiado (está en la línea de abajo de la pantalla).',
    },
    {
      titulo: 'RUN/STOP congela la imagen',
      texto: 'En el osciloscopio, la tecla azul del centro de la cruceta es RUN/STOP: detiene la captura para mirar la onda con calma; otra pulsación la reanuda.',
      objetivo: '[data-recorrido="fnirsi-run"]',
      preparar: segmento('fnirsi'),
      pulsar: true,
      logrado: 'Hecho. Si la dejó detenida, «STOP» arriba en la pantalla lo recuerda.',
    },
    {
      titulo: 'Medidas y menús',
      texto: 'PRM muestra las medidas automáticas (frecuencia, pico a pico…), TRIGGER el disparo y CH1 y CH2 cada canal. MENU abre las funciones (Math, cursores, X-Y); mantenida, pasa a multímetro o generador. MOVE, mantenida, hace que las flechas muevan las trazas.',
      objetivo: '[data-recorrido="fnirsi-move"], [data-recorrido="fnirsi-select"], [data-recorrido="fnirsi-trigger"], [data-recorrido="fnirsi-prm"], [data-recorrido="fnirsi-ch1"], [data-recorrido="fnirsi-ch2"], [data-recorrido="fnirsi-menu"]',
      preparar: segmento('fnirsi'),
    },
  ],
};

const FNIRSI_MULT: Recorrido = {
  id: 'fnirsi-mult',
  nombre: 'FNIRSI · multímetro y generador',
  corto: 'FNIRSI',
  oferta: {
    antetitulo: 'Tutorial',
    titulo: '¿Le enseño el multímetro y el generador del FNIRSI?',
    texto: 'Cinco pasos con el FNIRSI simulado de este banco: MENU, el multímetro, sus bornes y el generador.',
    empezar: 'Empezar el tutorial',
  },
  inicio: '#/instrumentos/libre',
  enSitio: enBanco,
  pasos: [
    {
      titulo: 'MENU, mantenida, cambia de modo',
      texto: 'El FNIRSI es osciloscopio, multímetro y generador. Mantenga pulsada MENU un segundo: la pantalla muestra los tres modos.',
      objetivo: '[data-recorrido="fnirsi-menu"]',
      preparar: segmento('fnirsi'),
      hecho: () => fnirsi()?.menu === 'principal' || fnirsi()?.modo !== 'osc',
      logrado: 'Hecho: Osciloscopio, Multímetro y Generador en la pantalla.',
    },
    {
      titulo: 'Elija Multímetro',
      texto: 'Toque «Multímetro» en la pantalla, o márquelo con ► y pulse la tecla azul del centro de la cruceta. (Si cerró la pantalla de modos, mantenga pulsada MENU para volver a abrirla.)',
      objetivo: '[data-recorrido="fnirsi-pantalla"], [data-recorrido="fnirsi-flecha"], [data-recorrido="fnirsi-run"], [data-recorrido="fnirsi-menu"]',
      preparar: segmento('fnirsi'),
      hecho: () => fnirsi()?.modo === 'dmm',
      logrado: 'Hecho: el FNIRSI es ahora un multímetro de 19 999 cuentas.',
    },
    {
      titulo: 'Función y bornes',
      texto: 'En multímetro, ◄ y ► cambian la función, MOVE pasa la tensión de continua a alterna, AUTO vuelve a Automático y la tecla azul retiene el valor (HOLD). Mide con sus propias puntas («FNIRSI multímetro» en «Puntas puestas»): la negra en COM y la roja en VΩ, o en mA o 10A para corriente; toque un borne para pasar la roja.',
      objetivo: '[data-recorrido="fnirsi-pantalla"], [data-recorrido="fnirsi-flecha"], [data-recorrido="fnirsi-move"], [data-recorrido="fnirsi-run"], [data-recorrido="fnirsi-borne"]',
      preparar: segmento('fnirsi'),
    },
    {
      titulo: 'Ahora el generador',
      texto: 'Mantenga pulsada MENU y toque «Generador» en la pantalla, o márquelo con ◄ ► y pulse la tecla azul.',
      objetivo: '[data-recorrido="fnirsi-pantalla"], [data-recorrido="fnirsi-flecha"], [data-recorrido="fnirsi-run"], [data-recorrido="fnirsi-menu"]',
      preparar: segmento('fnirsi'),
      hecho: () => fnirsi()?.modo === 'gen',
      logrado: 'Hecho: el generador DDS, con su salida apagada.',
    },
    {
      titulo: 'Ajustar la señal',
      texto: '▲ y ▼ eligen la forma de onda. La tecla azul pasa a los ajustes, donde ▲ y ▼ eligen la línea (frecuencia, amplitud, salida); otra pulsación la edita: ▲ y ▼ cambian la frecuencia de 1 en 1 Hz y ◄ y ► a saltos. MENU vuelve un paso atrás. Debajo del aparato puede escribir la frecuencia y la amplitud. Con la salida en ON, la señal excita el circuito del banco.',
      objetivo: '[data-recorrido="fnirsi-pantalla"], [data-recorrido="fnirsi-flecha"], [data-recorrido="fnirsi-run"], [data-recorrido="fnirsi-menu"]',
      preparar: segmento('fnirsi'),
    },
  ],
};

const BANCO: Recorrido = {
  id: 'banco',
  nombre: 'El banco: puntas y medir en serie',
  corto: 'Banco',
  oferta: {
    antetitulo: 'Tutorial',
    titulo: '¿Le enseño a poner las puntas?',
    texto: 'Cuatro pasos: mover una punta, poner otra y medir en serie, en el circuito de este banco.',
    empezar: 'Empezar el tutorial',
  },
  inicio: '#/instrumentos/libre',
  enSitio: enBanco,
  pasos: [
    {
      titulo: 'Mueva una punta',
      texto: 'En «Puntas puestas» elija una punta (la fila marcada es la que se mueve) y toque otro nodo del dibujo: la punta salta allí y el aparato mide en el sitio nuevo.',
      objetivo: '[data-recorrido="banco-puntas"], [data-recorrido="banco-dibujo"]',
      preparar: segmento('circuito'),
      antes: () => JSON.stringify(vivo.banco?.puntas ?? []),
      hecho: (ini) => !!vivo.banco && JSON.stringify(vivo.banco.puntas) !== ini,
      logrado: 'Hecho: la punta está en su nodo nuevo.',
    },
    {
      titulo: 'Poner otra punta',
      texto: '«Poner otra punta» añade las que faltan: la otra del Brymen, las sondas CH1 y CH2 del osciloscopio con su pinza de masa, las del multímetro del FNIRSI y el auricular para escuchar.',
      objetivo: '[data-recorrido="banco-otra"]',
      preparar: segmento('circuito'),
    },
    {
      titulo: 'Medir en serie',
      texto: 'Para medir una corriente, el aparato va en serie: abre el circuito en un terminal y lo cierra a través de él. Abra «Medir en serie».',
      objetivo: '[data-plegable="serie"]',
      preparar: segmento('circuito'),
      hecho: () => !!document.querySelector<HTMLDetailsElement>('details[data-plegable="serie"]')?.open,
      logrado: 'Hecho.',
    },
    {
      titulo: 'Elija dónde',
      texto: 'Elija un terminal en «Brymen en serie con». Para leer la corriente, el selector del Brymen va en A mA (o µA) y su punta roja en el borne mA µA (o A).',
      objetivo: '[data-plegable="serie"]',
      preparar: () => {
        segmento('circuito')();
        const d = document.querySelector<HTMLDetailsElement>('details[data-plegable="serie"]');
        if (d && !d.open) d.open = true;
      },
      hecho: () => !!vivo.banco?.bm.serie,
      logrado: 'Hecho: el Brymen está en serie con ese terminal.',
    },
  ],
};

// ------------------------------------------------------------------ the breadboard

const pb = () => vivo.protoboard;

const PROTOBOARD: Recorrido = {
  id: 'protoboard',
  nombre: 'Protoboard',
  corto: 'Protoboard',
  oferta: {
    antetitulo: 'Tutorial',
    titulo: '¿Le enseño a montar en la protoboard?',
    texto: 'Seis pasos: poner una pieza, tender un cable, simular y dónde están la guía, el panel y sus montajes.',
    empezar: 'Empezar el tutorial',
  },
  inicio: '#/protoboard',
  enSitio: sitio.protoboard,
  pasos: [
    {
      titulo: 'Ponga una pieza',
      texto: 'Arrastre una pieza de la bandeja hasta la placa: verá en verde los agujeros donde caerán sus patas. También puede tocarla y luego tocar la placa.',
      objetivo: '[data-recorrido="proto-bandeja"], [data-recorrido="proto-placa"]',
      antes: () => pb()?.doc.piezas.length ?? 0,
      hecho: (ini) => (pb()?.doc.piezas.length ?? 0) > (ini as number),
      logrado: 'Hecho: la pieza está en la placa.',
    },
    {
      titulo: 'Tienda un cable',
      texto: 'Toque un agujero libre y después otro: el cable los une. Con dos dedos se mueve y se acerca la placa; + y − también la acercan.',
      objetivo: '[data-recorrido="proto-placa"]',
      antes: () => pb()?.doc.cables.length ?? 0,
      hecho: (ini) => (pb()?.doc.cables.length ?? 0) > (ini as number),
      logrado: 'Hecho: el cable une los dos agujeros.',
    },
    {
      titulo: 'Simular',
      texto: '«Simular» resuelve el circuito tal como está montado: los LED se encienden y el panel muestra tensiones y corrientes.',
      objetivo: '[data-recorrido="proto-simular"]',
      pulsar: true,
      logrado: 'Hecho: el resultado está en el panel.',
    },
    {
      titulo: 'Monta este circuito',
      texto: 'Este botón («Guía» en pantallas estrechas) le guía paso a paso para montar un circuito del libro y explica qué agujeros están unidos por dentro.',
      objetivo: '[data-recorrido="proto-guia"]',
    },
    {
      titulo: 'El panel',
      texto: 'Esquema dibuja lo montado, Resultados muestra la simulación, Avisos los errores de montaje, Pieza los datos de lo elegido y Medir pone en la placa el Brymen y el FNIRSI simulados.',
      objetivo: '[data-recorrido="proto-panel"]',
    },
    {
      titulo: 'Sus montajes',
      texto: '«Guardar» guarda el montaje en este dispositivo, «Mis montajes» («Montajes» en pantallas estrechas) abre los guardados y «Nuevo» empieza una placa vacía.',
      objetivo: '[data-recorrido="proto-montajes"]',
    },
  ],
};

// ------------------------------------------------------------------ the simulator

const SIMULADOR: Recorrido = {
  id: 'simulador',
  nombre: 'Simulador',
  corto: 'Simulador',
  oferta: {
    antetitulo: 'Tutorial',
    titulo: '¿Le enseño el simulador?',
    texto: 'Cinco pasos con un circuito del libro: el dibujo, simular, las gráficas, cambiar valores y la netlist.',
    empezar: 'Empezar el tutorial',
  },
  inicio: '#/simulador/cap42/fig-42.5_filtro_rc',
  enSitio: sitio.netlist,
  pasos: [
    {
      titulo: 'Un circuito del libro',
      texto: 'Cada netlist del libro tiene su página: el dibujo de la figura, enlaces a las figuras y secciones donde sale, «Editar el esquema» y «Ver en protoboard».',
      objetivo: '[data-recorrido="sim-cabecera"]',
    },
    {
      titulo: 'Simular',
      texto: 'ngspice resuelve el circuito aquí mismo, sin conexión. La página lo simula al abrirse; «Simular» lo repite cuando cambia la netlist. Púlselo.',
      objetivo: '[data-recorrido="sim-simular"]',
      pulsar: true,
      logrado: 'Hecho: los resultados están debajo.',
    },
    {
      titulo: 'Las gráficas',
      texto: 'Elija qué curvas ver con los botones de las señales (v(in), v(out), i(v1)…). Al pasar el ratón o el dedo por la gráfica se lee el valor de cada punto; «Cursores» pone dos para medir entre ellos.',
      objetivo: '[data-recorrido="sim-resultados"]',
    },
    {
      titulo: 'Cambie un valor',
      texto: 'Los deslizadores de «Parámetros» cambian el valor de un componente y el circuito se vuelve a simular. «Fijar referencia» deja la curva de antes, tenue, para comparar.',
      objetivo: '[data-recorrido="parametros"]',
    },
    {
      titulo: 'La netlist',
      texto: 'Es el texto que simula ngspice. Puede editarla aquí; «Restaurar la del libro» la deja como estaba. «Nuevo circuito», en el simulador, empieza una en blanco.',
      objetivo: '[data-recorrido="sim-netlist"]',
    },
  ],
};

// ------------------------------------------------------------------ the consoles

const CONSOLAS: Recorrido = {
  id: 'consolas',
  nombre: 'Consolas',
  corto: 'Consolas',
  oferta: {
    antetitulo: 'Tutorial',
    titulo: '¿Le enseño las consolas?',
    texto: 'Cuatro pasos: elegir la consola, sus vistas, las piezas de la foto y la búsqueda de averías.',
    empezar: 'Empezar el tutorial',
  },
  inicio: '#/consolas/nes/foto',
  enSitio: sitio.consolas,
  pasos: [
    {
      titulo: 'Once consolas',
      texto: 'Toque el nombre para elegir otra placa: NES, Neo Geo AES, Master System II, Mega Drive, Game Boy y Game Boy Color, Super Nintendo, Nintendo 64, PlayStation, GameCube y Sega Saturn.',
      objetivo: '[data-elegir-consola]',
    },
    {
      titulo: 'Sus vistas',
      texto: 'Foto, Arquitectura, Un fotograma, Esquema, Placa en 3D y en 2D, Busque la avería y Fuentes. Cada consola tiene las que existen para su placa.',
      objetivo: '[data-recorrido="consola-vistas"]',
    },
    {
      titulo: 'Toque una pieza de la foto',
      texto: 'Cada recuadro es una pieza. Tóquela para ver qué es y qué hace; las otras vistas la marcan también.',
      objetivo: '[data-recorrido="consola-foto"]',
      hecho: () => /^#\/consolas\/[^/]+\/foto\/[^/]+/.test(location.hash),
      logrado: 'Hecho: la ficha de la pieza dice qué es y qué hace.',
    },
    {
      titulo: 'Busque la avería',
      texto: 'En las consolas que la tienen, una placa con un fallo escondido: ponga las puntas del Brymen simulado en los puntos de la placa, lea lo que marca y diga qué pieza falla.',
      objetivo: '[data-recorrido="consola-vistas"] [href*="/averia"]',
    },
  ],
};

export const RECORRIDOS: Record<IdRecorrido, Recorrido> = {
  app: APP,
  brymen: BRYMEN,
  'fnirsi-osc': FNIRSI_OSC,
  'fnirsi-mult': FNIRSI_MULT,
  banco: BANCO,
  protoboard: PROTOBOARD,
  simulador: SIMULADOR,
  consolas: CONSOLAS,
};

/** The tools' tutorials, in the order of the Guía's list. */
export const TUTORIALES: IdRecorrido[] = ['brymen', 'fnirsi-osc', 'fnirsi-mult', 'banco', 'protoboard', 'simulador', 'consolas'];
