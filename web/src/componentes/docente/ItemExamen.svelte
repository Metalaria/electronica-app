<script lang="ts">
  // One item of an own exam while it is taken: the statement (the book's, or the exercise's own text with this
  // variant's values) and the answer fields — no hints, no checking, no solution until the exam is handed in.
  // The answers use the same keys as an exercise's panel (r1…, p1…, texto) and `r` for a test question.
  import { prepararHtml } from '../../lib/datos';
  import { libro } from '../../lib/docente/fuentes';
  import { esperadoVariante, preguntaVista, varianteDe, type ItemMontado } from '../../lib/docente/examen';
  import { enunciadoDe, textoPide } from '../practica/variantes';
  import Bloques from '../Bloques.svelte';
  import PreguntaEjercicio from '../aprender/PreguntaEjercicio.svelte';

  let {
    m,
    valores,
    alCambiar,
  }: {
    m: ItemMontado;
    valores: Record<string, string>;
    alCambiar: (clave: string, valor: string) => void;
  } = $props();

  const LETRAS = 'ABCDE';
  const idBase = $derived(`ex-${m.n}`);
  const pregunta = $derived(m.k === 'pregunta' ? libro.pregunta(m.ref) : undefined);
  const ejercicio = $derived(m.k === 'ejercicio' ? libro.ejercicio(m.ref) : undefined);
  const bloques = $derived(m.k === 'ejercicio' ? libro.bloques(m.ref) : undefined);
  const vr = $derived(varianteDe(m, libro));
  const esp = $derived(vr ? esperadoVariante(vr.item, vr.v) : null);
  const abierta = $derived(!vr && !!ejercicio && (ejercicio.modo === 'comparar' || (ejercicio.otras?.length ?? 0) > 0));
</script>

<div class="item-examen" data-item-examen={m.n} data-ref={m.ref}>
  {#if pregunta}
    {#if pregunta.tipo === 'opcion'}
      {@const orden = m.orden ?? pregunta.opciones.map((_, k) => k)}
      <fieldset>
        <legend class="enunciado">{@html prepararHtml(pregunta.enunciado)}</legend>
        <div class="opciones">
          {#each orden as k, i (k)}
            <label class="opcion" class:elegida={valores.r === String(i)}>
              <input type="radio" name={`${idBase}-r`} value={String(i)} checked={valores.r === String(i)} onchange={() => alCambiar('r', String(i))} />
              <span class="letra" aria-hidden="true">{LETRAS[i]}</span>
              <span class="txt">{@html prepararHtml(pregunta.opciones[k]!)}</span>
            </label>
          {/each}
        </div>
      </fieldset>
    {:else}
      <p class="enunciado">{@html prepararHtml(pregunta.enunciado)}</p>
      <label class="campo">
        <span class="nombre">Respuesta</span>
        <span class="caja-entrada">
          <input type="text" inputmode="decimal" autocomplete="off" spellcheck="false" value={valores.r ?? ''} oninput={(ev) => alCambiar('r', (ev.currentTarget as HTMLInputElement).value)} data-campo="r" />
          {#if pregunta.unidad}<span class="unidad">{pregunta.unidad}</span>{/if}
        </span>
      </label>
    {/if}
  {:else if ejercicio}
    {#if vr && esp}
      <p class="enunciado texto-libro" data-variante>{@html prepararHtml(enunciadoDe(vr.item, vr.v))}</p>
      <!-- final QA 1.0: the field says what is asked (the same text as the practice), and «solo» when the book asks more -->
      <p class="pide" data-pide>{textoPide(vr.item)} <strong>{@html prepararHtml(esp.nombre)}</strong></p>
      <div class="campos">
        <label class="campo">
          <span class="nombre">{@html prepararHtml(esp.nombre)}</span>
          <span class="caja-entrada">
            <input type="text" autocomplete="off" spellcheck="false" value={valores.r1 ?? ''} oninput={(ev) => alCambiar('r1', (ev.currentTarget as HTMLInputElement).value)} data-campo="r1" />
            {#if esp.unidad}<span class="unidad">{esp.unidad}</span>{/if}
          </span>
        </label>
      </div>
    {:else}
      {#if bloques}<div class="texto-libro enunciado"><Bloques bloques={bloques.enunciado} parte={ejercicio.parte} /></div>{/if}
      {#if ejercicio.respuestas.length}
        <div class="campos">
          {#each ejercicio.respuestas as r (r.id)}
            <label class="campo">
              <span class="nombre">{@html prepararHtml(r.nombre)}</span>
              <span class="caja-entrada">
                <input type="text" autocomplete="off" spellcheck="false" value={valores[r.id] ?? ''} oninput={(ev) => alCambiar(r.id, (ev.currentTarget as HTMLInputElement).value)} data-campo={r.id} />
                {#if r.unidad}<span class="unidad">{r.unidad}</span>{/if}
              </span>
            </label>
          {/each}
        </div>
      {/if}
      {#each ejercicio.preguntas ?? [] as p (p.id)}
        <PreguntaEjercicio p={preguntaVista(p, m.opciones?.[p.id])} valor={valores[p.id] ?? ''} idBase={`${idBase}-${p.id}`} alCambiar={(v) => alCambiar(p.id, v)} />
      {/each}
      {#if abierta}
        <label class="campo abierta">
          <span class="nombre">Su respuesta <span class="nota">(se compara al terminar con el desarrollo del libro)</span></span>
          <textarea rows="5" maxlength="4000" value={valores.texto ?? ''} oninput={(ev) => alCambiar('texto', (ev.currentTarget as HTMLTextAreaElement).value)} data-campo="texto"></textarea>
        </label>
      {/if}
    {/if}
  {:else}
    <p class="falta">Este elemento ya no está en el libro.</p>
  {/if}
</div>

<style>
  .item-examen {
    display: flex;
    flex-direction: column;
    gap: 12px;
    font-family: var(--sans);
  }
  .pide {
    margin: 0;
    color: var(--tinta);
    font-size: 16px;
  }
  .enunciado {
    margin: 0;
    color: var(--tinta);
    font-family: var(--serif);
    font-size: 17px;
    line-height: 1.5;
  }
  fieldset {
    margin: 0;
    padding: 0;
    border: 0;
  }
  legend {
    margin-bottom: 10px;
    padding: 0;
  }
  .opciones {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .opcion {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 48px;
    padding: 8px 12px;
    border: 1.5px solid var(--linea);
    border-radius: 12px;
    background: var(--superficie);
    color: var(--tinta);
    cursor: pointer;
  }
  .opcion.elegida {
    border-color: var(--acento);
    background: var(--acento-tinte);
  }
  .opcion input {
    width: 20px;
    height: 20px;
    accent-color: var(--acento);
  }
  .letra {
    color: var(--tinta-suave);
    font-weight: 700;
  }
  .campos {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .campo {
    display: flex;
    flex-direction: column;
    gap: 4px;
    color: var(--tinta);
    font-size: 15px;
  }
  .nombre {
    font-weight: 600;
  }
  .nota {
    color: var(--tinta-suave);
    font-weight: 400;
  }
  .caja-entrada {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .caja-entrada input {
    width: min(16em, 100%);
    min-height: 44px;
    padding: 0 10px;
    border: 1.5px solid var(--linea);
    border-radius: 10px;
    background: var(--fondo);
    color: var(--tinta);
    font: inherit;
  }
  .unidad {
    color: var(--tinta-suave);
  }
  textarea {
    min-height: 120px;
    padding: 8px 10px;
    border: 1.5px solid var(--linea);
    border-radius: 10px;
    background: var(--fondo);
    color: var(--tinta);
    font: inherit;
    resize: vertical;
  }
  .falta {
    color: var(--tinta-suave);
  }
</style>
