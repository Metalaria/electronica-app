<script lang="ts">
  // «Modo docente» (1.0, #/docente…): the reader's own courses and exams made with the book's sections, exercises,
  // problems and Repaso questions. The list (create, open, edit, duplicate, export, delete) and the router of its
  // pages: nuevo/curso|examen and editar/<id> (EditorPropio), curso/<id>[/<n>] (CursoPropio), examen/<id>
  // (ExamenPropio), examen/<id>/hacer[/<variante>] (HacerExamen), resultado/<id> (ResultadoExamen).
  import EnlaceGuia from '../guia/EnlaceGuia.svelte';
  import { onMount } from 'svelte';
  import './docente.css';
  import Plus from '@lucide/svelte/icons/plus';
  import Copy from '@lucide/svelte/icons/copy';
  import Pencil from '@lucide/svelte/icons/pencil';
  import Trash from '@lucide/svelte/icons/trash-2';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import { ruta } from '../../lib/ruta.svelte';
  import { confirmar } from '../../lib/confirmar';
  import { borrarPropio, propio, cargarDocente, docente, duplicarPropio, listaPropios, reintentarDocente, resultadosDe } from '../../lib/docente/estado.svelte';
  import { textoPuntos } from '../../lib/docente/examen';
  import type { Propio } from '../../lib/docente/tipos';
  import { borrarBorrador, intentosDeBorrados, leerBorrador, limpiarHuerfanos } from './borrador';
  import EditorPropio from './EditorPropio.svelte';
  import CursoPropio from './CursoPropio.svelte';
  import ExamenPropio from './ExamenPropio.svelte';
  import HacerExamen from './HacerExamen.svelte';
  import ResultadoExamen from './ResultadoExamen.svelte';

  onMount(() => {
    // (review 10c: the drafts of attempts at exams that were deleted — here or on another device — go; through the gate)
    void cargarDocente().then(() => limpiarHuerfanos((x) => !!docente.propios[x]?.borrado));
  });

  // a new page of the section starts at the top (the view stays the same, so the app does not scroll by itself);
  // «Atrás» keeps its position (the router restores it)
  let anclaVista: string | null = null;
  $effect(() => {
    const a = ruta.ancla;
    void ruta.n;
    if (anclaVista !== null && a !== anclaVista && ruta.y == null) window.scrollTo(0, 0);
    anclaVista = a;
  });

  const seg = $derived(ruta.ancla.split('/').filter(Boolean).map(decodeURIComponent));
  const cursos = $derived(docente.listo ? listaPropios('curso') : []);
  /** Review 10f: what is left of exams deleted elsewhere — attempts still to hand in here, and results. */
  const huerfanos = $derived.by(() => {
    if (!docente.listo) return { intentos: [] as string[], resultados: [] as ReturnType<typeof resultadosDe> };
    const borrado = (x: string) => !!docente.propios[x]?.borrado;
    return { intentos: intentosDeBorrados((x) => !!propio(x)), resultados: resultadosDe().filter((r) => !docente.propios[r.examen] || borrado(r.examen)) };
  });
  const examenes = $derived(docente.listo ? listaPropios('examen') : []);

  const fecha = (t: number) => new Date(t).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

  function resumen(p: Propio): string {
    if (p.tipo === 'curso') {
      const n = p.curso?.elementos.length ?? 0;
      return `${n} ${n === 1 ? 'elemento' : 'elementos'}`;
    }
    const e = p.examen;
    const n = e?.items.length ?? 0;
    const pts = e?.items.reduce((a, i) => a + i.puntos, 0) ?? 0;
    return `${n} ${n === 1 ? 'pregunta' : 'preguntas'} · ${textoPuntos(pts)} puntos · ${e?.minutos ? `${e.minutos} min` : 'sin límite'}`;
  }

  async function duplicar(p: Propio) {
    const id = await duplicarPropio(p.id);
    if (id) location.hash = `#/docente/editar/${id}`;
  }

  async function borrar(p: Propio) {
    const n = p.tipo === 'examen' ? resultadosDe(p.id).length : 0;
    // (review 10f: an attempt not handed in on this device goes with the exam deleted here — the dialog says so)
    const intento = p.tipo === 'examen' && !!leerBorrador(p.id);
    const ok = await confirmar({
      titulo: `¿Borrar «${p.titulo || 'sin título'}»?`,
      mensaje: [
        intento ? 'Hay un intento de este examen sin entregar en este dispositivo: sus respuestas se perderán.' : '',
        n ? `Sus ${n} resultados se conservan en este apartado.` : 'Se borrará también en los demás dispositivos al sincronizar.',
      ]
        .filter(Boolean)
        .join(' '),
      aceptar: 'Borrar',
    });
    if (!ok) return;
    falloBorrar = '';
    try {
      await borrarPropio(p.id);
    } catch (e) {
      // (review 10h: the deletion is atomic — nothing changed — and said)
      falloBorrar = `No se ha podido borrar «${p.titulo || 'sin título'}» (${e instanceof Error ? e.message : String(e)}).`;
      return;
    }
    if (docente.propios[p.id]?.borrado) borrarBorrador(p.id);
  }
  let falloBorrar = $state('');
</script>

{#if seg[0] === 'nuevo' && (seg[1] === 'curso' || seg[1] === 'examen')}
  {#key ruta.ancla}<EditorPropio tipo={seg[1]} />{/key}
{:else if seg[0] === 'editar' && seg[1]}
  {#key ruta.ancla}<EditorPropio id={seg[1]} />{/key}
{:else if seg[0] === 'curso' && seg[1]}
  <CursoPropio id={seg[1]} paso={seg[2] != null && seg[2] !== 'saltar' ? Number(seg[2]) : null} salto={seg[2] === 'saltar' && seg[3] != null ? Number(seg[3]) : null} />
{:else if seg[0] === 'examen' && seg[1] && seg[2] === 'hacer'}
  {#key ruta.ancla}<HacerExamen id={seg[1]} variante={Number(seg[3]) || 0} />{/key}
{:else if seg[0] === 'examen' && seg[1]}
  {#key ruta.ancla}<ExamenPropio id={seg[1]} />{/key}
{:else if seg[0] === 'resultado' && seg[1]}
  {#key ruta.ancla}<ResultadoExamen id={seg[1]} />{/key}
{:else}
  <div class="docente" data-docente>
    <header class="cab">
      <h1>Modo docente</h1>
      <p>
        Prepare cursos y exámenes propios con las secciones, los ejercicios, los problemas y las preguntas del libro. Puede hacerlos
        en la aplicación, con su nota y el desarrollo del libro, o exportarlos a PDF para imprimirlos.
        <!-- 1.0: how it works, in the user guide -->
        <EnlaceGuia seccion="docente" />
      </p>
      <div class="acciones">
        <a class="t09-boton" href="#/docente/nuevo/examen" data-nuevo-examen><Plus size={18} aria-hidden="true" /> Nuevo examen</a>
        <a class="t09-boton t09-contorno" href="#/docente/nuevo/curso" data-nuevo-curso><Plus size={18} aria-hidden="true" /> Nuevo curso</a>
      </div>
    </header>

    {#if docente.error === 'lectura' || docente.error === 'escritura'}
      <p class="aviso" role="alert">
        {docente.error === 'lectura' ? 'No se pudieron leer sus cursos y exámenes guardados.' : 'No se pudo guardar el último cambio.'}
        <button type="button" class="t09-boton t09-contorno" onclick={() => void reintentarDocente()}>Reintentar</button>
      </p>
    {:else if docente.error === 'memoria'}
      <p class="aviso" role="status">Este navegador no deja guardar datos: lo que haga aquí se perderá al cerrar la página.</p>
    {/if}

    {#if falloBorrar}<p class="aviso" role="alert" data-fallo-borrar>{falloBorrar}</p>{/if}
    {#if !docente.listo}
      <p class="cargando">Cargando…</p>
    {:else}
      {#each [{ titulo: 'Exámenes', lista: examenes, vacio: 'Aún no ha creado ningún examen.' }, { titulo: 'Cursos', lista: cursos, vacio: 'Aún no ha creado ningún curso.' }] as grupo (grupo.titulo)}
        <section class="grupo" aria-labelledby={`g-${grupo.titulo}`}>
          <h2 id={`g-${grupo.titulo}`}>{grupo.titulo}</h2>
          {#if !grupo.lista.length}
            <p class="vacio">{grupo.vacio}</p>
          {:else}
            <ul class="lista">
              {#each grupo.lista as p (p.id)}
                {@const res = p.tipo === 'examen' ? resultadosDe(p.id) : []}
                <li class="t09-tarjeta propio" data-propio={p.id} data-tipo={p.tipo}>
                  <h3><a class="toque-44" href={`#/docente/${p.tipo}/${p.id}`}>{p.titulo || 'Sin título'}</a></h3>
                  <p class="meta">{resumen(p)} · cambiado el {fecha(p.actualizado)}</p>
                  {#if res.length}
                    <p class="meta" data-ultimo-resultado>Último resultado: {textoPuntos(res[0]!.puntos)} de {textoPuntos(res[0]!.maximo)} ({fecha(res[0]!.t)})</p>
                  {/if}
                  {#if p.notas}<p class="notas">{p.notas}</p>{/if}
                  <div class="botones">
                    <a class="t09-boton" href={`#/docente/${p.tipo}/${p.id}`} data-abrir>
                      {p.tipo === 'examen' ? 'Hacer o exportar' : 'Abrir el curso'} <ArrowRight size={18} aria-hidden="true" />
                    </a>
                    <a class="t09-boton t09-contorno" href={`#/docente/editar/${p.id}`} data-editar><Pencil size={16} aria-hidden="true" /> Editar</a>
                    <button type="button" class="t09-boton t09-contorno" onclick={() => void duplicar(p)} data-duplicar><Copy size={16} aria-hidden="true" /> Duplicar</button>
                    <button type="button" class="t09-boton t09-contorno peligro" onclick={() => void borrar(p)} data-borrar aria-label={`Borrar «${p.titulo || 'sin título'}»`}>
                      <Trash size={16} aria-hidden="true" /> Borrar
                    </button>
                  </div>
                </li>
              {/each}
            </ul>
          {/if}
        </section>
      {/each}
      {#if huerfanos.intentos.length || huerfanos.resultados.length}
        <section class="grupo" aria-labelledby="g-borrados" data-de-borrados>
          <h2 id="g-borrados">De exámenes borrados</h2>
          <ul class="lista">
            {#each huerfanos.intentos as x (x)}
              <li class="t09-tarjeta propio" data-intento-huerfano={x}>
                <p class="meta">«{leerBorrador(x)?.titulo || docente.propios[x]?.titulo || 'Sin título'}»: un intento sin entregar en este dispositivo.</p>
                <div class="botones"><a class="t09-boton" href={`#/docente/examen/${x}/hacer`}>Terminarlo y entregarlo</a></div>
              </li>
            {/each}
            {#each huerfanos.resultados as r (r.id)}
              <li class="t09-tarjeta propio" data-resultado-huerfano={r.id}>
                <p class="meta">«{r.titulo}»: {textoPuntos(r.puntos)} de {textoPuntos(r.maximo)} ({fecha(r.t)})</p>
                <div class="botones"><a class="t09-boton t09-contorno" href={`#/docente/resultado/${r.id}`}>Ver el resultado</a></div>
              </li>
            {/each}
          </ul>
        </section>
      {/if}
    {/if}
  </div>
{/if}

<style>
  .docente {
    display: flex;
    flex-direction: column;
    gap: 22px;
    max-width: 920px;
    margin: 0 auto;
    padding: 32px 32px 64px;
    font-family: var(--sans);
  }
  @media (max-width: 600px) {
    .docente {
      padding: 16px 16px 48px;
    }
  }
  h1 {
    margin: 0;
    color: var(--titulos);
    font-family: var(--serif);
    font-size: 30px;
    line-height: 1.2;
  }
  .cab p {
    max-width: 46em;
    margin: 8px 0 0;
    color: var(--tinta-suave);
    line-height: 1.5;
  }
  .acciones,
  .botones {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 14px;
  }
  h2 {
    margin: 0 0 10px;
    color: var(--titulos);
    font-size: 19px;
  }
  .lista {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  h3 {
    margin: 0;
    font-size: 18px;
  }
  h3 a {
    color: var(--titulos);
    text-decoration: none;
  }
  h3 a:hover {
    text-decoration: underline;
  }
  .meta,
  .vacio,
  .cargando {
    margin: 4px 0 0;
    color: var(--tinta-suave);
    font-size: 14px;
  }
  .notas {
    margin: 6px 0 0;
    color: var(--tinta);
    font-size: 14.5px;
    white-space: pre-line;
  }
  .t09-boton {
    min-height: 44px;
  }
  .aviso {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    margin: 0;
    padding: 12px 14px;
    border: 1px solid var(--linea);
    border-radius: 12px;
    background: var(--superficie);
  }
</style>
