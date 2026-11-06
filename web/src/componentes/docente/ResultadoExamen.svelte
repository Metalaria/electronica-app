<script lang="ts">
  // The result of an own exam (#/docente/resultado/<id>): the total, and for each item its grade, what was answered,
  // the right answer and the book's development. Open parts are self-assessed here (Bien / A medias / Mal) against
  // the development; the result is regraded and stored again (synchronised).
  import { onMount } from 'svelte';
  import { prepararHtml } from '../../lib/datos';
  import { actualizarResultado, cargarDocente, docente, propio, resultado } from '../../lib/docente/estado.svelte';
  import { libro, prepararItems } from '../../lib/docente/fuentes';
  import { calificarItem, esperadoVariante, letraVariante, montadoDeResultado, preguntaVista, textoPuntos, varianteDe } from '../../lib/docente/examen';
  import { respuestaCorrecta } from '../../lib/preguntas-ejercicio';
  import type { EstadoItem } from '../../lib/docente/tipos';
  import { enunciadoDe, textoCorrecto, valorTexto } from '../practica/variantes';
  import { exprLinea } from '../calculadoras/mates';
  import Bloques from '../Bloques.svelte';

  let { id }: { id: string } = $props();

  let listo = $state(false);
  let error = $state('');
  let guardando = $state(false);

  onMount(() => {
    void (async () => {
      try {
        await cargarDocente();
        const r = resultado(id);
        if (!r) throw new Error('Este resultado ya no existe (se ha borrado).');
        await prepararItems(r.items);
        listo = true;
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }
    })();
  });

  const r = $derived(docente.listo ? resultado(id) : null);
  // (minutes taken: when the time ran out, never more than the exam's limit — handed in later from a paused tab, the
  // clock to the hand-in is longer: review 10b)
  const minutos = $derived.by(() => {
    if (!r) return 0;
    const m = Math.max(1, Math.round((r.t - r.inicio) / 60_000));
    // (review 10h: the attempt's own limit, stored with the result; the exam's current one only for older results)
    const p = r.agotado && r.minutos == null ? propio(r.examen) : null;
    const limite = r.minutos ?? (p && p.tipo === 'examen' ? (p.examen?.minutos ?? 0) : 0);
    return limite ? Math.min(m, limite) : m;
  });
  const LETRAS = 'ABCDE';
  const ESTADO: Record<EstadoItem, string> = { bien: 'Correcta', parcial: 'En parte', mal: 'Incorrecta', blanco: 'En blanco', pendiente: 'Falta autoevaluar' };
  const fecha = (t: number) => new Date(t).toLocaleString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const pendientes = $derived(r?.items.filter((i) => i.estado === 'pendiente').length ?? 0);

  let falloAuto = $state('');

  async function autoevaluar(i: number, nota: number) {
    if (!r || guardando) return;
    guardando = true;
    falloAuto = '';
    try {
      const items = r.items.map((it, k) => {
        if (k !== i) return it;
        const c = calificarItem(montadoDeResultado(it, k + 1), libro, it.valores, nota);
        return { ...it, autoeval: nota, puntos: c.puntos, estado: c.estado };
      });
      const puntos = Math.round(items.reduce((a, x) => a + x.puntos, 0) * 100) / 100;
      await actualizarResultado(id, items, puntos);
    } catch (e) {
      // (review 10c: said, not swallowed; the grade shown is still the stored one)
      falloAuto = `No se ha podido guardar la autoevaluación (${e instanceof Error ? e.message : String(e)}). Vuelva a pulsarla.`;
    } finally {
      guardando = false;
    }
  }

  function nombre(k: 'ejercicio' | 'pregunta', ref: string): string {
    if (k === 'pregunta') return `Pregunta de test ${Number(/-(\d+)$/.exec(ref)?.[1] ?? 0)} · ${libro.rotulo(ref.replace(/-\d+$/, ''))}`;
    const e = libro.ejercicio(ref);
    return e ? `${e.tipo === 'prob' ? 'Problema' : 'Ejercicio'} ${e.num} · ${libro.rotulo(e.parte)}` : ref;
  }
</script>

<div class="resultado" data-resultado-examen={id}>
  <p class="volver"><a class="enlace toque-44" href={r && propio(r.examen) ? `#/docente/examen/${r.examen}` : '#/docente'}>{r && propio(r.examen) ? '← El examen' : '← Modo docente'}</a></p>
  {#if error}
    <p class="aviso" role="alert">{error}</p>
  {:else if !listo || !r}
    <p class="cargando">Corrigiendo…</p>
  {:else}
    <header class="t09-tarjeta total">
      <h1>{r.titulo}</h1>
      <p class="nota" data-nota-total>
        <strong>{textoPuntos(r.puntos)}</strong> de {textoPuntos(r.maximo)} puntos
      </p>
      <p class="meta">Variante {letraVariante(r.variante ?? 0)} · entregado el {fecha(r.t)} · {minutos} min{r.agotado ? ' · se acabó el tiempo' : ''}</p>
      {#if falloAuto}<p class="aviso" role="alert" data-fallo-autoeval>{falloAuto}</p>{/if}
      {#if pendientes}
        <p class="pendiente" data-pendientes>{pendientes === 1 ? 'Una pregunta espera' : `${pendientes} preguntas esperan`} a que la compare con el desarrollo del libro: la nota puede subir.</p>
      {/if}
    </header>

    {#if r.sinCorregir?.length}
      <section class="t09-tarjeta" data-sin-corregir>
        <h2>Sin corregir: ya no están en el libro</h2>
        <ul class="pide">
          {#each r.sinCorregir as x (x.ref)}
            <li>{x.k === 'pregunta' ? `Pregunta ${x.ref}` : x.ref} ({textoPuntos(x.maximo)} puntos): {Object.values(x.valores).filter((v) => String(v).trim()).join(' · ') || 'sin responder'}</li>
          {/each}
        </ul>
      </section>
    {/if}

    <ol class="items">
      {#each r.items as it, i (i)}
        {@const m = montadoDeResultado(it, i + 1)}
        {@const c = calificarItem(m, libro, it.valores, it.autoeval)}
        {@const p = it.k === 'pregunta' ? libro.pregunta(it.ref) : undefined}
        {@const e = it.k === 'ejercicio' ? libro.ejercicio(it.ref) : undefined}
        {@const bl = it.k === 'ejercicio' ? libro.bloques(it.ref) : undefined}
        {@const vr = varianteDe(m, libro)}
        <li class="t09-tarjeta item" data-item-resultado={i + 1} data-estado={it.estado}>
          <h2>
            <span class="num">{i + 1}.</span>
            {nombre(it.k, it.ref)}
          </h2>
          <p class="calif {it.estado}">
            <span class="sello">{ESTADO[it.estado]}</span>
            <span data-puntos-item>{textoPuntos(it.puntos)} de {textoPuntos(it.maximo)}</span>
          </p>

          {#if p}
            <p class="enunciado">{@html prepararHtml(p.enunciado)}</p>
            {#if p.tipo === 'opcion'}
              {@const orden = it.orden ?? p.opciones.map((_, k) => k)}
              {@const elegida = /^\d+$/.test(it.valores.r ?? '') ? Number(it.valores.r) : -1}
              <p><span class="rot">Su respuesta:</span> {#if elegida >= 0}{LETRAS[elegida]}) {@html prepararHtml(p.opciones[orden[elegida]!] ?? '')}{:else}sin responder{/if}</p>
              <p><span class="rot">Correcta:</span> {LETRAS[orden.indexOf(p.correcta)]}) {@html prepararHtml(p.opciones[p.correcta]!)}</p>
            {:else}
              <p><span class="rot">Su respuesta:</span> {it.valores.r?.trim() || 'sin responder'}</p>
              <p><span class="rot">Correcta:</span> {p.valor_texto} {p.unidad}</p>
            {/if}
            <div class="desarrollo">
              <p>{@html prepararHtml(p.explicacion)}</p>
              <p class="cita"><span class="rot">Del libro · {p.ref_tipo} {p.ref_num ?? ''}:</span> «{p.cita}»</p>
            </div>
          {:else if e}
            {#if vr}
              {@const esp = it.vv?.esperado ?? esperadoVariante(vr.item, vr.v)}
              {@const f = vr.item.formula}
              {@const sim = (x: string) => f.vars.find((v) => v.id === x)?.sim ?? x}
              {@const desp = vr.item.objetivo === f.resultado ? f.expr : f.despejes[vr.item.objetivo]}
              <p class="enunciado" data-enunciado-variante>{@html prepararHtml(it.vv?.enunciado ?? enunciadoDe(vr.item, vr.v))}</p>
              <p><span class="rot">{@html esp.nombre}:</span> {it.valores.r1?.trim() || 'sin responder'} — {c.partes[0]?.mensaje}</p>
              <p><span class="rot">Correcto:</span> {textoCorrecto(esp)}</p>
              <div class="desarrollo">
                <p><span class="rot">Con estos valores:</span> {@html desp ? `${sim(vr.item.objetivo)} = ${exprLinea(desp, sim)}` : ''}; {@html f.vars
                    .filter((x) => x.id !== vr.item.objetivo && vr.v.valores[x.id] != null)
                    .map((x) => `${x.sim} = ${valorTexto(vr.v.valores[x.id]!, x.unidad)}`)
                    .join(', ')} → {@html esp.nombre} = {textoCorrecto(esp)}.</p>
              </div>
            {:else if it.vv}
              <!-- (review 10h: a variant whose practice content is gone: what the result stored) -->
              <p class="enunciado" data-enunciado-variante>{@html prepararHtml(it.vv.enunciado)}</p>
              <p><span class="rot">{@html it.vv.esperado.nombre}:</span> {it.valores.r1?.trim() || 'sin responder'} — {c.partes[0]?.mensaje}</p>
              <p><span class="rot">Correcto:</span> {textoCorrecto(it.vv.esperado)}</p>
            {:else}
              {#each e.respuestas as x (x.id)}
                {@const parte = c.partes.find((q) => q.id === x.id)}
                <p><span class="rot">{@html prepararHtml(x.nombre)}:</span> {it.valores[x.id]?.trim() || 'sin responder'} — {parte?.mensaje} <span class="correcto">(correcto: {x.texto})</span></p>
              {/each}
              {#each e.preguntas ?? [] as q0, k (q0.id)}
                {@const q = preguntaVista(q0, it.opciones?.[q0.id])}
                {@const parte = c.partes.find((x) => x.id === q0.id)}
                <div class="preg">
                  <p class="enunciado-preg">{String.fromCharCode(97 + k)}) {@html prepararHtml(q.enunciado)}</p>
                  <p>{parte?.mensaje} <span class="correcto">Respuesta: {@html prepararHtml(respuestaCorrecta(q))}</span></p>
                  {#if q.explicacion}<p class="cita"><span class="rot">{q.calculo ? 'Desarrollo' : 'Del libro'}:</span> {@html prepararHtml(q.explicacion)}</p>{/if}
                </div>
              {/each}
              {#if c.partes.some((x) => x.tipo === 'abierta')}
                {#if it.valores.texto?.trim()}
                  <div class="escrita"><span class="rot">Lo que escribió:</span><p>{it.valores.texto}</p></div>
                {/if}
                {#if e.otras?.length}
                  <p class="rot">Lo que se pide:</p>
                  <ul class="pide">{#each e.otras as o, k (k)}<li>{@html prepararHtml(o.texto)}</li>{/each}</ul>
                {/if}
                <fieldset class="autoeval" data-autoeval={i + 1}>
                  <legend>Compárelo con el desarrollo del libro: ¿lo tenía bien?</legend>
                  {#each [{ v: 1, t: 'Bien' }, { v: 0.5, t: 'A medias' }, { v: 0, t: 'Mal' }] as op (op.v)}
                    <button type="button" class="t09-chip" aria-pressed={it.autoeval === op.v} disabled={guardando} onclick={() => void autoevaluar(i, op.v)} data-autoeval-valor={op.v}>{op.t}</button>
                  {/each}
                </fieldset>
              {/if}
            {/if}
            {#if bl?.solucion.length}
              <details class="desarrollo-libro" open>
                <summary>{vr ? 'Desarrollo del libro (con los valores del enunciado original)' : e.tipo === 'prob' ? 'Análisis y resultado del libro' : `Solución ${e.num} del libro`}</summary>
                <div class="texto-libro"><Bloques bloques={bl.solucion} parte={e.parte} /></div>
              </details>
            {/if}
          {/if}
        </li>
      {/each}
    </ol>
  {/if}
</div>

<style>
  .resultado {
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-width: 820px;
    margin: 0 auto;
    padding: 24px 32px 64px;
    font-family: var(--sans);
  }
  @media (max-width: 600px) {
    .resultado {
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
    font-size: 26px;
  }
  .nota {
    margin: 6px 0 0;
    color: var(--tinta);
    font-size: 18px;
  }
  .nota strong {
    color: var(--titulos);
    font-size: 32px;
  }
  .meta,
  .cargando {
    margin: 4px 0 0;
    color: var(--tinta-suave);
    font-size: 14px;
  }
  .pendiente {
    margin: 8px 0 0;
    color: var(--tinta);
  }
  .items {
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .item {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .item p {
    margin: 0;
    color: var(--tinta);
    line-height: 1.5;
  }
  h2 {
    margin: 0;
    color: var(--titulos);
    font-size: 16px;
  }
  .num {
    color: var(--acento);
  }
  .calif {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 700;
  }
  /* the state is always written; the ring's colour only repeats it (the text keeps the body's contrast) */
  .sello {
    padding: 2px 10px;
    border: 2px solid var(--linea);
    border-radius: 999px;
    color: var(--tinta);
    font-size: 13.5px;
  }
  .calif.bien .sello {
    border-color: var(--c-ejemplo);
  }
  .calif.mal .sello,
  .calif.blanco .sello {
    border-color: var(--c-importante);
  }
  .calif.parcial .sello,
  .calif.pendiente .sello {
    border-color: var(--ambar);
  }
  .enunciado {
    font-family: var(--serif);
    font-size: 16.5px;
  }
  .rot {
    color: var(--tinta-suave);
    font-weight: 700;
  }
  .correcto {
    color: var(--tinta-suave);
  }
  .desarrollo,
  .escrita {
    padding: 8px 12px;
    border-left: 3px solid var(--acento-borde);
    background: var(--acento-tinte);
  }
  .escrita p {
    white-space: pre-wrap;
  }
  .cita {
    font-style: italic;
  }
  .pide {
    margin: 0;
    padding-left: 1.4em;
    color: var(--tinta);
  }
  .autoeval {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 4px 0 0;
    padding: 0;
    border: 0;
  }
  .autoeval legend {
    margin-bottom: 4px;
    color: var(--tinta);
    font-weight: 600;
  }
  .t09-chip {
    min-height: 44px;
  }
  .desarrollo-libro summary {
    display: flex;
    align-items: center;
    min-height: 44px;
    color: var(--titulos);
    font-weight: 700;
    cursor: pointer;
  }
  .texto-libro {
    font-size: 0.95em;
  }
  .aviso {
    padding: 12px 14px;
    border: 1px solid var(--linea);
    border-radius: 12px;
  }
</style>
