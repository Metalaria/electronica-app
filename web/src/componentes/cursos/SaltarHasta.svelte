<script lang="ts">
  // 1.0 «Saltar hasta aquí»: the short check that opens a locked node of a course's path. A few Repaso questions of
  // the lessons the jump skips — only theirs (QA 1.0: fewer questions when they have fewer; with none, the jump is
  // allowed with a note) —, with «No lo sé»; passed with at most one miss (all right under four questions), those
  // lessons are marked «superadas por la prueba» (cursos.superadas, the placement test's own mark: not completed, no
  // XP, «Deshacer» removes them). No new data. Used by thematic and own courses.
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import FastForward from '@lucide/svelte/icons/fast-forward';
  import { rotuloParte } from '../../lib/datos';
  import { app } from '../../lib/estado.svelte';
  import { corto } from '../../lib/navegacion.svelte';
  import { desmarcarSuperadas, marcarSuperadas, estadoCursos } from '../../lib/aprendizaje/cursos-estado.svelte';
  import { conceptoDeRef } from '../../lib/aprendizaje/catalogo';
  import { aprobadoSalto, preguntasDelSalto, PREGUNTAS_SALTO } from '../../lib/aprendizaje/camino';
  import { cargarEjercicios } from '../../lib/ejercicios.svelte';
  import { barajar, cargarCuestionario, type Pregunta as TPregunta } from '../repaso/datos';
  import Pregunta, { type Respuesta } from '../pregunta/Pregunta.svelte';
  import CabeceraPasos from '../pregunta/CabeceraPasos.svelte';
  import PieAcciones from '../pregunta/PieAcciones.svelte';

  let {
    destino,
    hrefDestino,
    lecciones,
    volver,
    contexto,
  }: {
    /** Title of the node reached. */
    destino: string;
    hrefDestino: string;
    /** The lessons skipped («parte/label»), in order. */
    lecciones: string[];
    /** The path's route. */
    volver: string;
    /** «Cursos · Fundamentos». */
    contexto: string;
  } = $props();

  interface Item {
    parte: string;
    p: TPregunta;
    orden: number[];
  }

  let fase = $state<'intro' | 'cargando' | 'preguntas' | 'resultado'>('intro');
  let items = $state<Item[]>([]);
  let respuestas = $state<(Respuesta | null)[]>([]);
  let k = $state(0);
  let error = $state('');
  let marcadas = $state<string[]>([]);
  let titulo: HTMLElement | undefined = $state();
  /** The questions about the skipped lessons (null while loading). */
  let disponibles = $state<Item[] | null>(null);
  /** The jump was taken without a check (the lessons have no questions). */
  let sinPrueba = $state(false);

  const indice = $derived(app.indice!);
  const tituloDe = (id: string) => {
    const [parte = '', label = ''] = id.split('/');
    const s = indice.partes[parte]?.secciones?.find((x) => x.label === label);
    return s ? `${s.num ?? ''} ${s.titulo}`.trim() : label;
  };
  const aciertos = $derived(respuestas.filter((r) => r?.bien).length);
  const aprobado = $derived(sinPrueba || aprobadoSalto(aciertos, items.length));
  /** Questions the check will have. */
  const total = $derived(disponibles ? Math.min(PREGUNTAS_SALTO, disponibles.length) : PREGUNTAS_SALTO);

  async function cargarDisponibles(): Promise<Item[]> {
    const partes = [...new Set(lecciones.map((l) => l.split('/')[0]!))];
    // a question about an exercise is mapped to its lesson through the exercises' index
    const [cs] = await Promise.all([Promise.all(partes.map((p) => cargarCuestionario(p).catch(() => null))), cargarEjercicios().catch(() => null)]);
    const todas: Item[] = [];
    partes.forEach((p, i) => {
      for (const q of cs[i]?.preguntas ?? []) todas.push({ parte: p, p: q, orden: [] });
    });
    return preguntasDelSalto(todas, (x) => conceptoDeRef(x.parte, x.p.ref), lecciones);
  }

  $effect(() => {
    void lecciones;
    let vivo = true;
    disponibles = null;
    void cargarDisponibles().then(
      (xs) => {
        if (vivo) disponibles = xs;
      },
      () => {
        if (vivo) disponibles = [];
      },
    );
    return () => {
      vivo = false;
    };
  });

  async function preparar() {
    fase = 'cargando';
    error = '';
    try {
      const propias = disponibles ?? (await cargarDisponibles());
      const elegidas = barajar(propias)
        .slice(0, PREGUNTAS_SALTO)
        .map((it) => ({ ...it, orden: it.p.tipo === 'opcion' ? barajar(it.p.opciones.map((_, j) => j)) : [] }));
      if (!elegidas.length) throw new Error('Las lecciones que se salta no tienen preguntas de repaso.');
      items = elegidas;
      respuestas = elegidas.map(() => null);
      k = 0;
      fase = 'preguntas';
      window.scrollTo({ top: 0, behavior: 'instant' });
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      fase = 'intro';
    }
  }

  function responder(r: Respuesta) {
    respuestas[k] = r;
  }
  function noLoSe() {
    respuestas[k] = { elegida: null, texto: '', bien: false };
    avanzar();
  }
  function avanzar() {
    if (k + 1 < items.length) {
      k++;
      window.scrollTo({ top: 0, behavior: 'instant' });
      queueMicrotask(() => titulo?.focus({ preventScroll: true }));
      return;
    }
    fase = 'resultado';
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (aprobadoSalto(respuestas.filter((r) => r?.bien).length, items.length)) {
      const nuevas = lecciones.filter((id) => !estadoCursos.superadas[id]);
      marcarSuperadas(nuevas);
      marcadas = nuevas;
    }
    queueMicrotask(() => titulo?.focus({ preventScroll: true }));
  }
  /** Without questions about these lessons: the jump is taken as the reader's own decision (the same mark). */
  function saltarSinPrueba() {
    sinPrueba = true;
    items = [];
    respuestas = [];
    const nuevas = lecciones.filter((id) => !estadoCursos.superadas[id]);
    marcarSuperadas(nuevas);
    marcadas = nuevas;
    fase = 'resultado';
    window.scrollTo({ top: 0, behavior: 'instant' });
    queueMicrotask(() => titulo?.focus({ preventScroll: true }));
  }
  function deshacer() {
    desmarcarSuperadas(marcadas);
    marcadas = [];
  }
  function salir() {
    location.replace(volver);
  }

  const item = $derived(fase === 'preguntas' ? (items[k] ?? null) : null);
  const resp = $derived(respuestas[k] ?? null);
</script>

<div class="saltar" data-saltar-prueba data-fase={fase}>
  {#if fase === 'intro' || fase === 'cargando'}
    <section class="t09-tarjeta t09-grande t09-banda intro">
      <span class="icono" aria-hidden="true"><FastForward size={28} /></span>
      <h1 bind:this={titulo} tabindex="-1">Saltar hasta «{destino}»</h1>
      {#if disponibles && !disponibles.length}
        <p data-sin-preguntas>
          {lecciones.length === 1 ? 'Se salta una lección' : `Se salta ${lecciones.length} lecciones`}. El libro no tiene preguntas de repaso sobre
          {lecciones.length === 1 ? 'ella' : 'ellas'}, así que no hay prueba: si ya conoce lo que {lecciones.length === 1 ? 'explica' : 'explican'}, puede saltar
          sin prueba y {lecciones.length === 1 ? 'quedará marcada' : 'quedarán marcadas'} como «superadas por la prueba».
        </p>
      {:else}
        <p data-total-salto={disponibles ? total : undefined}>
          {lecciones.length === 1 ? 'Se salta una lección' : `Se salta ${lecciones.length} lecciones`}. Una prueba corta con
          {total === 1 ? 'una pregunta' : `${total} preguntas`} del libro solo sobre {lecciones.length === 1 ? 'ella' : 'ellas'}:
          {total >= 4 ? 'si falla como mucho una' : total === 1 ? 'si la acierta' : 'si las acierta todas'}, quedan marcadas como «superadas por la prueba» y el
          camino se abre hasta aquí.
        </p>
      {/if}
      <ul class="saltadas">
        {#each lecciones.slice(0, 6) as l (l)}<li>{tituloDe(l)}</li>{/each}
        {#if lecciones.length > 6}<li>y {lecciones.length - 6} más</li>{/if}
      </ul>
      <p class="nota">Las lecciones superadas así no cuentan como completadas ni dan XP; se pueden deshacer y estudiar después.</p>
      {#if error}<p class="error" role="alert">{error}</p>{/if}
      <div class="botones">
        {#if disponibles && !disponibles.length}
          <button type="button" class="t09-boton" onclick={saltarSinPrueba} data-saltar-sin-prueba>
            Saltar sin prueba
            <ArrowRight size={20} aria-hidden="true" />
          </button>
        {:else}
          <button type="button" class="t09-boton" onclick={preparar} disabled={fase === 'cargando' || !disponibles} data-empezar-salto>
            {fase === 'cargando' || !disponibles ? 'Preparando…' : 'Empezar la prueba'}
            <ArrowRight size={20} aria-hidden="true" />
          </button>
        {/if}
        <a class="t09-boton t09-contorno" href={volver}>Volver al camino</a>
      </div>
    </section>
  {:else if fase === 'preguntas' && item}
    <div class="juego">
      <CabeceraPasos total={items.length} actual={k} {contexto} descripcion={`Pregunta ${k + 1} de ${items.length}`} cerrar={salir} etiquetaCerrar="Salir de la prueba" />
      <div class="cuerpo" data-ref-salto={`${item.parte}/${item.p.ref}`}>
        <h1 class="solo-lector" bind:this={titulo} tabindex="-1">Pregunta {k + 1} de {items.length}</h1>
        {#key k}
          <Pregunta
            pregunta={item.p}
            parte={item.parte}
            orden={item.orden}
            respuesta={resp}
            onresponder={responder}
            origen="prueba-nivel"
            etiqueta={`Pregunta ${k + 1} de ${items.length}`}
            rotulo={`${rotuloParte(item.parte)} · ${corto(indice.partes[item.parte]?.titulo ?? '')}`}
          />
        {/key}
      </div>
      <PieAcciones>
        {#if !resp}<button type="button" class="accion" onclick={noLoSe} data-no-lo-se>No lo sé</button>{/if}
        <button type="button" class="accion primaria" onclick={avanzar} disabled={!resp} data-siguiente-salto>
          {k + 1 < items.length ? 'Continuar' : 'Ver el resultado'}
          <ArrowRight size={20} strokeWidth={2.2} aria-hidden="true" />
        </button>
      </PieAcciones>
    </div>
  {:else if fase === 'resultado'}
    <section class="t09-tarjeta t09-grande t09-banda resultado" data-resultado-salto={aprobado ? 'aprobado' : 'suspenso'}>
      <h1 bind:this={titulo} tabindex="-1">{sinPrueba ? 'Lecciones saltadas' : aprobado ? 'Prueba superada' : 'Todavía no'}</h1>
      {#if !sinPrueba}<p class="marcador"><strong>{aciertos} de {items.length}</strong> respuestas correctas</p>{/if}
      {#if aprobado}
        {#if marcadas.length}
          <p role="status" data-marcadas={marcadas.length}>
            {marcadas.length === 1 ? 'Se ha marcado una lección' : `Se han marcado ${marcadas.length} lecciones`} como superadas por la prueba.
          </p>
        {:else}
          <p role="status">Las lecciones que se saltaba vuelven a estar sin marcar.</p>
        {/if}
        <div class="botones">
          <a class="t09-boton" href={hrefDestino} data-ir-destino>Ir a «{destino}» <ArrowRight size={20} aria-hidden="true" /></a>
          {#if marcadas.length}<button type="button" class="t09-boton t09-contorno" onclick={deshacer} data-deshacer-salto>Deshacer</button>{/if}
          <a class="t09-boton t09-contorno" href={volver}>Volver al camino</a>
        </div>
      {:else}
        <p>Para saltar hace falta {items.length >= 4 ? 'fallar como mucho una' : items.length === 1 ? 'acertarla' : 'acertarlas todas'}. Puede estudiar las lecciones que se saltaba o intentarlo otra vez{disponibles && disponibles.length > items.length ? ' con otras preguntas' : ''}.</p>
        <div class="botones">
          <button type="button" class="t09-boton" onclick={preparar} data-repetir-salto>Intentarlo otra vez</button>
          <a class="t09-boton t09-contorno" href={volver}>Volver al camino</a>
        </div>
      {/if}
    </section>
  {/if}
</div>

<style>
  .saltar {
    max-width: 640px;
    margin: 0 auto;
    padding: 24px 24px 64px;
    font-family: var(--sans);
  }
  @media (max-width: 600px) {
    .saltar {
      padding: 16px 16px 48px;
    }
  }
  .saltar[data-fase='preguntas'] {
    padding-top: 0;
    padding-bottom: 0;
  }
  .juego {
    --pad-pie: 0px;
    --pie-abajo: var(--hueco-inferior);
  }
  .cuerpo {
    padding: 24px 0 28px;
  }
  h1 {
    margin: 0;
    color: var(--titulos);
    font-family: var(--serif);
    font-size: clamp(24px, 3.4vw, 30px);
    line-height: 1.25;
  }
  .intro,
  .resultado {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .intro p,
  .resultado p {
    margin: 0;
    color: var(--tinta);
    font-size: 16.5px;
    line-height: 1.5;
  }
  .nota {
    color: var(--tinta-suave) !important;
    font-size: 15px !important;
  }
  .saltadas {
    margin: 0;
    padding-left: 22px;
    color: var(--tinta);
    font-size: 15.5px;
    line-height: 1.5;
  }
  .icono {
    color: var(--c09-texto, var(--titulos));
  }
  .botones {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  .error {
    color: var(--mal, #b03a1e) !important;
  }
</style>
