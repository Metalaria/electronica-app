<script lang="ts">
  // «Estudiar por pasos» (0.9, #/leccion/<parte>/<seccion>[/<n>|/pregunta-<n>|/fin]): a section of the book as
  // a lesson in the style of the approved mockup (Leccion.dc.html). One screen per step (lib/lecciones.svelte.ts
  // splits the section «por subapartados»), rendered with the reader's own block components (figures, live
  // figures, equations, tables, derivations, calculators…), then the Repaso questions about the section, one
  // per screen, and a short summary that marks the section as read.
  //
  // History: the lesson is ONE history entry. Moving between its screens replaces the URL (a reload reopens the
  // same screen), so the browser's or Android's «Atrás» leaves the lesson to where it was opened from; the close
  // button does the same (or opens the section in the reader when the lesson was the first page shown).
  // Keys: → or Intro continue, ← goes back, Esc closes; 1–4 / A–D answer a question.
  import { onMount, tick, untrack } from 'svelte';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import Check from '@lucide/svelte/icons/check';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import type { Bloque } from '../../lib/tipos';
  import { app } from '../../lib/estado.svelte';
  import { ruta, hayCapas } from '../../lib/ruta.svelte';
  import { cargarParte, prepararHtml } from '../../lib/datos';
  import { tonoBloque } from '../../lib/color';
  import { pasoVecino } from '../../lib/navegacion.svelte';
  import { cargarAprendizaje, marcarLeida } from '../../lib/aprendizaje.svelte';
  import { registrarActividad } from '../../lib/progreso-diario.svelte';
  import {
    anotarPaso,
    cargarLeccion,
    cargarLecciones,
    completarLeccion,
    completarPaso,
    preguntasDeLeccion,
    rutaLeccion,
    type Leccion,
  } from '../../lib/lecciones.svelte';
  import type { Pregunta as TPregunta } from '../repaso/datos';
  import { barajar } from '../repaso/datos';
  import Bloques from '../Bloques.svelte';
  import BotonSimular from '../BotonSimular.svelte';
  import VerAnimacion from '../animaciones/VerAnimacion.svelte';
  import VerEn3D from '../tres/VerEn3D.svelte';
  import VerKit from '../fm7303/VerKit.svelte';
  import Pregunta, { referenciaDe, type Respuesta } from '../pregunta/Pregunta.svelte';
  import PieAcciones from '../pregunta/PieAcciones.svelte';
  import CabeceraPasos from '../pregunta/CabeceraPasos.svelte';
  import Practica, { type RespuestaPractica } from '../practica/Practica.svelte';
  import IdeasClave from '../practica/IdeasClave.svelte';
  import { NOMBRE_TIPO, pantallasLeccion, practicaDeSeccion } from '../practica/datos';
  import type { Idea, ItemPractica } from '../practica/tipos';

  let { parte, seccion }: { parte: string; seccion: string } = $props();

  let leccion = $state<Leccion | null>(null);
  let bloques = $state<Bloque[]>([]);
  let preguntas = $state<TPregunta[] | null>(null);
  let ordenes = $state<number[][]>([]);
  let respuestas = $state<(Respuesta | null)[]>([]);
  let mostrada = $state<Respuesta | null>(null);
  let error = $state('');
  let pantalla = $state(0);
  // «Aprender haciendo» (0.10): the practice items placed after the steps, and the section's key ideas.
  let items = $state.raw<ItemPractica[]>([]);
  let ideas = $state.raw<Idea[]>([]);
  let respuestasP = $state<(RespuestaPractica | null)[]>([]);
  let finalP = $state(false);
  let titulo: HTMLElement | undefined = $state();

  // Opened from another page of the app (Back returns there) or as the first page (reload, link).
  const habiaEntrada = untrack(() => ruta.n) > 1;
  // Steps and questions already counted for the daily goal in this visit.
  const contados = new Set<string>();
  let completadaAhora = $state(false);

  const nPasos = $derived(leccion?.pasos.length ?? 0);
  const nPreguntas = $derived(preguntas?.length ?? 0);
  // Screens: every step followed by its practice items, then the Repaso questions, then the end.
  const pantallas = $derived(leccion ? pantallasLeccion(leccion.pasos, items, nPreguntas) : []);
  /** Screens before the questions (steps and practice). */
  const nAntes = $derived(nPasos + items.length);
  const total = $derived(Math.max(0, pantallas.length - 1));
  const actual = $derived(pantallas[Math.min(pantalla, Math.max(0, pantallas.length - 1))]);
  const enPaso = $derived(actual?.k === 'paso');
  const paso = $derived(actual?.k === 'paso' ? leccion!.pasos[actual.paso]! : null);
  const iItem = $derived(actual?.k === 'practica' ? actual.item : -1);
  const item = $derived(iItem >= 0 ? items[iItem]! : null);
  const iPregunta = $derived(actual?.k === 'pregunta' ? actual.i : -1);
  const pregunta = $derived(preguntas && iPregunta >= 0 && iPregunta < nPreguntas ? preguntas[iPregunta]! : null);
  const enResumen = $derived(!!leccion && preguntas !== null && actual?.k === 'fin');
  const aciertosP = $derived(respuestasP.filter((r) => r?.bien && r.intentos === 1).length);
  const respondidasP = $derived(respuestasP.filter((r) => r).length);
  const tono = $derived(tonoBloque(leccion?.color, app.tema));
  const contenido = $derived(paso ? bloques.slice(paso.desde, paso.hasta) : []);
  const siguiente = $derived.by(() => {
    if (!app.indice) return null;
    let v = pasoVecino(parte, seccion, 1);
    while (v && !v.label) v = pasoVecino(v.parte, v.label, 1);
    return v?.label ? v : null;
  });
  const aciertos = $derived(respuestas.filter((r) => r?.bien).length);

  /** «3», «practica-1», «pregunta-2», «fin» → screen index (needs the steps, items and questions). */
  function leerPantalla(ancla: string): number {
    const ps = pantallasLeccion(leccion?.pasos ?? [], items, preguntas?.length ?? 0);
    const resto = ancla.split('/').slice(1).join('/');
    if (!resto) return 0;
    if (resto === 'fin') return ps.length - 1;
    const m = /^pregunta-(\d+)$/.exec(resto);
    if (m) {
      const k = ps.findIndex((x) => x.k === 'pregunta' && x.i === Number(m[1]) - 1);
      return k >= 0 ? k : ps.length - 1;
    }
    const mp = /^practica-(\d+)$/.exec(resto);
    if (mp) {
      const k = ps.findIndex((x) => x.k === 'practica' && x.item === Number(mp[1]) - 1);
      return Math.max(0, k);
    }
    const n = Number(resto);
    if (!Number.isFinite(n)) return 0;
    const pasoK = Math.min(Math.max(0, n - 1), Math.max(0, (leccion?.pasos.length ?? 1) - 1));
    return Math.max(0, ps.findIndex((x) => x.k === 'paso' && x.paso === pasoK));
  }

  function hashDe(i: number): string {
    const x = pantallas[i];
    if (!x || x.k === 'fin') return `${rutaLeccion(parte, seccion)}/fin`;
    if (x.k === 'paso') return rutaLeccion(parte, seccion, x.paso);
    if (x.k === 'practica') return `${rutaLeccion(parte, seccion)}/practica-${x.item + 1}`;
    return `${rutaLeccion(parte, seccion)}/pregunta-${x.i + 1}`;
  }

  /** The step a screen belongs to, as the stored progress counts it (questions and the end: n and after). */
  function pasoGuardado(i: number): number {
    const x = pantallas[i];
    if (!x) return nPasos + nPreguntas;
    if (x.k === 'paso' || x.k === 'practica') return x.paso;
    if (x.k === 'pregunta') return nPasos + x.i;
    return nPasos + nPreguntas;
  }

  async function ir(i: number, enfocar = true) {
    if (!leccion) return;
    // Past the last step and its practice the questions must be known.
    if (i >= nAntes && preguntas === null) await cargarPreguntas();
    const destino = Math.max(0, Math.min(i, total));
    pantalla = destino;
    mostrada = null;
    finalP = false;
    const h = hashDe(destino);
    if (location.hash !== h) history.replaceState(history.state, '', h);
    anotarPaso(parte, seccion, pasoGuardado(destino), nPasos);
    if (destino >= total) terminar();
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

  function continuar() {
    if (!leccion) return;
    if (enPaso && actual?.k === 'paso') {
      completarPaso(parte, seccion, actual.paso, nPasos);
      contar(`p${actual.paso}`, 'paso');
      void ir(pantalla + 1);
    } else if (item) {
      void ir(pantalla + 1);
    } else if (pregunta) {
      if (!respuestas[iPregunta]) return;
      void ir(pantalla + 1);
    }
  }

  function atras() {
    if (pantalla > 0) void ir(pantalla - 1);
  }

  function terminar() {
    const primera = completarLeccion(parte, seccion, nPasos);
    completadaAhora = primera || completadaAhora;
    void cargarAprendizaje().then(() => marcarLeida(parte, seccion, true));
  }

  function responderPractica(r: RespuestaPractica) {
    respuestasP[iItem] = r;
    contar(`x${iItem}`, 'pregunta');
  }

  function responder(r: Respuesta) {
    respuestas[iPregunta] = r;
    contar(`q${iPregunta}`, 'pregunta');
  }

  function cerrar() {
    if (habiaEntrada) history.back();
    else location.replace(`#/${parte}/${encodeURIComponent(seccion)}`);
  }

  function irSiguiente() {
    if (siguiente?.label) location.replace(rutaLeccion(siguiente.parte, siguiente.label));
  }

  function teclas(ev: KeyboardEvent) {
    if (ev.ctrlKey || ev.metaKey || ev.altKey || ev.shiftKey || !leccion) return;
    if (app.figura || app.buscador || hayCapas() || document.querySelector('[aria-modal="true"]')) return;
    const t = ev.target as HTMLElement | null;
    // Keys inside controls (live figures, sliders, inputs, links, buttons) keep their own meaning.
    const libre = !t || t === document.body || t === titulo || !t.closest('a, button, input, textarea, select, summary, [tabindex], [contenteditable="true"], [role="slider"], [role="application"]');
    if (ev.key === 'Escape') {
      ev.preventDefault();
      cerrar();
    } else if (!libre) {
      return;
    } else if (ev.key === 'ArrowRight' || ev.key === 'Enter') {
      if (enResumen) return;
      if (pregunta && !respuestas[iPregunta]) return;
      if (item && !finalP) return;
      ev.preventDefault();
      continuar();
    } else if (ev.key === 'ArrowLeft') {
      if (pantalla === 0) return;
      ev.preventDefault();
      atras();
    }
  }

  let pidiendo: Promise<void> | null = null;
  function cargarPreguntas(): Promise<void> {
    pidiendo ??= (async () => {
      const l = leccion!;
      const ps = await preguntasDeLeccion(l).catch(() => []);
      ordenes = ps.map((p) => (p.tipo === 'opcion' ? barajar(p.opciones.map((_, k) => k)) : []));
      respuestas = ps.map(() => null);
      preguntas = ps;
    })();
    return pidiendo;
  }

  onMount(() => {
    app.seccion = null;
    void cargarLecciones();
    (async () => {
      try {
        const [l, d, pr] = await Promise.all([
          cargarLeccion(parte, seccion),
          cargarParte(parte),
          practicaDeSeccion(parte, seccion).catch(() => ({ items: [] as ItemPractica[], ideas: [] as Idea[] })),
        ]);
        bloques = d.bloques;
        items = pr.items;
        ideas = pr.ideas;
        respuestasP = pr.items.map(() => null);
        leccion = l;
        const ancla = untrack(() => ruta.ancla);
        // Questions or summary in the URL: wait for the questions first.
        if (/\/(pregunta-\d+|fin)$/.test(ancla)) await cargarPreguntas();
        else void cargarPreguntas();
        await ir(leerPantalla(ancla), false);
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }
    })();
  });

  // Back from the reader (or forward) into this lesson: the URL says which screen.
  let vistaN = untrack(() => ruta.n);
  $effect(() => {
    const n = ruta.n;
    if (n === vistaN || !leccion) return;
    vistaN = n;
    const i = untrack(() => leerPantalla(ruta.ancla));
    if (i !== untrack(() => pantalla)) void ir(i, false);
  });
</script>

<svelte:window onkeydown={teclas} />
<svelte:head>
  <title>{leccion ? `${leccion.num ? `${leccion.num} ` : ''}${leccion.titulo} · Por pasos` : 'Por pasos'} · Electrónica Práctica Avanzada</title>
</svelte:head>

<div class="leccion" style:--bloque={tono.relleno} style:--sobre-bloque={tono.sobre} style:--bloque-texto={tono.texto} data-leccion={`${parte}/${seccion}`} data-pantalla={pantalla}>
  {#if error}
    <div class="aviso">
      <h1>No se pudo abrir la lección</h1>
      <p>{error}</p>
      <p><a href={`#/${parte}`}>Abrir el capítulo en el libro</a></p>
    </div>
  {:else if !leccion}
    <div class="cargando" aria-live="polite"><span class="punto"></span> Preparando la lección…</div>
  {:else}
    <CabeceraPasos
      total={total || nPasos}
      actual={pantalla}
      contexto={`${leccion.capitulo} · ${leccion.num ? `${leccion.num} ` : ''}${leccion.titulo}`}
      descripcion={paso && actual?.k === 'paso' ? `Paso ${actual.paso + 1} de ${nPasos}` : item ? `Práctica: ${NOMBRE_TIPO[item.tipo]}` : pregunta ? `Pregunta ${iPregunta + 1} de ${nPreguntas}` : 'Lección completada'}
      cerrar={cerrar}
      etiquetaCerrar="Cerrar la lección"
    />

    <main class="cuerpo">
      <div class="columna">
        {#if paso && actual?.k === 'paso'}
          {@const kPaso = actual.paso}
          {#key pantalla}
            <div class="cab-paso">
              <span class="etiqueta" data-paso={kPaso}>
                Paso {kPaso + 1}{#if paso.num} · {paso.num}{:else if paso.tipo === 'intro'} · Introducción{:else if paso.tipo === 'continua'} · Continuación{/if}
              </span>
              <h1 bind:this={titulo} tabindex="-1">{@html prepararHtml(paso.html ?? leccion.html)}</h1>
              {#if paso.label}
                <span class="herramientas-paso"><BotonSimular label={paso.label} compacto /> <VerAnimacion label={paso.label} compacto /> <VerEn3D label={paso.label} compacto /> <VerKit label={paso.label} compacto /></span>
              {/if}
            </div>
            <div class="texto-libro contenido">
              {#if contenido.length}
                <Bloques bloques={contenido} {parte} raiz desde={paso.desde} />
              {:else}
                <p class="vacio">Este apartado no tiene más texto que su título.</p>
              {/if}
            </div>
            <a class="leer-libro" href={`#/${parte}/${encodeURIComponent(paso.label ?? seccion)}`}>
              Leer la sección {leccion.num || leccion.titulo} entera en el libro
            </a>
          {/key}
        {:else if item}
          {#key item.id}
            <h1 class="solo-lector" bind:this={titulo} tabindex="-1">Práctica: {NOMBRE_TIPO[item.tipo]}</h1>
            <Practica {item} etiqueta={`Práctica · ${NOMBRE_TIPO[item.tipo]}`} respuesta={respuestasP[iItem]} onresponder={responderPractica} bind:final={finalP} />
          {/key}
        {:else if pregunta}
          {#key pregunta.id}
            <h1 class="solo-lector" bind:this={titulo} tabindex="-1">Pregunta {iPregunta + 1} de {nPreguntas}</h1>
            <Pregunta
              {pregunta}
              {parte}
              orden={ordenes[iPregunta]}
              respuesta={respuestas[iPregunta]}
              onresponder={responder}
              etiqueta={nPreguntas > 1 ? `Pregunta ${iPregunta + 1} de ${nPreguntas}` : 'Pregunta'}
              bind:mostrada
            />
          {/key}
        {:else if enResumen}
          <section class="resumen" data-resumen>
            <span class="sello" aria-hidden="true"><Check size={34} strokeWidth={3} /></span>
            <h1 bind:this={titulo} tabindex="-1">Sección completada</h1>
            <p class="que">{leccion.num ? `${leccion.num} · ` : ''}{leccion.titulo}</p>
            <ul class="cifras">
              <li><strong>{nPasos}</strong> {nPasos === 1 ? 'paso' : 'pasos'}</li>
              {#if nPreguntas && respuestas.some((r) => r)}
                <li><strong>{aciertos} de {nPreguntas}</strong> {nPreguntas === 1 ? 'pregunta' : 'preguntas'} a la primera</li>
              {/if}
              {#if respondidasP}
                <li data-cifra-practica><strong>{aciertosP} de {items.length}</strong> {items.length === 1 ? 'práctica' : 'prácticas'} a la primera</li>
              {/if}
              <li class="leida"><Check size={16} strokeWidth={3} aria-hidden="true" /> Marcada como leída</li>
            </ul>
            <IdeasClave {ideas} {parte} />
            {#if siguiente}
              <div class="siguiente" data-siguiente-titulo>
                <span class="rot">Siguiente sección</span>
                <span class="tit">{siguiente.num ? `${siguiente.num} · ` : ''}{siguiente.titulo}</span>
              </div>
            {/if}
            <button type="button" class="repetir" onclick={() => ir(0)}><RotateCcw size={16} aria-hidden="true" /> Repasar la lección desde el principio</button>
          </section>
        {:else}
          <div class="cargando" aria-live="polite"><span class="punto"></span> Cargando las preguntas…</div>
        {/if}
      </div>
    </main>

    <PieAcciones>
      {#if item}
        {#if finalP}
          <button type="button" class="accion corta" onclick={atras} data-atras>Atrás</button>
        {:else}
          <button type="button" class="accion corta" onclick={() => ir(pantalla + 1)} data-saltar>Saltar</button>
        {/if}
        <button type="button" class="accion primaria" onclick={continuar} disabled={!finalP} data-continuar>
          Continuar <ArrowRight size={20} strokeWidth={2.2} aria-hidden="true" />
        </button>
      {:else if paso}
        <button type="button" class="accion corta" onclick={atras} disabled={pantalla === 0} data-atras>Atrás</button>
        <button type="button" class="accion primaria" onclick={continuar} data-continuar>
          Continuar <ArrowRight size={20} strokeWidth={2.2} aria-hidden="true" />
        </button>
      {:else if pregunta}
        {@const ref = referenciaDe(pregunta, parte)}
        <a class="accion" href={ref.href} data-ver-seccion>{ref.ver}</a>
        <button type="button" class="accion primaria" onclick={continuar} disabled={!respuestas[iPregunta]} data-continuar>
          Continuar <ArrowRight size={20} strokeWidth={2.2} aria-hidden="true" />
        </button>
      {:else if enResumen}
        <button type="button" class="accion" onclick={cerrar} data-volver-libro>Volver al libro</button>
        {#if siguiente}
          <button type="button" class="accion primaria" onclick={irSiguiente} data-siguiente-leccion>
            Siguiente sección <ArrowRight size={20} strokeWidth={2.2} aria-hidden="true" />
          </button>
        {/if}
      {/if}
    </PieAcciones>
  {/if}
</div>

<style>
  .leccion {
    --pad-pie: clamp(16px, 4vw, 32px);
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    min-height: 100dvh;
    background: var(--fondo);
    color: var(--tinta);
    font-family: var(--sans);
  }
  .cuerpo {
    flex: 1 0 auto;
    padding: 28px var(--pad-pie) 32px;
  }
  .columna {
    display: flex;
    flex-direction: column;
    gap: 20px;
    width: 100%;
    max-width: 640px;
    margin: 0 auto;
  }
  .cab-paso {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .etiqueta {
    color: var(--bloque-texto, var(--titulos));
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  h1 {
    margin: 0;
    color: var(--titulos);
    font-family: var(--serif);
    font-size: clamp(26px, 3.6vw, 30px);
    font-weight: 700;
    line-height: 1.2;
    text-wrap: balance;
  }
  h1:focus {
    outline: none;
  }
  .herramientas-paso:empty {
    display: none;
  }
  .contenido {
    font-size: var(--tam);
  }
  /* The lesson reads ragged right, as in the mockup (the reader justifies on wide screens). */
  .contenido :global(p),
  .contenido :global(li),
  .contenido :global(.caja) {
    text-align: left;
  }
  .contenido :global(> :first-child) {
    margin-top: 0;
  }
  .contenido :global(> :last-child) {
    margin-bottom: 0;
  }
  .vacio {
    color: var(--tinta-suave);
    font-style: italic;
  }
  .leer-libro {
    align-self: flex-start;
    font-size: 15px;
    font-weight: 600;
  }

  .resumen {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 24px 0 8px;
    text-align: center;
  }
  .sello {
    display: grid;
    place-items: center;
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: var(--bloque);
    color: var(--sobre-bloque);
  }
  .que {
    margin: 0;
    color: var(--tinta-suave);
    font-family: var(--serif);
    font-size: 19px;
    line-height: 1.4;
  }
  .cifras {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    margin: 8px 0 0;
    padding: 0;
    list-style: none;
  }
  .cifras li {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 999px;
    background: var(--superficie-2);
    color: var(--tinta-suave);
    font-size: 15px;
  }
  .cifras strong {
    color: var(--tinta);
  }
  .cifras .leida {
    color: var(--c-ejemplo);
    font-weight: 600;
  }
  .siguiente {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
    margin-top: 18px;
    padding: 16px 18px;
    border: 1px solid var(--linea);
    border-radius: 18px;
    background: var(--superficie);
    box-shadow: var(--sombra);
    text-align: left;
  }
  .siguiente .rot {
    color: var(--bloque-texto, var(--titulos));
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .siguiente .tit {
    color: var(--titulos);
    font-family: var(--serif);
    font-size: 20px;
    font-weight: 600;
    line-height: 1.3;
  }
  .repetir {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    margin-top: 6px;
    padding: 0 6px;
    border: 0;
    background: transparent;
    color: var(--acento);
    font-size: 15px;
    font-weight: 600;
  }
  .cargando {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 30vh 20px;
    color: var(--tinta-suave);
  }
  .punto {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--acento);
    animation: latido 1s ease-in-out infinite;
  }
  @keyframes latido {
    50% {
      opacity: 0.25;
      transform: scale(0.7);
    }
  }
  .aviso {
    max-width: 36em;
    margin: 18vh auto;
    padding: 0 20px;
  }
</style>
