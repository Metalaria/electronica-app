<script lang="ts">
  // 1.1 hand-authored lesson (#/leccion/<parte>/<label>[/<n>]), in the approved mock-up's style: one idea per card,
  // an interactive element at the centre, «Continuar» opened by interacting, every answer explained, a summary that
  // schedules the review. The cards come from libro/lecciones11/<parte>/<label>.json (web/scripts/lecciones11.mjs);
  // their rules are lib/leccion11/motor.ts and the values lib/leccion11/modelo.ts.
  //
  // Same contract as the 1.0 lesson (componentes/leccion/Leccion.svelte), so everything built on it keeps working:
  //   - progress in the `lecciones` store under «parte/label» (lib/lecciones.svelte.ts): `u` = card on show, `h` =
  //     cards passed, `n` = number of cards, `c` = completed (the summary); a section completed with 1.0 stays so;
  //   - the screens replace the URL (one history entry); close = back, or the section in the reader;
  //   - the daily goal counts each card passed and each card answered; answers are learning events (XP once per
  //     card, mastery of the section, which schedules the spaced review); the summary marks the section as read and
  //     reports «leccion-completada»;
  //   - keys: → or Intro continue (or check), ← back, Esc close, 1–5 / A–E choose an option.
  // Leaving a lesson half done asks first (lib/salida.ts, the app's own dialog).
  //
  // 1.2 shell (lib/leccion12/, README «Lecciones 1.2: la forma»): the visual on top of each card (widget or formula,
  // then the short text, then what is answered); the cards slide in (a fade with «reducir movimiento»); every check
  // gives its short sound/vibration (lib/aprendizaje/retroalimentacion.ts: the event's cue, or the same cue directly
  // once a round is closed and reports nothing); the cards missed in this visit (first check wrong, or skipped) come
  // back once at the end, before the summary (lib/leccion12/ritmo.ts), with their own segments in the progress bar;
  // the book block's colour for the circuit's wires and Inter / Space Grotesk / JetBrains Mono (tokens11.css).
  import { onMount, tick, untrack } from 'svelte';
  import { fly } from 'svelte/transition';
  import Award from '@lucide/svelte/icons/award';
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import X from '@lucide/svelte/icons/x';
  import Check from '@lucide/svelte/icons/check';
  import { app } from '../../lib/estado.svelte';
  import { ruta, hayCapas, reemplazarDireccion } from '../../lib/ruta.svelte';
  import { pasoVecino } from '../../lib/navegacion.svelte';
  import { cursosDeParte } from '../../lib/aprendizaje/cursos';
  import { cargarAprendizaje, marcarLeida } from '../../lib/aprendizaje.svelte';
  import { registrarActividad } from '../../lib/progreso-diario.svelte';
  import { anotarPaso, cargarLecciones, completarLeccion, completarPaso, progresoLecciones, rutaLeccion } from '../../lib/lecciones.svelte';
  import { emitir } from '../../lib/aprendizaje/eventos';
  import { cargarProgresoXp } from '../../lib/aprendizaje/progreso.svelte';
  import { cargarDominio, dominioDe, esperarDominio } from '../../lib/aprendizaje/dominio.svelte';
  import { cuandoRepaso, repasoDe } from '../../lib/aprendizaje/camino';
  import { registrarGuardaSalida } from '../../lib/salida';
  import { confirmar } from '../../lib/confirmar';
  import { cargarLeccion11 } from '../../lib/leccion11/datos';
  import { compilarModelo, formatear, objetivoEstimar, valoresDeTarjeta, type Valores } from '../../lib/leccion11/modelo';
  import {
    botonPrincipal, comprobar, esComprobable, estadoRespondido, eventoDeComprobacion, faltaPorExplorar, nuevoEstado, reintentar, resumenIntentos,
    type Aviso, type EstadoTarjeta,
  } from '../../lib/leccion11/motor';
  import { rutaClasica, rutaTarjeta, tarjetaDeRuta, restoDeAncla } from '../../lib/leccion11/ruta';
  import { textoPlano } from '../../lib/leccion11/texto';
  import { enRango } from '../../lib/leccion11/modelo';
  import type { Leccion11 } from '../../lib/leccion11/tipos';
  import { retro } from '../../lib/aprendizaje/retroalimentacion';
  import { dominadaDe } from '../../lib/aprendizaje/camino';
  import { anotarFallada, anterior, enVuelta, nuevoRitmo, posicion, segmentos, siguiente as siguienteRitmo, type Ritmo } from '../../lib/leccion12/ritmo';
  import { hiloDeBloque } from '../../lib/leccion12/identidad';
  import { movimiento } from '../figuras-vivas/carga.svelte';
  import Ecuacion from '../Ecuacion.svelte';
  import CelebracionLeccion from '../progreso/CelebracionLeccion.svelte';
  import CircuitoLeccion from './CircuitoLeccion.svelte';
  import GraficaLeccion from './GraficaLeccion.svelte';
  import Opciones from './Opciones.svelte';
  import Estimar from './Estimar.svelte';
  import Ordenar from './Ordenar.svelte';
  import Emparejar from './Emparejar.svelte';
  // 1.2 learning-by-doing steps and the hint ladder (motor12)
  import Actividad12 from '../leccion12/Actividad12.svelte';
  // motor12c: a book figure with zones, a logic circuit (GUIA §11)
  import Widget12 from '../leccion12/Widget12.svelte';
  import Escalera from '../leccion12/Escalera.svelte';
  import TextoVivo from './TextoVivo.svelte';

  let { parte, seccion }: { parte: string; seccion: string } = $props();

  let leccion = $state.raw<Leccion11 | null>(null);
  let error = $state('');
  let pantalla = $state(0);
  /** The reader's own values (what the controls moved), carried from card to card. */
  let propios = $state<Valores>({});
  let estados = $state<EstadoTarjeta[]>([]);
  let avisos = $state<(Aviso | null)[]>([]);
  /** Cards already shown in this visit (their starting values are applied once). */
  const vistas = new Set<number>();
  /** 1.2: the reader's values when each card was first shown (a missed card comes back with them). */
  const entradas = new Map<number, Valores>();
  let fallos = $state(0);
  let titulo: HTMLElement | undefined = $state();
  // the sticky header and footer: what the page leaves clear when the keyboard focus scrolls a control into view
  // (WCAG 2.4.11, focus not obscured: a slider at the bottom of a long card is not left under «Continuar»)
  let altoCab = $state(0);
  let altoPie = $state(0);
  $effect(() => {
    const raiz = document.documentElement;
    raiz.style.scrollPaddingTop = `${altoCab + 8}px`;
    raiz.style.scrollPaddingBottom = `${altoPie + 8}px`;
    return () => {
      raiz.style.scrollPaddingTop = '';
      raiz.style.scrollPaddingBottom = '';
    };
  });
  let terminada = $state(false);
  let empezada = $state(false);
  const inicioVisita = Date.now();
  let abierta = false;
  let fiesta = $state(false);
  let repaso = $state('');
  let respondidas = $state(0);
  let aCuenta = $state(0);

  const habiaEntrada = untrack(() => ruta.n) > 1;
  const contados = new Set<string>();
  let desmontada = false;

  const n = $derived(leccion?.tarjetas.length ?? 0);
  /** 1.2: the order of the cards in this visit (the missed ones come back before the summary). */
  let ritmo = $state.raw<Ritmo>(nuevoRitmo());
  /** Every card shown, a returning one included, is a new visit of the card body (its transition). */
  let visita = $state(0);
  let haciaAtras = $state(false);
  /** The section is «dominada» after this lesson (summary; lib/aprendizaje/camino.ts dominadaDe). */
  let dominada = $state(false);
  const segs = $derived(leccion ? segmentos(ritmo, n, pantalla) : []);
  const pos = $derived(leccion ? posicion(ritmo, n, pantalla) : { x: 1, de: 1 });
  /** The wires of the circuits in the block colour of the lesson's chapter (lib/leccion12/identidad.ts). */
  const hilo = $derived(hiloDeBloque(app.indice?.partes[parte]?.color, app.tema));
  // 1.2 (consolas-A): a lesson of the «Consolas por dentro» course is not a book section: no page to read nor 1.0
  // lesson; it closes to its course, and each card links the sources it cites (the console's data and external pages,
  // and the book sections it relates to: scripts/consolas11.mjs adds them to each citation)
  const deConsola = $derived(app.indice?.partes[parte]?.tipo === 'consola');
  const salida = $derived(deConsola ? `#/cursos/${cursosDeParte(parte)[0]?.id ?? ''}` : `#/${parte}/${encodeURIComponent(seccion)}`);
  const fuentesTarjeta = $derived.by(() => {
    const out: { href: string; texto: string; externo: boolean }[] = [];
    if (!leccion?.consola || !t) return out;
    for (const k of t.libro) {
      const c = leccion.libro[k];
      let x: (typeof out)[number] | null = null;
      // (the explorer's own data: one link to the first view the card cites; an external page: each one)
      if (c?.fuente && c.fuente.url.startsWith('#/consolas/')) {
        if (!out.some((y) => y.href.startsWith('#/consolas/'))) x = { href: c.fuente.url, texto: `Fuente: ${c.fuente.titulo}`, externo: false };
      } else if (c?.fuente) x = { href: c.fuente.url, texto: `Fuente: ${c.fuente.titulo}`, externo: /^https?:/.test(c.fuente.url) };
      else if (c?.seccion) {
        const s = app.indice?.partes[c.parte]?.secciones?.find((y) => y.label === c.seccion);
        x = { href: `#/${c.parte}/${encodeURIComponent(c.seccion)}`, texto: `Del libro: sección ${s?.num ?? s?.titulo ?? c.seccion}`, externo: false };
      }
      if (x && !out.some((y) => y.href === x.href)) out.push(x);
    }
    return out;
  });
  const t = $derived(leccion ? leccion.tarjetas[Math.min(pantalla, n - 1)]! : null);
  const e = $derived(estados[pantalla] ?? null);
  const aviso = $derived(avisos[pantalla] ?? null);
  /** Cards left with «Saltar» in this visit (their hidden reading is shown when the reader comes back to them). */
  let saltadas = $state<number[]>([]);
  // Review 11c: a prediction's hidden reading («¿? V») is shown once the card is answered right or skipped — not with
  // the explanation of a wrong option, or the retry would be answered by the screen (the explanation stays).
  const oculto = $derived(!!t?.widget?.ocultar && !!e && !e.resuelta && !saltadas.includes(pantalla));
  const mc = $derived(leccion ? compilarModelo(leccion.modelo) : null);
  // (1.2: with the card's state, so an «averia» card's widget shows the faulty board)
  const efectivos = $derived(t ? valoresDeTarjeta(t, propios, e) : {});
  const evaluados = $derived(mc ? mc.evaluar(efectivos) : {});
  // fix12: an «averia» card's widget must not give the fault away. Until the fault of the board on show is found (or
  // the card skipped) the circuit shows the healthy board's values (the labels say the nominal «R₂ 5 kΩ», not the
  // faulty «1 GΩ»; the description for screen readers too) and comes as a prediction (`oculto`): no reading, no
  // voltage colours, legend or «Ver valores», particles at one neutral speed. The probes (BuscarAveria) still measure
  // the faulty board.
  const averiaOculta = $derived(t?.actividad?.tipo === 'averia' && !!e && !(e.comprobado && e.bien) && !saltadas.includes(pantalla));
  const nominales = $derived(t && averiaOculta ? valoresDeTarjeta(t, propios, null) : efectivos);
  const evaluadosWidget = $derived(mc && averiaOculta ? mc.evaluar(nominales) : evaluados);
  const ocultoWidget = $derived(oculto || averiaOculta);
  function valorWidget(id: string): string {
    return formatear(mc?.magnitud(id) ?? null, evaluadosWidget[id]);
  }
  const boton = $derived(t && e ? botonPrincipal(t, e, evaluados) : null);
  const falta = $derived(leccion && t && e && boton?.bloqueado && !esComprobable(t) ? faltaPorExplorar(leccion, t, e, evaluados) : '');
  const prefijo = $derived(`l11-${pantalla}`);
  const siguiente = $derived.by(() => {
    if (!app.indice) return null;
    let v = pasoVecino(parte, seccion, 1);
    while (v && !v.label) v = pasoVecino(v.parte, v.label, 1);
    return v?.label ? v : null;
  });

  function valor(id: string): string {
    return formatear(mc?.magnitud(id) ?? null, evaluados[id]);
  }

  async function ir(k: number, enfocar = true, fresca = false) {
    if (!leccion || desmontada) return;
    const destino = Math.max(0, Math.min(k, n - 1));
    const tt = leccion.tarjetas[destino]!;
    if (!vistas.has(destino)) {
      vistas.add(destino);
      if (Object.keys(tt.inicio).length) propios = { ...propios, ...tt.inicio };
      estados[destino] ??= nuevoEstado(tt);
      entradas.set(destino, propios);
    } else if (fresca) {
      // 1.2: a missed card coming back: answered afresh (a new round), from the values it had when it was first shown
      // (a load connected on a later card must not change its question), its reading hidden again if a prediction
      propios = { ...(entradas.get(destino) ?? propios), ...tt.inicio };
      estados[destino] = nuevoEstado(tt);
      avisos[destino] = null;
      saltadas = saltadas.filter((x) => x !== destino);
    }
    pantalla = destino;
    visita++;
    const h = rutaTarjeta(parte, seccion, destino);
    reemplazarDireccion(h);
    anotarPaso(parte, seccion, destino, n);
    if (tt.tipo === 'resumen') terminar();
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (enfocar) {
      await tick();
      titulo?.focus({ preventScroll: true });
    }
  }

  function contar(clave: string, tipo: 'paso' | 'pregunta') {
    if (contados.has(clave)) return;
    contados.add(clave);
    registrarActividad(tipo);
  }

  function terminar() {
    if (!leccion) return;
    const primera = completarLeccion(parte, seccion, n);
    terminada = true;
    void cargarAprendizaje().then(() => marcarLeida(parte, seccion, true));
    if (abierta && !fiesta) {
      fiesta = true;
      emitir({ tipo: 'leccion-completada', parte, seccion, primera });
    }
    // the review this lesson's answers schedule (mastery of the section, as the course path shows it)
    void esperarDominio()
      .then(() => {
        if (desmontada) return;
        const ahora = Date.now();
        const d = dominioDe(`${parte}/${seccion}`);
        const r = repasoDe(d, ahora);
        dominada = dominadaDe(d, ahora);
        repaso = r.k === 'ahora' ? 'Para repasar hoy' : r.k === 'flojo' ? 'Para repasar pronto' : r.k === 'fecha' ? `Repaso programado ${cuandoRepaso(r.t, ahora)}` : '';
      })
      .catch(() => undefined);
  }

  function alMover(id: string, x: number) {
    if (!t || !e) return;
    empezada = true;
    propios = { ...propios, [id]: x };
    const cambios: Partial<EstadoTarjeta> = {};
    if (!e.movidos.includes(id)) cambios.movidos = [...e.movidos, id];
    // moving a challenge's values after a failed check takes the verdict away (it no longer describes them)
    if (e.comprobado && !e.bien && t.condiciones) {
      cambios.comprobado = false;
      cambios.bien = null;
      avisos[pantalla] = null;
    }
    if (Object.keys(cambios).length) estados[pantalla] = { ...e, ...cambios };
  }

  function cambiarEstado(c: Partial<EstadoTarjeta>) {
    if (!e) return;
    empezada = true;
    estados[pantalla] = { ...e, ...c };
  }

  function principal(ev?: MouseEvent) {
    if (!leccion || !t || !e || !boton || boton.bloqueado) return;
    // the second click of a double tap landed on the next card's button, in the same place (1.0 lesson, 0.11 QA)
    if (ev && ev.detail > 1) return;
    if (boton.accion === 'comprobar') {
      const { estado, aviso: a } = comprobar(leccion, t, e, efectivos);
      const ev2 = eventoDeComprobacion(leccion, t, e, estado);
      if (ev2) {
        emitir(ev2.evento);
        estado.cerrada = ev2.cerrada;
      } else {
        // 1.2: a closed round reports nothing, but every check still gets its short cue (no-op on desktop)
        retro(estado.bien ? 'acierto' : 'fallo');
      }
      if (!estado.bien) fallos++;
      if (e.intentos === 0 && !enVuelta(ritmo)) {
        respondidas++;
        if (estado.bien) aCuenta++;
        else ritmo = anotarFallada(ritmo, pantalla);
      }
      estados[pantalla] = estado;
      avisos[pantalla] = a;
      empezada = true;
      contar(`q${pantalla}`, 'pregunta');
      return;
    }
    if (boton.accion === 'reintentar') {
      estados[pantalla] = reintentar(t, e);
      avisos[pantalla] = null;
      void tick().then(() => document.querySelector<HTMLElement>('[data-tarjeta] .opcion:not([aria-disabled="true"]), [data-tarjeta] [role="slider"]')?.focus());
      return;
    }
    // continue
    if (t.tipo === 'resumen') {
      cerrar();
      return;
    }
    completarPaso(parte, seccion, pantalla, n);
    contar(`p${pantalla}`, 'paso');
    empezada = true;
    avanzar();
  }

  /** The next card of this visit's rhythm (a missed card coming back, or the next one). */
  function avanzar() {
    const p = siguienteRitmo(ritmo, pantalla, n);
    ritmo = p.ritmo;
    haciaAtras = false;
    void ir(p.destino, true, p.fresca);
  }

  /** «Saltar» after two failed checks: the card counts as passed (nothing more is reported). */
  function saltar() {
    if (!t || t.tipo === 'resumen') return;
    if (!saltadas.includes(pantalla)) saltadas = [...saltadas, pantalla];
    ritmo = anotarFallada(ritmo, pantalla);
    completarPaso(parte, seccion, pantalla, n);
    contar(`p${pantalla}`, 'paso');
    avanzar();
  }

  /** «Repasar la lección desde el principio»: every card fresh again (its answers are new rounds for the review). */
  function repetir() {
    if (!leccion) return;
    const base: Valores = {};
    for (const [k, v] of Object.entries(leccion.modelo.valores)) base[k] = v.valor;
    propios = base;
    estados = leccion.tarjetas.map((x) => nuevoEstado(x));
    avisos = leccion.tarjetas.map(() => null);
    vistas.clear();
    entradas.clear();
    saltadas = [];
    fallos = 0;
    ritmo = nuevoRitmo();
    haciaAtras = false;
    void ir(0);
  }

  function atras() {
    if (pantalla === 0 && !enVuelta(ritmo)) return;
    const p = anterior(ritmo, pantalla, n);
    ritmo = p.ritmo;
    haciaAtras = true;
    void ir(p.destino);
  }

  function cerrar() {
    if (habiaEntrada) history.back();
    else location.replace(salida);
  }

  function irSiguiente() {
    if (siguiente?.label) location.replace(rutaLeccion(siguiente.parte, siguiente.label));
  }

  function elegirOpcion(k: number) {
    if (!t?.opciones || !e || e.comprobado || e.resuelta || e.descartadas.includes(k) || k >= t.opciones.length) return;
    cambiarEstado({ eleccion: k });
  }

  function teclas(ev: KeyboardEvent) {
    if (ev.ctrlKey || ev.metaKey || ev.altKey || !leccion || !t) return;
    if (app.figura || app.buscador || hayCapas() || document.querySelector('[aria-modal="true"]')) return;
    const d = ev.target as HTMLElement | null;
    const desactivado = !!d && ((d as HTMLButtonElement).disabled === true || d.getAttribute('aria-disabled') === 'true');
    const libre = !d || d === document.body || d === titulo || desactivado || !d.closest('a, button, input, textarea, select, summary, [tabindex]:not([tabindex="-1"]), [contenteditable="true"], [role="slider"]');
    if (ev.key === 'Escape') {
      ev.preventDefault();
      cerrar();
      return;
    }
    // Review 11c: 1–5 / A–E also work while an option has the focus (a click on one, or «Volver a intentarlo», which
    // puts the focus on the first option left): a digit or a letter does nothing on a button. → and Intro keep their
    // native meaning there (Intro presses the option).
    const enOpciones = !libre && !!t.opciones && !!d?.closest('[data-tarjeta] .opciones');
    if (ev.shiftKey || (!libre && !enOpciones)) return;
    if (enOpciones && (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft' || ev.key === 'Enter')) return;
    if (ev.key === 'ArrowRight' || ev.key === 'Enter') {
      if (!boton || boton.bloqueado || t.tipo === 'resumen') return;
      ev.preventDefault();
      principal();
    } else if (ev.key === 'ArrowLeft') {
      if (pantalla === 0 && !enVuelta(ritmo)) return;
      ev.preventDefault();
      atras();
    } else if (t.opciones) {
      const k = '12345'.indexOf(ev.key) >= 0 ? '12345'.indexOf(ev.key) : 'abcde'.indexOf(ev.key.toLowerCase());
      if (k >= 0 && ev.key.length === 1) {
        ev.preventDefault();
        elegirOpcion(k);
      }
    }
  }

  onMount(() => {
    app.seccion = null;
    void cargarLecciones();
    void cargarProgresoXp();
    void cargarDominio().catch(() => undefined);
    (async () => {
      try {
        const l = await cargarLeccion11(parte, seccion);
        if (desmontada) return;
        const base: Valores = {};
        for (const [k, v] of Object.entries(l.modelo.valores)) base[k] = v.valor;
        propios = base;
        estados = l.tarjetas.map((x) => nuevoEstado(x));
        avisos = l.tarjetas.map(() => null);
        leccion = l;
        // A card number in the URL that came from the 1.0 lesson's progress (the course's «Continuar» of a section half
        // studied with 1.0: its steps, not these cards) means nothing here: such a lesson starts at its first card.
        const resto = restoDeAncla(untrack(() => ruta.ancla));
        let k = tarjetaDeRuta(resto, l.tarjetas.length);
        await cargarLecciones().catch(() => undefined);
        const previo = progresoLecciones.secciones[`${parte}/${seccion}`];
        if (k > 0 && previo && !previo.c && previo.n !== l.tarjetas.length) k = 0;
        // Review 11c: an address without a card number (the book's «Estudiar por pasos», the course path's node, a
        // project stage's link) opens the card the reader left — «Al volver, seguirá aquí» — instead of card 1, which
        // would also have overwritten that saved position. A finished lesson starts again at its first card.
        else if (!resto && previo && !previo.c && previo.n === l.tarjetas.length && previo.u > 0) k = Math.min(previo.u, l.tarjetas.length - 1);
        if (desmontada) return;
        // (review 11c) the questions answered in an earlier visit of this unfinished lesson show as answered
        if (previo && !previo.c && previo.n === l.tarjetas.length) {
          for (const j of previo.h) {
            const tj = l.tarjetas[j];
            if (!tj || !esComprobable(tj)) continue;
            const r = estadoRespondido(tj);
            estados[j] = r.estado;
            avisos[j] = r.aviso;
          }
        }
        // the cards before the one in the URL set their starting values, as if the reader had come through them
        for (let j = 0; j < k; j++) {
          vistas.add(j);
          propios = { ...propios, ...l.tarjetas[j]!.inicio };
        }
        await ir(k, false);
        abierta = true;
      } catch (err) {
        if (!desmontada) error = err instanceof Error ? err.message : String(err);
      }
    })();
    const quitarGuarda = registrarGuardaSalida(
      () =>
        confirmar({
          titulo: '¿Salir de la lección?',
          mensaje: `Va por la tarjeta ${pantalla + 1} de ${n}. Al volver, seguirá aquí.`,
          aceptar: 'Salir',
          cancelar: 'Seguir en la lección',
          seguirEnRuta: true,
        }),
      // (the cards replace the address, so the only route changes are leaving: the close button, Back, a link)
      () => empezada && !terminada && !desmontada,
    );
    return () => {
      desmontada = true;
      quitarGuarda();
    };
  });

  // Back from the reader (or forward) into this lesson: the URL says which card.
  let vistaN = untrack(() => ruta.n);
  $effect(() => {
    const nn = ruta.n;
    if (nn === vistaN || !leccion) return;
    vistaN = nn;
    const k = untrack(() => tarjetaDeRuta(restoDeAncla(ruta.ancla), n));
    if (k !== untrack(() => pantalla)) void ir(k, false);
  });

  const objetivo = $derived(t?.estimar && mc ? objetivoEstimar(mc, t.estimar, efectivos) : 0);
  const textoPlanoValor = (x: Parameters<typeof textoPlano>[0]) => textoPlano(x, valor);
</script>

<svelte:window onkeydown={teclas} />
<svelte:head>
  <title>{leccion ? `${leccion.num ? `${leccion.num} ` : ''}${leccion.titulo} · Lección` : 'Lección'} · Electrónica Práctica Avanzada</title>
</svelte:head>

<div class="l11" data-leccion11={`${parte}/${seccion}`} data-tarjeta-n={pantalla} data-vuelta={enVuelta(ritmo) ? '' : undefined} style:--v11-bloque={hilo}>
  {#if error}
    <div class="aviso-error">
      <h1>No se pudo abrir la lección</h1>
      <p>{error}</p>
      {#if !deConsola}<p><a href={rutaClasica(parte, seccion)}>Abrir la lección por pasos del libro</a></p>{/if}
    </div>
  {:else if !leccion || !t || !e}
    <div class="cargando" aria-live="polite">Preparando la lección…</div>
  {:else}
    <div class="hoja">
      <header class="cab" bind:clientHeight={altoCab}>
        <button type="button" class="icono" aria-label="Tarjeta anterior" disabled={pantalla === 0 && !enVuelta(ritmo)} onclick={atras} data-atras><ArrowLeft size={22} strokeWidth={2.2} aria-hidden="true" /></button>
        <!-- (motor12b: with many cards the 5 px gaps alone outgrew a 360 px header and pushed «Cerrar» off the screen) -->
        <div class="segmentos" class:muchos={segs.length > 24} role="progressbar" aria-label={`Tarjeta ${pos.x} de ${pos.de}`} aria-valuemin={1} aria-valuemax={pos.de} aria-valuenow={pos.x}>
          {#each segs as s, i (i)}
            <span class="seg" class:hecho={s.estado === 'hecho'} class:actual={s.estado === 'actual'} class:vuelta={s.vuelta} data-seg={s.vuelta ? 'vuelta' : s.estado}></span>
          {/each}
        </div>
        <button type="button" class="icono" aria-label="Cerrar la lección" onclick={cerrar} data-cerrar><X size={22} strokeWidth={2.2} aria-hidden="true" /></button>
      </header>

      <div class="cuerpo" data-tarjeta={t.id} data-tipo={t.tipo}>
        {#key visita}
          <div class="pantalla" in:fly={{ x: haciaAtras ? -28 : 28, duration: movimiento.reducido ? 0 : 220, opacity: 0 }}>
          {#if t.tipo === 'resumen'}
            <section class="resumen" data-resumen>
              <span class="sello" aria-hidden="true"><Check size={44} strokeWidth={2.4} /></span>
              <h1 bind:this={titulo} tabindex="-1"><TextoVivo texto={t.titulo} {valor} /></h1>
              <p class="suave" data-intentos>{resumenIntentos(fallos)}{#if ritmo.vuelta.length}{` ${ritmo.vuelta.length === 1 ? 'Una tarjeta volvió' : `${ritmo.vuelta.length} tarjetas volvieron`} al final para repasarla${ritmo.vuelta.length === 1 ? '' : 's'}.`}{/if}</p>
              {#if dominada}<p class="dominada" data-dominada><Award size={18} aria-hidden="true" /> Sección dominada</p>{/if}
              <CelebracionLeccion inicio={inicioVisita} aciertos={aCuenta} {respondidas} {fiesta} />
              <ul class="ideas">
                {#each t.ideas ?? [] as idea, k (k)}
                  <li><strong><TextoVivo texto={idea.titulo} {valor} /></strong> <TextoVivo texto={idea.texto} {valor} /></li>
                {/each}
              </ul>
              <p class="suave centro" data-repaso>
                {#if repaso}{repaso}{/if}{#if repaso && siguiente} · {/if}{#if siguiente}Siguiente: {siguiente.num ? `${siguiente.num} ` : ''}{siguiente.titulo}{/if}
              </p>
              <div class="enlaces">
                {#if !deConsola}<a href={rutaClasica(parte, seccion)} data-clasica>Ver la sección por pasos, con el texto del libro y más práctica</a>{/if}
                <button type="button" class="enlace" onclick={repetir} data-repetir>Repasar la lección desde el principio</button>
              </div>
            </section>
          {:else}
            <span class="etiqueta">{pos.x} de {pos.de} · {enVuelta(ritmo) ? 'Repaso' : t.fase}</span>
            <h1 bind:this={titulo} tabindex="-1"><TextoVivo texto={t.titulo} {valor} /></h1>

            <!-- 1.2, one idea per screen: the visual on top (the formula first on a «formula» card, then the widget that
                 moves it), then the short text, then what is answered -->
            {#if t.ec}
              <div class="formula" data-formula>
                <div class="ec"><Ecuacion bloque={{ t: 'ec', svg: t.ec.svg, fuente: t.ec.fuente, w: t.ec.w, h: t.ec.h }} /></div>
                {#if t.sustitucion}
                  <p class="sustitucion" aria-label={`Con sus valores: ${textoPlanoValor(t.sustitucion)}`} data-sustitucion>
                    <span class="suave">Con sus valores:</span> <TextoVivo texto={t.sustitucion} {valor} />
                  </p>
                {/if}
              </div>
            {/if}
            {#if t.widget?.tipo === 'circuito'}
              <CircuitoLeccion {leccion} widget={t.widget} valores={evaluadosWidget} propios={nominales} oculto={ocultoWidget} {prefijo} valor={valorWidget} {alMover} />
            {:else if t.widget?.tipo === 'grafica'}
              <GraficaLeccion {leccion} widget={t.widget} valores={evaluadosWidget} propios={nominales} oculto={ocultoWidget} {prefijo} valor={valorWidget} {alMover} />
            {:else if t.widget?.tipo === 'figura' || t.widget?.tipo === 'logica'}
              <Widget12 {t} {e} oculto={ocultoWidget} {prefijo} cambiar={cambiarEstado} />
            {/if}

            {#if t.texto.length}<p class="texto"><TextoVivo texto={t.texto} {valor} /></p>{/if}
            {#if t.nota}<p class="nota"><TextoVivo texto={t.nota} {valor} /></p>{/if}

            {#if t.condiciones}
              <div class="chips" data-condiciones>
                {#each t.condiciones as c, k (k)}
                  {@const ok = enRango(c, evaluados)}
                  <span class="chip" class:ok data-condicion={k} data-cumple={ok ? 'si' : 'no'}><span class="solo-lector">{ok ? 'Cumple: ' : 'No cumple todavía: '}</span><TextoVivo texto={c.rotulo} {valor} /></span>
                {/each}
              </div>
            {/if}

            {#if t.opciones}
              <Opciones opciones={t.opciones} eleccion={e.eleccion} descartadas={e.descartadas} comprobado={e.comprobado} bien={e.bien} resuelta={e.resuelta} {valor} elegir={elegirOpcion} />
            {:else if t.estimar}
              <Estimar estimar={t.estimar} estimacion={e.estimacion} {objetivo} comprobado={e.comprobado} resuelta={e.resuelta} {prefijo} mover={(x) => cambiarEstado({ estimacion: x, comprobado: false, bien: null })} />
            {:else if t.ordenar}
              <Ordenar elementos={t.ordenar.elementos} orden={e.orden} bloqueado={e.resuelta} comprobado={e.comprobado} {valor} cambiar={(o) => cambiarEstado({ orden: o, comprobado: false, bien: null })} />
            {:else if t.emparejar}
              <Emparejar parejas={t.emparejar.parejas} inicio={t.emparejar.inicio} puestas={e.puestas} bloqueado={e.resuelta} comprobado={e.comprobado} {valor} cambiar={(p) => cambiarEstado({ puestas: p, comprobado: false, bien: null })} />
            {/if}
            <!-- leccion12: actividad (motor12) -->
            {#if t.actividad}
              <Actividad12 {leccion} {t} {e} valores={evaluados} {efectivos} {prefijo} {valor} cambiar={cambiarEstado} />
            {/if}
            {#if esComprobable(t)}<Escalera {t} {e} {valor} cambiar={cambiarEstado} />{/if}

            {#if leccion.consola}
              <ul class="fuentes-tarjeta" data-libro={t.libro.join(' ')} data-fuentes>
                {#each fuentesTarjeta as f (f.href)}
                  <li><a class="libro" href={f.href} target={f.externo ? '_blank' : undefined} rel={f.externo ? 'noopener noreferrer' : undefined}>{f.texto}</a></li>
                {/each}
              </ul>
            {:else}
              <a class="libro" href={`#/${parte}/${encodeURIComponent(seccion)}`} data-libro={t.libro.join(' ')}>Del libro: sección {leccion.num || leccion.titulo}</a>
            {/if}
          {/if}
          </div>
        {/key}
      </div>

      <footer class="pie" bind:clientHeight={altoPie}>
        {#if aviso}
          <div class={`banner ${aviso.bien ? 'bien' : 'mal'}`} role="status" data-veredicto={aviso.bien ? 'bien' : 'mal'}>
            <strong>{aviso.titulo}</strong>
            {#each aviso.textos as x, k (k)}<p><TextoVivo texto={x} {valor} /></p>{/each}
          </div>
        {/if}
        {#if falta}<p class="falta" id="l11-falta">{falta}</p>{/if}
        <div class="botones">
          {#if t.tipo === 'resumen'}
            <button type="button" class="secundario" onclick={cerrar} data-volver-libro>{deConsola ? 'Volver al curso' : 'Volver al libro'}</button>
            {#if siguiente}
              <button type="button" class="primario" onclick={irSiguiente} data-siguiente-leccion>Siguiente sección</button>
            {:else}
              <button type="button" class="primario" onclick={cerrar} data-continuar>Terminar</button>
            {/if}
          {:else}
            {#if esComprobable(t) && e.intentos >= 2 && !e.resuelta}
              <button type="button" class="secundario" onclick={saltar} data-saltar>Saltar</button>
            {/if}
            <button
              type="button"
              class="primario"
              disabled={boton?.bloqueado}
              aria-describedby={falta ? 'l11-falta' : undefined}
              onclick={principal}
              data-continuar
              data-accion={boton?.accion}>{boton?.texto}</button
            >
          {/if}
        </div>
      </footer>
    </div>
  {/if}
</div>

<style>
  .l11 {
    min-height: 100vh;
    min-height: 100dvh;
    background: var(--v11-marco);
    color: var(--v11-tinta);
    font-family: var(--v11-texto);
  }
  .hoja {
    display: flex;
    flex-direction: column;
    max-width: 640px;
    min-height: 100vh;
    min-height: 100dvh;
    margin: 0 auto;
    background: var(--v11-fondo);
  }
  .cab {
    position: sticky;
    top: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: calc(10px + env(safe-area-inset-top)) 8px 8px;
    background: var(--v11-fondo);
  }
  .icono {
    flex: none;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border: 0;
    border-radius: 12px;
    background: transparent;
    color: var(--v11-tinta);
    cursor: pointer;
  }
  .icono:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .segmentos {
    flex: 1;
    min-width: 0;
    display: flex;
    gap: 5px;
  }
  .segmentos.muchos {
    gap: 2px;
  }
  .seg {
    flex: 1;
    height: 8px;
    border-radius: 4px;
    background: var(--v11-pendiente);
    transition: background 0.3s;
  }
  .seg.hecho {
    background: var(--v11-hecho);
  }
  .seg.actual {
    background: var(--v11-actual);
  }
  /* 1.2: the segments of the cards that come back at the end (narrower, before the summary's) */
  .seg.vuelta {
    flex: 0.6;
  }
  .seg.vuelta:not(.hecho):not(.actual) {
    background: var(--v11-mal-tinte);
    box-shadow: inset 0 0 0 1.5px var(--v11-mal);
  }
  .cuerpo {
    flex: 1 0 auto;
    display: flex;
    flex-direction: column;
    padding: 4px 20px 20px;
    /* the card enters with a horizontal fly; clip it so the page never gets wider than the screen meanwhile */
    overflow-x: clip;
  }
  .pantalla {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .dominada {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 999px;
    background: var(--v11-azul-tinte);
    color: var(--v11-azul);
    font-weight: 700;
  }
  .etiqueta {
    color: var(--v11-tinta-suave);
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  h1 {
    margin: 0;
    font: 700 25px/1.2 var(--v11-titular);
    text-wrap: balance;
  }
  h1:focus {
    outline: none;
  }
  .texto {
    margin: 0;
    font-size: 16px;
    line-height: 1.5;
  }
  .formula {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px 16px;
    border: 1.5px solid var(--v11-linea);
    border-radius: var(--v11-radio-panel);
  }
  .ec {
    --tinta: var(--v11-tinta);
    --tam: 20px;
    color: var(--v11-tinta);
    font-size: 20px;
  }
  .ec :global(.ec) {
    margin: 0;
  }
  /* the 1.0 equation's «Calcular» button, at the 1.1 touch size */
  .ec :global(.calcular) {
    min-height: 44px;
  }
  .ec :global(.ec-marco) {
    padding: 4px 0;
    background: transparent;
    text-align: left;
  }
  .sustitucion {
    margin: 0;
    font-size: 15px;
    font-variant-numeric: tabular-nums;
  }
  .nota {
    margin: 0;
    padding: 10px 12px;
    border-radius: 10px;
    background: var(--v11-panel);
    font-size: 14px;
    line-height: 1.45;
  }
  .suave {
    color: var(--v11-tinta-suave);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .chip {
    padding: 7px 12px;
    border-radius: 999px;
    background: var(--v11-mal-tinte);
    color: var(--v11-mal-texto);
    font-size: 14px;
    font-weight: 600;
  }
  .chip.ok {
    background: var(--v11-bien-tinte);
    color: var(--v11-bien-texto);
  }
  .fuentes-tarjeta {
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .libro {
    display: inline-flex;
    align-items: center;
    align-self: flex-start;
    min-height: 44px;
    color: var(--v11-azul);
    font-size: 14px;
    font-weight: 600;
  }
  .pie {
    position: sticky;
    bottom: 0;
    z-index: 2;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 10px 16px calc(16px + env(safe-area-inset-bottom));
    border-top: 1px solid var(--v11-linea);
    background: var(--v11-fondo);
  }
  .banner {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px 14px;
    border-radius: 14px;
    font-size: 14px;
    line-height: 1.45;
  }
  .banner strong {
    font-size: 16px;
  }
  .banner p {
    margin: 0;
  }
  .banner.bien {
    background: var(--v11-bien-tinte);
    color: var(--v11-bien-texto);
  }
  .banner.mal {
    background: var(--v11-mal-tinte);
    color: var(--v11-mal-texto);
  }
  .falta {
    margin: 0;
    color: var(--v11-tinta-suave);
    font-size: 14px;
    text-align: center;
  }
  .botones {
    display: flex;
    gap: 10px;
  }
  .primario,
  .secundario {
    min-height: 54px;
    border-radius: var(--v11-radio-boton);
    font: 600 17px var(--v11-texto);
    cursor: pointer;
    transition: background 0.2s;
  }
  .primario {
    flex: 1;
    border: 0;
    background: var(--v11-azul);
    color: var(--v11-sobre-azul);
  }
  .primario:hover:not(:disabled) {
    background: var(--v11-azul-hover);
  }
  .primario:disabled {
    background: var(--v11-inactivo);
    color: var(--v11-sobre-inactivo);
    cursor: default;
  }
  .secundario {
    padding: 0 18px;
    border: 2px solid var(--v11-borde);
    background: var(--v11-fondo);
    color: var(--v11-tinta);
  }
  button:focus-visible,
  a:focus-visible {
    outline: 3px solid var(--v11-foco);
    outline-offset: 2px;
  }
  .resumen {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 18px 0 4px;
    text-align: center;
  }
  .sello {
    display: grid;
    place-items: center;
    width: 84px;
    height: 84px;
    border-radius: 50%;
    background: var(--v11-bien-tinte);
    color: var(--v11-bien);
  }
  .resumen p {
    margin: 0;
  }
  .ideas {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
    margin: 0;
    padding: 0;
    list-style: none;
    text-align: left;
  }
  .ideas li {
    padding: 12px 14px;
    border-radius: 14px;
    background: var(--v11-panel);
    font-size: 15px;
    line-height: 1.45;
  }
  .centro {
    font-size: 14px;
  }
  .enlaces {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  .enlaces a,
  .enlace {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0 6px;
    border: 0;
    background: transparent;
    color: var(--v11-azul);
    font: 600 15px var(--v11-texto);
    cursor: pointer;
  }
  .cargando,
  .aviso-error {
    max-width: 36em;
    margin: 0 auto;
    padding: 30vh 20px;
    color: var(--v11-tinta-suave);
    text-align: center;
  }
  .solo-lector {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  @media (prefers-reduced-motion: reduce) {
    .seg,
    .primario,
    .secundario {
      transition: none;
    }
  }
</style>
