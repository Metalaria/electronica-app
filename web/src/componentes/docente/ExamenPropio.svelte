<script lang="ts">
  // An own exam (#/docente/examen/<id>): start it in the app (choosing the variant), export it to PDF (exam and
  // solutions) and see the results of earlier attempts.
  import { onMount } from 'svelte';
  import Play from '@lucide/svelte/icons/play';
  import Pencil from '@lucide/svelte/icons/pencil';
  import Trash from '@lucide/svelte/icons/trash-2';
  import { confirmar } from '../../lib/confirmar';
  import { borrarResultado, cargarDocente, docente, propio, resultadosDe } from '../../lib/docente/estado.svelte';
  import { letraVariante, textoPuntos } from '../../lib/docente/examen';
  import { borrarBorrador, leerBorrador } from './borrador';
  import ExportarPdf from './ExportarPdf.svelte';

  let { id }: { id: string } = $props();

  onMount(() => {
    void cargarDocente();
  });

  const p = $derived(docente.listo ? propio(id) : null);
  const ex = $derived(p?.tipo === 'examen' ? p.examen : undefined);
  const resultados = $derived(docente.listo ? resultadosDe(id) : []);
  const hayVariantes = $derived(!!ex && (ex.variantes || ex.barajar));
  /** The next variant by default: the one after the last attempt's. */
  let variante = $state<number | null>(null);
  const elegida = $derived(variante ?? (hayVariantes ? ((resultados[0]?.variante ?? -1) + 1) % 10 : 0));
  const enCurso = $derived(p ? leerBorrador(id) : null);

  const fecha = (t: number) => new Date(t).toLocaleString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  function empezar() {
    if (!p || p.tipo !== 'examen' || !p.examen) return;
    // (review 10h, r10h·3: nothing is written here — the exam page writes the draft, with its start time, only once the
    // attempt's questions are on screen; the chosen variant goes in the route)
    location.hash = `#/docente/examen/${id}/hacer${elegida ? `/${elegida}` : ''}`;
  }

  async function empezarDeNuevo() {
    if (!(await confirmar({ titulo: '¿Empezar de nuevo?', mensaje: 'Las respuestas del examen sin entregar se perderán.', aceptar: 'Empezar de nuevo' }))) return;
    if (!borrarBorrador(id)) return;
    empezar();
  }

  async function borrar(rid: string) {
    if (!(await confirmar({ titulo: '¿Borrar este resultado?', aceptar: 'Borrar' }))) return;
    falloBorrar = '';
    try {
      await borrarResultado(rid);
    } catch (e) {
      falloBorrar = `No se ha podido borrar el resultado (${e instanceof Error ? e.message : String(e)}).`;
    }
  }
  let falloBorrar = $state('');
</script>

<div class="examen" data-examen-propio={id}>
  <p class="volver"><a class="enlace toque-44" href="#/docente">← Modo docente</a></p>
  {#if !docente.listo}
    <p class="cargando">Cargando…</p>
  {:else if !p || !ex}
    <p class="aviso" role="alert">Este examen ya no existe (se ha borrado).</p>
  {:else}
    <header>
      <h1>{p.titulo}</h1>
      <p class="meta">
        {ex.items.length} preguntas · {textoPuntos(ex.items.reduce((a, i) => a + i.puntos, 0))} puntos · {ex.minutos ? `${ex.minutos} minutos` : 'sin límite de tiempo'}{ex.variantes
          ? ' · variantes con otros valores'
          : ''}{ex.barajar ? ' · orden barajado' : ''}
      </p>
      {#if p.notas}<p class="notas">{p.notas}</p>{/if}
      <a class="t09-boton t09-contorno" href={`#/docente/editar/${id}`}><Pencil size={16} aria-hidden="true" /> Editar</a>
    </header>

    <section class="t09-tarjeta" aria-labelledby="h-hacer">
      <h2 id="h-hacer">Hacer el examen en la aplicación</h2>
      <p>Sin pistas y con el tiempo a la vista. Al entregar verá la nota de cada pregunta, el total y el desarrollo del libro.</p>
      {#if hayVariantes}
        <label class="campo">
          <span>Variante</span>
          <select class="dc-entrada" value={String(elegida)} onchange={(ev) => (variante = Number((ev.currentTarget as HTMLSelectElement).value))} data-variante-hacer>
            {#each Array.from({ length: 10 }, (_, k) => k) as k (k)}<option value={String(k)}>{letraVariante(k)}</option>{/each}
          </select>
        </label>
      {/if}
      <div class="botones">
        <!-- (review 10c, r10c·4: an attempt in progress is never dropped because the exam was edited or synchronised) -->
        {#if enCurso}
          <a class="t09-boton" href={`#/docente/examen/${id}/hacer`} data-seguir><Play size={18} aria-hidden="true" /> Seguir con el examen empezado</a>
          <button type="button" class="t09-boton t09-contorno" onclick={() => void empezarDeNuevo()}>Empezar de nuevo</button>
        {:else}
          <button type="button" class="t09-boton" disabled={!ex.items.length} onclick={empezar} data-empezar><Play size={18} aria-hidden="true" /> Empezar</button>
        {/if}
      </div>
    </section>

    <ExportarPdf propio={p} />

    <section aria-labelledby="h-resultados">
      <h2 id="h-resultados">Resultados ({resultados.length})</h2>
      {#if falloBorrar}<p class="aviso" role="alert" data-fallo-borrar>{falloBorrar}</p>{/if}
      {#if !resultados.length}
        <p class="vacio">Aún no lo ha hecho en la aplicación.</p>
      {:else}
        <ul class="resultados">
          {#each resultados as r (r.id)}
            <li data-resultado={r.id}>
              <a class="toque-44" href={`#/docente/resultado/${r.id}`}>
                <strong>{textoPuntos(r.puntos)} de {textoPuntos(r.maximo)}</strong>
                <span>Variante {letraVariante(r.variante ?? 0)} · {fecha(r.t)}{r.items.some((i) => i.estado === 'pendiente') ? ' · falta autoevaluar' : ''}</span>
              </a>
              <button type="button" class="icono" onclick={() => void borrar(r.id)} aria-label={`Borrar el resultado del ${fecha(r.t)}`}><Trash size={18} aria-hidden="true" /></button>
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  {/if}
</div>

<style>
  .examen {
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-width: 820px;
    margin: 0 auto;
    padding: 24px 32px 64px;
    font-family: var(--sans);
  }
  @media (max-width: 600px) {
    .examen {
      padding: 12px 16px 48px;
    }
  }
  .volver {
    margin: 0;
  }
  h1 {
    margin: 0;
    color: var(--titulos);
    font-family: var(--serif);
    font-size: 28px;
  }
  h2 {
    margin: 0 0 8px;
    color: var(--titulos);
    font-size: 18px;
  }
  header {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  .meta,
  .vacio,
  .cargando,
  section p {
    margin: 0;
    color: var(--tinta-suave);
    font-size: 14.5px;
    line-height: 1.5;
  }
  .notas {
    margin: 0;
    color: var(--tinta);
    white-space: pre-line;
  }
  .campo {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-width: 12em;
    margin-top: 10px;
    color: var(--tinta-suave);
    font-size: 13.5px;
    font-weight: 600;
  }
  .campo select {
    min-height: 44px;
  }
  .botones {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  }
  .t09-boton {
    min-height: 44px;
  }
  .resultados {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .resultados li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 4px 4px 12px;
    border: 1px solid var(--linea);
    border-radius: 12px;
    background: var(--superficie);
  }
  .resultados a {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 44px;
    justify-content: center;
    color: var(--titulos);
    text-decoration: none;
  }
  .resultados a span {
    color: var(--tinta-suave);
    font-size: 13.5px;
  }
  .icono {
    display: grid;
    width: 44px;
    height: 44px;
    place-items: center;
    border: 0;
    border-radius: 10px;
    background: none;
    color: var(--tinta-suave);
  }
  .aviso {
    padding: 12px 14px;
    border: 1px solid var(--linea);
    border-radius: 12px;
  }
</style>
