<script lang="ts">
  // Taking an own exam (#/docente/examen/<id>/hacer[/<variante>]): every item on one page, the time left, no hints and
  // no corrections until «Entregar». The answers in progress are a per-device draft (localStorage, so a reload or an
  // accidental «Atrás» does not lose them); the result is stored and synchronised (lib/docente/estado.svelte.ts). When
  // the time runs out the exam is handed in by itself.
  //
  // Reviews 10a–10h, in short: the draft is written only once the attempt's questions are on screen (10h: a failed load
  // never starts a clock, never hands in a blank exam); the attempt keeps the version it started with (10c) and loads its
  // own items (10f); numbers never move (10f); a load failure says so in Spanish with «Reintentar» (10h); an attempt with
  // items no longer in the book can show and hand in what there is, keeping the other answers with the result (10h); the
  // time is counted with a monotonic clock in the page and stored as `transcurrido` (10h: a system clock that jumps does
  // not end the exam); unwritten answers hold the reader on the page (10h); a hand-in is «done» only when its result is
  // stored on the device (10c); a paused tab never hands in (10a).
  import { onDestroy, onMount } from 'svelte';
  import Timer from '@lucide/svelte/icons/timer';
  import { confirmar } from '../../lib/confirmar';
  import { cargarDocente, docente, guardarResultado, idResultado, propio, resultadoGuardado } from '../../lib/docente/estado.svelte';
  import { ErrorCarga, libro, prepararItems } from '../../lib/docente/fuentes';
  import { faltaSimular, simularDiseno } from '../../lib/diseno-ejercicio';
  import { calificarExamen, guardarVariante, huellaExamen, montarExamen, numerosDe, textoPuntos, varianteDe, type ExamenMontado } from '../../lib/docente/examen';
  import type { DefinicionExamen } from '../../lib/docente/tipos';
  import { enunciadoDe } from '../practica/variantes';
  import { borrarBorrador, leerBorrador, escribirBorrador, type Borrador } from './borrador';
  import { escrituraPermitida } from '../../lib/pestana-activa';
  import { registrarGuardaSalida } from '../../lib/salida';
  import ItemExamen from './ItemExamen.svelte';

  /** `variante`: the one chosen on the exam's page (in the route). */
  let { id, variante = 0 }: { id: string; variante?: number } = $props();

  let ex = $state.raw<ExamenMontado | null>(null);
  let titulo = $state('');
  let error = $state('');
  /** The attempt's data did not load (network…): «Reintentar» tries again. */
  let falloCarga = $state('');
  /** Items of the attempt no longer in the book: the reader may see and hand in the rest (`parcial`). */
  let noDisponibles = $state<string[]>([]);
  let parcial = $state(false);
  let borrador = $state<Borrador | null>(null);
  /** Monotonic now (performance.now) of the last tick. */
  let ahora = $state(0);
  let entregando = $state(false);
  let entregado = false;
  let falloEntrega = $state('');
  let ultimoFallo = 0;
  let cambiadoDesde = $state(false);
  let sinVersion = $state<Borrador | null>(null);
  let reloj: ReturnType<typeof setInterval> | null = null;
  let falloBorrador = $state('');
  let examenBorrado = $state(false);
  /** Attempt time counted before this page opened it (ms) and the monotonic instant it was opened. */
  let baseTranscurrido = 0;
  let monoInicio = 0;
  let ultimoGuardadoTiempo = 0;
  /** The attempt to open (kept for «Reintentar» and for the partial hand-in). */
  let pendiente: { b: Borrador; nuevo: boolean } | null = null;

  const quitarGuarda = registrarGuardaSalida(
    () =>
      confirmar({
        titulo: '¿Salir del examen?',
        mensaje: 'Sus últimas respuestas no se han podido guardar en este dispositivo: si sale, se perderán.',
        aceptar: 'Salir',
        seguirEnRuta: true,
      }),
    // (review 10h, r10h·1: only while there are answers that live only in this page)
    () => !!falloBorrador && !entregado,
  );

  onMount(() => {
    void arrancar();
  });

  async function arrancar(): Promise<void> {
    error = '';
    falloCarga = '';
    try {
      await cargarDocente();
      const p = propio(id);
      let b = leerBorrador(id);
      const hecho = b ? await resultadoGuardado(idResultado(id, b.inicio)) : undefined;
      if (b && hecho) {
        borrarBorrador(id);
        location.replace(hecho.borrado ? `#/docente/examen/${id}` : `#/docente/resultado/${hecho.id}`);
        return;
      }
      if (!p || p.tipo !== 'examen' || !p.examen) {
        // (reviews 10f/10h: the exam is gone — deleted here or elsewhere, or its tombstone pruned — but this device has
        // an attempt with its own version: it can still be finished and handed in)
        if (b?.def) {
          titulo = b.titulo || docente.propios[id]?.titulo || 'Examen';
          examenBorrado = true;
          await abrir(b, false);
          return;
        }
        throw new Error('Este examen ya no existe (se ha borrado).');
      }
      if (!p.examen.items.length && !b?.def) throw new Error('Este examen aún no tiene preguntas: añádalas en «Editar».');
      const def = p.examen;
      const huella = huellaExamen(def);
      titulo = p.titulo;
      if (b && !b.def && b.actualizado !== p.actualizado) {
        sinVersion = b;
        return;
      }
      const nuevo = !b;
      if (!b) b = { variante, inicio: Date.now(), respuestas: {}, actualizado: p.actualizado, def: $state.snapshot(def) as DefinicionExamen, huella, titulo: p.titulo };
      else if (!b.def) b = { ...b, def: $state.snapshot(def) as DefinicionExamen, huella };
      cambiadoDesde = b.huella !== huella;
      await abrir(b, nuevo);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  /** Loads and assembles the attempt; only once its questions are on screen is its draft written and its clock started. */
  async function abrir(b: Borrador, nuevo: boolean): Promise<void> {
    pendiente = { b, nuevo };
    try {
      // (review 10f: the ATTEMPT's own items, not the exam's current ones)
      await prepararItems(b.def!.items);
    } catch (e) {
      // (review 10h, r10h·3: in the app's words, with «Reintentar»; nothing written, no clock)
      console.warn('no se pudo cargar el intento', e);
      falloCarga =
        e instanceof ErrorCarga || e instanceof TypeError || /fetch|network|cargar/i.test(String(e))
          ? 'No se han podido cargar las preguntas de este examen (¿sin conexión, o un fallo al leer el contenido de la aplicación?).'
          : `No se han podido cargar las preguntas de este examen (${e instanceof Error ? e.message : String(e)}).`;
      return;
    }
    const montado = montarExamen(b.def!, libro, b.variante);
    if (montado.faltan.length && !parcial) {
      // everything loaded, and still missing: those questions are no longer in the book (review 10h)
      noDisponibles = montado.faltan;
      return;
    }
    // (review 10h, r10h·3: a draft written by an older build at «Empezar», never opened and without answers, starts now)
    const sinRespuestas = !Object.values(b.respuestas).some((r) => Object.values(r).some((v) => String(v).trim()));
    if (nuevo || (!b.abierto && sinRespuestas)) b = { ...b, inicio: Date.now(), transcurrido: 0 };
    b = { ...b, abierto: true, titulo: b.titulo || titulo };
    // the time already counted: the stored one, or the wall clock's if larger (time passes while the app is closed);
    // a wall clock behind the start (moved back) never gives back time (review 10h)
    const pared = Date.now() - b.inicio;
    baseTranscurrido = Math.max(b.transcurrido ?? 0, pared >= 0 ? pared : 0);
    monoInicio = performance.now();
    ahora = monoInicio;
    borrador = b;
    ex = montado;
    pendiente = null;
    guardarBorrador();
    reloj = setInterval(() => {
      ahora = performance.now();
      if (ahora - ultimoGuardadoTiempo > 15_000) guardarBorrador();
      // (an opened attempt only — this one is; never in a paused tab; a failed automatic hand-in is retried every 15 s)
      if (ex?.minutos && restante() <= 0 && !entregando && escrituraPermitida() && Date.now() - ultimoFallo >= 15_000) void entregar(true);
    }, 1000);
  }

  /** The attempt time counted so far (ms): monotonic within the page. */
  const transcurrido = () => baseTranscurrido + (performance.now() - monoInicio);

  function guardarBorrador(): void {
    // (a paused tab writes nothing and its page is inert: not a failure to report — it takes the draft up when it is the
    // active tab again)
    if (!borrador || !escrituraPermitida()) return;
    ultimoGuardadoTiempo = performance.now();
    borrador = { ...borrador, transcurrido: Math.round(transcurrido()) };
    falloBorrador = escribirBorrador(id, borrador)
      ? ''
      : 'No se pueden guardar sus respuestas en este dispositivo (¿almacenamiento lleno?): no cierre ni recargue la página hasta entregar el examen.';
  }

  async function reintentar(): Promise<void> {
    const p = pendiente;
    falloCarga = '';
    if (p) await abrir(p.b, p.nuevo);
    else await arrancar();
  }

  /** Shows the questions that are still in the book and lets the reader hand them in (the other answers are kept). */
  async function verLoQueHay(): Promise<void> {
    const p = pendiente;
    if (!p) return;
    parcial = true;
    noDisponibles = [];
    await abrir(p.b, p.nuevo);
  }

  async function empezarDeNuevo() {
    if (!(await confirmar({ titulo: '¿Empezar de nuevo?', mensaje: 'Las respuestas del intento sin entregar se perderán.', aceptar: 'Empezar de nuevo' }))) return;
    const p = propio(id);
    if (!p || p.tipo !== 'examen' || !p.examen) return;
    if (reloj) clearInterval(reloj);
    const b: Borrador = { variante, inicio: Date.now(), respuestas: {}, actualizado: p.actualizado, def: $state.snapshot(p.examen) as DefinicionExamen, huella: huellaExamen(p.examen), titulo: p.titulo };
    sinVersion = null;
    cambiadoDesde = false;
    await abrir(b, true);
  }

  onDestroy(() => {
    if (reloj) clearInterval(reloj);
    quitarGuarda();
  });

  const restante = () => (ex && borrador ? ex.minutos * 60_000 - transcurrido() : Infinity);
  const quedan = $derived(ex?.minutos && borrador ? Math.max(0, ex.minutos * 60_000 - (baseTranscurrido + (ahora - monoInicio))) : null);
  const mmss = (ms: number) => {
    const s = Math.ceil(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };
  // 1.0 accessibility pass: the remaining time is always readable (not live), and only a few warnings are spoken —
  // half the time, 10, 5 and 2 minutes and the last minute — instead of one every minute (WCAG 2.2.1, 4.1.3)
  const minutosQuedan = $derived(quedan == null ? null : Math.ceil(quedan / 60_000));
  const tiempoRestante = $derived(
    quedan == null ? '' : quedan === 0 ? 'Tiempo agotado' : quedan <= 60_000 ? 'Tiempo restante: menos de un minuto' : `Tiempo restante: ${minutosQuedan} minutos`,
  );
  const anuncio = $derived.by(() => {
    if (quedan == null || !ex?.minutos || minutosQuedan == null) return '';
    // the end is said once by the «data-tiempo-agotado» status below (not again on each retried hand-in)
    if (quedan === 0) return '';
    if (quedan <= 60_000) return 'Queda menos de un minuto';
    const m = minutosQuedan;
    const mitad = Math.ceil(ex.minutos / 2);
    if (m === ex.minutos) return '';
    if ([10, 5, 2].includes(m) || (m === mitad && ex.minutos >= 8)) return `Quedan ${m} minutos`;
    return '';
  });
  const terminado = $derived(!!ex?.minutos && quedan === 0);

  function cambiar(n: number, clave: string, valor: string) {
    if (!borrador || entregando || (ex?.minutos && restante() <= 0)) return;
    const r = { ...(borrador.respuestas[n] ?? {}), [clave]: valor.slice(0, 4000) };
    borrador = { ...borrador, respuestas: { ...borrador.respuestas, [n]: r } };
    // (review 10f: a draft that cannot be written is said; review 10h: and the page holds the reader — lib/salida.ts)
    guardarBorrador();
  }

  const respondida = (n: number) => Object.values(borrador?.respuestas[n] ?? {}).some((v) => String(v).trim());

  async function simularDisenosExamen(e: ExamenMontado, respuestas: Record<number, Record<string, string>>): Promise<void> {
    const pendientes = e.items.flatMap((m) => {
      const ej = m.k === 'ejercicio' ? libro.ejercicio(m.ref) : undefined;
      return (ej?.preguntas ?? []).filter((q) => q.tipo === 'diseno' && faltaSimular(q, respuestas[m.n]?.[q.id] ?? '')).map((q) => ({ m, q }));
    });
    if (!pendientes.length) return;
    try {
      const { medirDiseno } = await import('../../lib/simular-diseno');
      for (const { m, q } of pendientes) {
        if (q.tipo !== 'diseno') continue;
        const r = (respuestas[m.n] ??= {});
        r[q.id] = await simularDiseno(q, r[q.id] ?? '', medirDiseno);
      }
    } catch (err) {
      // graded as not simulated («Falta simular este diseño»), never as right
      console.warn('No se pudo simular un diseño del examen', err);
    }
  }

  async function entregar(agotado = false) {
    if (!ex || !borrador || entregando) return;
    if (ex.minutos && restante() <= 0) agotado = true;
    const sin = ex.items.filter((m) => !respondida(m.n)).length;
    if (!agotado && sin && !(await confirmar({ titulo: '¿Entregar el examen?', mensaje: `${sin === 1 ? 'Hay 1 pregunta' : `Hay ${sin} preguntas`} sin responder.`, aceptar: 'Entregar' }))) return;
    if (entregando) return;
    entregando = true;
    falloEntrega = '';
    const b = borrador;
    // 1.1: the design questions are graded on their simulation: the ones not simulated yet are simulated now, and the
    // measurements are kept with the answers (the result never depends on simulating again)
    await simularDisenosExamen(ex, b.respuestas);
    const nota = calificarExamen(ex, libro, b.respuestas);
    const t = Date.now();
    // (review 10h: the items no longer in the book keep their answers with the result, ungraded)
    const porRef = new Map(b.def!.items.map((it) => [`${it.k}:${it.ref}`, it]));
    const numeroDe = numerosDe(b.def!, b.variante);
    const sinCorregir = ex.faltan.map((k) => {
      const it = porRef.get(k)!;
      return { k: it.k, ref: it.ref, maximo: it.puntos, valores: b.respuestas[numeroDe.get(k) ?? -1] ?? {} };
    });
    let rid: string;
    try {
      rid = await guardarResultado(
        {
          examen: id,
          titulo,
          semilla: ex.semilla,
          variante: ex.variante,
          inicio: b.inicio,
          t,
          puntos: nota.puntos,
          maximo: nota.maximo,
          minutos: ex.minutos,
          agotado: agotado || undefined,
          ...(sinCorregir.length ? { sinCorregir } : {}),
          items: ex.items.map((m, i) => {
            const vr = varianteDe(m, libro);
            return {
              k: m.k,
              ref: m.ref,
              puntos: nota.items[i]!.puntos,
              maximo: m.puntos,
              valores: b.respuestas[m.n] ?? {},
              estado: nota.items[i]!.estado,
              ...(m.variante != null ? { variante: m.variante } : {}),
              // (review 10h: the variant as it was seen: the result never depends on the practice content again)
              ...(vr ? { vv: guardarVariante(vr.item, vr.v, enunciadoDe(vr.item, vr.v)) } : {}),
              ...(m.orden ? { orden: m.orden } : {}),
              ...(m.opciones ? { opciones: m.opciones } : {}),
            };
          }),
        },
        idResultado(id, b.inicio),
      );
    } catch (e) {
      ultimoFallo = Date.now();
      entregando = false;
      falloEntrega = `No se ha podido guardar el resultado (${e instanceof Error ? e.message : String(e)}). Sus respuestas siguen guardadas en este dispositivo: vuelva a entregar el examen.`;
      return;
    }
    if (reloj) clearInterval(reloj);
    entregado = true;
    borrarBorrador(id);
    location.replace(`#/docente/resultado/${rid}`);
  }
</script>

<div class="hacer" data-hacer-examen={id}>
  {#if error}
    <p class="volver"><a class="enlace toque-44" href="#/docente">← Modo docente</a></p>
    <p class="aviso" role="alert">{error}</p>
  {:else if falloCarga}
    <p class="volver"><a class="enlace toque-44" href="#/docente">← Modo docente</a></p>
    <div class="aviso" role="alert" data-fallo-carga>
      <p>{falloCarga} {leerBorrador(id) ? 'Sus respuestas siguen guardadas en este dispositivo.' : 'El examen no ha empezado: su tiempo no corre.'}</p>
      <button type="button" class="t09-boton" onclick={() => void reintentar()} data-reintentar>Reintentar</button>
    </div>
  {:else if noDisponibles.length}
    <p class="volver"><a class="enlace toque-44" href="#/docente">← Modo docente</a></p>
    <div class="aviso" role="alert" data-no-disponibles>
      <p>
        {noDisponibles.length === 1 ? 'Una pregunta' : `${noDisponibles.length} preguntas`} de este intento ya no {noDisponibles.length === 1 ? 'está' : 'están'} en el libro de esta versión de la aplicación. Puede ver las demás y entregarlas; las respuestas de las que faltan se guardan con el resultado, sin corregir.
      </p>
      <button type="button" class="t09-boton" onclick={() => void verLoQueHay()} data-ver-lo-que-hay>Ver y entregar lo que hay</button>
    </div>
  {:else if sinVersion}
    <p class="volver"><a class="enlace toque-44" href={`#/docente/examen/${id}`}>← El examen</a></p>
    <div class="aviso" role="alert" data-examen-cambiado>
      <p>Este examen ha cambiado desde que empezó el intento que dejó sin entregar, y sus respuestas no se pueden llevar a las preguntas nuevas. Siguen guardadas hasta que decida.</p>
      <button type="button" class="t09-boton" onclick={() => void empezarDeNuevo()} data-empezar-de-nuevo>Empezar de nuevo</button>
    </div>
  {:else if !ex}
    <p class="cargando">Preparando el examen…</p>
  {:else}
    <header class="cab">
      <div>
        <h1>{titulo}</h1>
        <p class="meta">Variante {ex.letra} · {ex.items.length} preguntas · {textoPuntos(ex.maximo)} puntos</p>
      </div>
      {#if quedan != null}
        <p class="reloj" class:poco={quedan < 60_000} data-reloj>
          <Timer size={18} aria-hidden="true" /> <span aria-hidden="true">{mmss(quedan)}</span>
          <span class="solo-lector">{tiempoRestante}</span>
          <span class="solo-lector" aria-live="polite" data-aviso-tiempo>{anuncio}</span>
        </p>
      {/if}
    </header>
    {#if falloBorrador}<p class="aviso" role="alert" data-fallo-borrador>{falloBorrador}</p>{/if}
    {#if examenBorrado}
      <p class="aviso" role="status" data-examen-borrado>Este examen se ha borrado, pero este intento sigue aquí: puede terminarlo y entregarlo; su resultado se guardará.</p>
    {/if}
    {#if ex.faltan.length}
      <p class="aviso" role="status" data-parcial>{ex.faltan.length === 1 ? 'Falta una pregunta' : `Faltan ${ex.faltan.length} preguntas`} que ya no están en el libro: sus respuestas se guardarán con el resultado, sin corregir.</p>
    {/if}
    {#if cambiadoDesde}
      <p class="aviso" role="status" data-version-inicial>
        Este examen ha cambiado desde que empezó este intento: sigue con las preguntas con las que lo empezó. Los cambios valdrán para el próximo.
      </p>
    {/if}
    {#if terminado}
      <p class="aviso" role="status" data-tiempo-agotado>Se ha acabado el tiempo: ya no se pueden cambiar las respuestas. Entregue el examen.</p>
    {/if}
    <!-- (review 10c: once the time is over nothing can be changed, also while a failed hand-in waits to be retried) -->
    <fieldset class="bloque" disabled={terminado}>
    <legend class="solo-lector">Preguntas</legend>
    <ol class="items">
      {#each ex.items as m (m.n)}
        <li class="t09-tarjeta item">
          <h2 class="rot">Pregunta {m.n} <span class="pts">({textoPuntos(m.puntos)} {m.puntos === 1 ? 'punto' : 'puntos'})</span></h2>
          <ItemExamen {m} valores={borrador?.respuestas[m.n] ?? {}} alCambiar={(k, v) => cambiar(m.n, k, v)} />
        </li>
      {/each}
    </ol>
    </fieldset>
    <div class="pie">
      {#if falloEntrega}<p class="aviso" role="alert" data-fallo-entrega>{falloEntrega}</p>{/if}
      <button type="button" class="t09-boton" disabled={entregando} onclick={() => void entregar()} data-entregar>Entregar el examen</button>
      <p class="nota">Al entregar verá la nota de cada pregunta y el desarrollo del libro.</p>
    </div>
  {/if}
</div>

<style>
  .hacer {
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-width: 820px;
    margin: 0 auto;
    padding: 0 32px 64px;
    font-family: var(--sans);
  }
  @media (max-width: 600px) {
    .hacer {
      padding: 0 16px 48px;
    }
  }
  .cab {
    position: sticky;
    top: 0;
    z-index: 2;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px 16px;
    padding: 14px 0 10px;
    border-bottom: 1px solid var(--linea);
    background: var(--fondo);
  }
  h1 {
    margin: 0;
    color: var(--titulos);
    font-family: var(--titular);
    font-size: 24px;
  }
  .meta,
  .nota,
  .cargando {
    margin: 2px 0 0;
    color: var(--tinta-suave);
    font-size: 14px;
  }
  .reloj {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin: 0;
    padding: 6px 12px;
    border: 1.5px solid var(--linea);
    border-radius: 999px;
    color: var(--titulos);
    font-size: 18px;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
  }
  .reloj.poco {
    border-color: var(--c-importante);
  }
  .bloque {
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }
  .items {
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .rot {
    margin: 0 0 8px;
    color: var(--acento);
    font-size: 15px;
  }
  .pts {
    color: var(--tinta-suave);
    font-weight: 600;
  }
  .pie {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }
  .t09-boton {
    min-height: 48px;
  }
  .aviso {
    padding: 12px 14px;
    border: 1px solid var(--linea);
    border-radius: 12px;
  }
</style>
