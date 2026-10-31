<script lang="ts">
  // «Prueba de nivel» of a course (0.11, #/cursos/<curso>/prueba): 6–10 of the book's own Repaso questions from
  // the course's chapters, easy → hard (the chapters in the course's order; inside a chapter, choice questions
  // before numeric ones), one per screen with the usual question component. «No lo sé» skips a question (it counts
  // as not known). At the end: the score per chapter, where to start (the first chapter with a question not
  // known; the last one when everything was right) and the offer to mark the lessons of the chapters before it
  // as «superada por la prueba» (no XP; «Deshacer» takes them back). It can be skipped at any moment and repeated
  // (each run draws other questions). The answers are learning events with origen «prueba-nivel» (no XP).
  import { onMount } from 'svelte';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import Check from '@lucide/svelte/icons/check';
  import X from '@lucide/svelte/icons/x';
  import Compass from '@lucide/svelte/icons/compass';
  import { app } from '../../lib/estado.svelte';
  import { tonoBloque } from '../../lib/color';
  import { rotuloParte } from '../../lib/datos';
  import { corto } from '../../lib/navegacion.svelte';
  import { cargarLecciones } from '../../lib/lecciones.svelte';
  import { cargarCursos, desmarcarSuperadas, guardarPrueba, marcarSuperadas } from '../../lib/aprendizaje/cursos-estado.svelte';
  import { emitir } from '../../lib/aprendizaje/eventos';
  import { preguntasPrueba, repartoPrueba, type Curso } from '../../lib/aprendizaje/cursos';
  import { barajar, cargarCuestionario, type Pregunta as TPregunta } from '../repaso/datos';
  import Pregunta, { type Respuesta } from '../pregunta/Pregunta.svelte';
  import CabeceraPasos from '../pregunta/CabeceraPasos.svelte';
  import PieAcciones from '../pregunta/PieAcciones.svelte';
  import { avanceCurso } from './avance.svelte';

  let { curso }: { curso: Curso } = $props();

  interface Item {
    parte: string;
    p: TPregunta;
    orden: number[];
  }

  let fase = $state<'intro' | 'cargando' | 'preguntas' | 'resultado'>('intro');
  let items = $state<Item[]>([]);
  let respuestas = $state<(Respuesta | null)[]>([]);
  /** «No lo sé» on that question. */
  let saltadas = $state<boolean[]>([]);
  let k = $state(0);
  let error = $state('');
  let marcadas = $state<string[]>([]);
  let titulo: HTMLElement | undefined = $state();

  const indice = $derived(app.indice!);
  const tono = $derived(tonoBloque(indice.partes[curso.partes[0] ?? '']?.color, app.tema));
  const volverA = $derived(`#/cursos/${curso.id}`);

  async function preparar() {
    fase = 'cargando';
    error = '';
    marcadas = [];
    try {
      const partes = curso.partes;
      const cs = await Promise.all(partes.map((p) => cargarCuestionario(p).catch(() => null)));
      const disponibles = partes.map((p, i) => ({ parte: p, preguntas: cs[i]?.preguntas ?? [] })).filter((x) => x.preguntas.length);
      if (!disponibles.length) throw new Error('Este curso no tiene preguntas de repaso.');
      const cupo = repartoPrueba(disponibles.length);
      const elegidas: Item[] = [];
      disponibles.forEach((d, i) => {
        // choice questions first (quicker to answer and to know), then numeric ones
        const opciones = barajar(d.preguntas.filter((q) => q.tipo === 'opcion'));
        const numeros = barajar(d.preguntas.filter((q) => q.tipo !== 'opcion'));
        for (const p of [...opciones, ...numeros].slice(0, cupo[i])) {
          elegidas.push({ parte: d.parte, p, orden: p.tipo === 'opcion' ? barajar(p.opciones.map((_, j) => j)) : [] });
        }
      });
      items = elegidas;
      respuestas = elegidas.map(() => null);
      saltadas = elegidas.map(() => false);
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
    saltadas[k] = true;
    respuestas[k] = { elegida: null, texto: '', bien: false };
    avanzar();
  }

  function avanzar() {
    if (k + 1 < items.length) {
      k++;
      window.scrollTo({ top: 0, behavior: 'instant' });
      queueMicrotask(() => titulo?.focus({ preventScroll: true }));
    } else terminar();
  }

  // ------------------------------------------------------------------ result

  const porCapitulo = $derived.by(() => {
    const r: { parte: string; bien: number; total: number }[] = [];
    items.forEach((it, i) => {
      let e = r.find((x) => x.parte === it.parte);
      if (!e) r.push((e = { parte: it.parte, bien: 0, total: 0 }));
      e.total++;
      if (respuestas[i]?.bien) e.bien++;
    });
    return r;
  });
  const aciertos = $derived(respuestas.filter((r) => r?.bien).length);
  /** First chapter (in the course's order) with a question not known; the last one when all were right. */
  const recomendado = $derived.by(() => {
    if (fase !== 'resultado') return null;
    const fallado = curso.partes.find((p) => porCapitulo.some((c) => c.parte === p && c.bien < c.total));
    return fallado ?? curso.partes[curso.partes.length - 1] ?? null;
  });
  const todoBien = $derived(fase === 'resultado' && aciertos === items.length);
  /** The lessons before the recommended chapter not completed nor passed yet: what «Marcar como superadas» marks. */
  const anteriores = $derived.by(() => {
    if (!recomendado) return [];
    const i = curso.partes.indexOf(recomendado);
    const antes = new Set(curso.partes.slice(0, Math.max(0, i)));
    return avanceCurso(curso, indice)
      .lecciones.filter((l) => antes.has(l.parte) && l.estado !== 'hecha' && l.estado !== 'superada')
      .map((l) => `${l.parte}/${l.label}`);
  });
  const capitulosAntes = $derived(recomendado ? curso.partes.slice(0, Math.max(0, curso.partes.indexOf(recomendado))) : []);
  /** «Empezar por ahí»: the first lesson of the recommended chapter not completed nor passed. */
  const hrefEmpezar = $derived.by(() => {
    if (!recomendado) return volverA;
    const a = avanceCurso(curso, indice);
    const l = a.lecciones.find((x) => x.parte === recomendado && x.estado !== 'hecha' && x.estado !== 'superada');
    return l ? `#/leccion/${l.parte}/${encodeURIComponent(l.label)}` : (a.href ?? volverA);
  });

  function terminar() {
    fase = 'resultado';
    window.scrollTo({ top: 0, behavior: 'instant' });
    queueMicrotask(() => {
      guardarPrueba(curso.id, { t: Date.now(), aciertos, total: items.length, recomendado: todoBien ? null : recomendado, marcadas: 0 });
      emitir({ tipo: 'prueba-nivel', curso: curso.id, aciertos, total: items.length, recomendado });
      titulo?.focus({ preventScroll: true });
    });
  }

  function marcar() {
    const ids = anteriores;
    marcarSuperadas(ids);
    marcadas = ids;
    guardarPrueba(curso.id, { t: Date.now(), aciertos, total: items.length, recomendado: todoBien ? null : recomendado, marcadas: ids.length });
  }

  function deshacer() {
    desmarcarSuperadas(marcadas);
    marcadas = [];
  }

  function salir() {
    location.replace(volverA);
  }

  onMount(() => {
    void cargarLecciones();
    void cargarCursos();
  });

  const item = $derived(fase === 'preguntas' ? (items[k] ?? null) : null);
  const resp = $derived(respuestas[k] ?? null);
</script>

<svelte:head><title>Prueba de nivel · {curso.nombre} · Electrónica Práctica Avanzada</title></svelte:head>

<div class="prueba" data-prueba={curso.id} data-fase={fase} style:--bloque={tono.relleno} style:--sobre-bloque={tono.sobre} style:--c09={tono.relleno} style:--sobre09={tono.sobre}>
  {#if fase === 'intro' || fase === 'cargando'}
    <section class="t09-tarjeta t09-grande t09-banda intro">
      <span class="icono" aria-hidden="true"><Compass size={30} /></span>
      <h1 bind:this={titulo} tabindex="-1">Prueba de nivel · {curso.nombre}</h1>
      <p>
        {preguntasPrueba(curso.partes.length)} preguntas del propio libro, de los primeros capítulos del curso a los últimos. Al final le diremos por dónde
        empezar y podrá marcar como sabidas las lecciones anteriores.
      </p>
      <p class="nota">Si no sabe una respuesta, pulse «No lo sé»: la prueba solo sirve para orientarle y no da XP. Puede saltarla cuando quiera.</p>
      {#if error}<p class="error" role="alert">{error}</p>{/if}
      <div class="botones">
        <button type="button" class="t09-boton" onclick={preparar} disabled={fase === 'cargando'} data-empezar-prueba>
          {fase === 'cargando' ? 'Preparando…' : 'Empezar la prueba'}
          <ArrowRight size={20} aria-hidden="true" />
        </button>
        <a class="t09-boton t09-contorno" href={volverA} data-saltar-prueba>Saltar la prueba</a>
      </div>
    </section>
  {:else if fase === 'preguntas' && item}
    <div class="juego">
      <CabeceraPasos
        total={items.length}
        actual={k}
        contexto={`Prueba de nivel · ${curso.nombre}`}
        descripcion={`Pregunta ${k + 1} de ${items.length}`}
        cerrar={salir}
        etiquetaCerrar="Salir de la prueba"
      />
      <div class="cuerpo">
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
        {#if !resp}
          <button type="button" class="accion" onclick={noLoSe} data-no-lo-se>No lo sé</button>
        {:else}
          <button type="button" class="accion corta" onclick={salir} data-salir-prueba>Salir</button>
        {/if}
        <button type="button" class="accion primaria" onclick={avanzar} disabled={!resp} data-siguiente-prueba>
          {k + 1 < items.length ? 'Continuar' : 'Ver el resultado'}
          <ArrowRight size={20} strokeWidth={2.2} aria-hidden="true" />
        </button>
      </PieAcciones>
    </div>
  {:else if fase === 'resultado'}
    <section class="resultado" data-resultado-prueba data-aciertos={aciertos} data-recomendado={recomendado ?? ''}>
      <h1 bind:this={titulo} tabindex="-1">Resultado de la prueba</h1>
      <p class="marcador"><strong>{aciertos} de {items.length}</strong> respuestas correctas</p>
      <ul class="capitulos">
        {#each porCapitulo as c (c.parte)}
          {@const ok = c.bien === c.total}
          <li class:ok>
            <span class="marca" aria-hidden="true">{#if ok}<Check size={15} strokeWidth={3} />{:else}<X size={15} strokeWidth={3} />{/if}</span>
            <span class="txt">{rotuloParte(c.parte)} · {corto(indice.partes[c.parte]?.titulo ?? '')}</span>
            <span class="n">{c.bien}/{c.total}</span>
          </li>
        {/each}
      </ul>

      {#if recomendado}
        <div class="t09-tarjeta t09-banda recomendacion" data-recomendacion>
          <span class="rot">Le recomendamos empezar por</span>
          <span class="cap">{rotuloParte(recomendado)} · {corto(indice.partes[recomendado]?.titulo ?? '')}</span>
          {#if todoBien}<p class="nota">Ha acertado todas: domina lo esencial del curso. Empiece por su último capítulo.</p>{/if}
          <a class="t09-boton" href={hrefEmpezar} data-empezar-recomendado>Empezar por ahí <ArrowRight size={20} aria-hidden="true" /></a>
        </div>
      {/if}

      {#if capitulosAntes.length}
        <div class="marcar" data-marcar>
          {#if marcadas.length}
            <p role="status" data-marcadas={marcadas.length}>
              {marcadas.length === 1 ? 'Se ha marcado una lección' : `Se han marcado ${marcadas.length} lecciones`} como superadas por la prueba.
            </p>
            <button type="button" class="t09-boton t09-contorno" onclick={deshacer} data-deshacer-marcas>Deshacer</button>
          {:else if anteriores.length}
            <p>
              ¿Marcar como sabidas {anteriores.length === 1 ? 'la lección pendiente' : `las ${anteriores.length} lecciones pendientes`}
              {capitulosAntes.length === 1 ? 'del capítulo anterior' : `de los ${capitulosAntes.length} capítulos anteriores`}? Quedarán como «superadas por la
              prueba», distintas de las completadas, y no suman XP.
            </p>
            <button type="button" class="t09-boton t09-contorno" onclick={marcar} data-marcar-superadas>Marcar como superadas</button>
          {:else}
            <p>Las lecciones de {capitulosAntes.length === 1 ? 'el capítulo anterior' : 'los capítulos anteriores'} ya están completadas o superadas.</p>
          {/if}
        </div>
      {/if}

      <div class="botones">
        <button type="button" class="t09-boton t09-contorno" onclick={preparar} data-repetir-prueba>Repetir la prueba</button>
        <a class="enlace" href={volverA} data-volver-curso>Volver al curso</a>
      </div>
    </section>
  {/if}
</div>

<style>
  .prueba {
    max-width: 640px;
    margin: 0 auto;
    padding: 24px 24px 64px;
    font-family: var(--sans);
  }
  @media (max-width: 600px) {
    .prueba {
      padding: 16px 16px 48px;
    }
  }
  .prueba[data-fase='preguntas'] {
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
    line-height: 1.2;
  }
  h1:focus {
    outline: none;
  }
  .intro {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .intro p {
    margin: 0;
    color: var(--tinta);
    font-size: 16.5px;
    line-height: 1.5;
  }
  .intro .nota,
  .nota {
    color: var(--tinta-suave);
    font-size: 15px;
  }
  .icono {
    display: grid;
    place-items: center;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--c09);
    color: var(--sobre09);
  }
  .error {
    color: var(--c-precaucion);
  }
  .botones {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px 16px;
    margin-top: 6px;
  }
  .enlace {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    color: var(--acento);
    font-weight: 600;
  }
  .resultado {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .marcador {
    margin: 0;
    color: var(--tinta-suave);
    font-size: 17px;
  }
  .marcador strong {
    color: var(--titulos);
    font-family: var(--serif);
    font-size: 30px;
  }
  .capitulos {
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    list-style: none;
    border: 1px solid var(--linea);
    border-radius: var(--radio-tarjeta-p);
    background: var(--superficie);
  }
  .capitulos li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    font-size: 15px;
  }
  .capitulos li + li {
    border-top: 1px solid var(--linea-suave);
  }
  .capitulos .marca {
    display: grid;
    flex: none;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--superficie-2);
    color: var(--c-precaucion);
  }
  .capitulos li.ok .marca {
    background: var(--bloque);
    color: var(--sobre-bloque);
  }
  .capitulos .txt {
    flex: 1;
    min-width: 0;
  }
  .capitulos .n {
    color: var(--tinta-suave);
    font-variant-numeric: tabular-nums;
  }
  .recomendacion {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  .recomendacion .rot {
    color: var(--tinta-suave);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .recomendacion .cap {
    color: var(--titulos);
    font-family: var(--serif);
    font-size: 21px;
    font-weight: 600;
    line-height: 1.3;
  }
  .recomendacion p {
    margin: 0;
  }
  .marcar {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    padding: 14px 16px;
    border-radius: var(--radio-tarjeta-p);
    background: var(--superficie-2);
  }
  .marcar p {
    margin: 0;
    color: var(--tinta);
    font-size: 15px;
    line-height: 1.45;
  }
</style>
