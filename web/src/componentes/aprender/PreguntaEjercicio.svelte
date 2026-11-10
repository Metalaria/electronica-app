<script lang="ts">
  // 1.0: one structured question of an exercise (choice, order, classification, short exact answer, boolean
  // expression, pair of standard resistors) inside the answer panel (Comprobador). The answer is a string kept by the
  // panel with the numeric fields (EstadoEjercicio.valores); once the question is settled (right, after two failed
  // checks, or with the solution open) it shows the right answer and its development quoted from the book.
  import {
    escribirCombinacion,
    escribirLista,
    leerCombinacion,
    leerLista,
    respuestaCorrecta,
    type Pregunta,
    type VeredictoPregunta,
  } from '../../lib/preguntas-ejercicio';
  import type { Porque } from '../pregunta/porque';
  import PorQueNo from '../pregunta/PorQueNo.svelte';
  import CamposDiseno from './CamposDiseno.svelte';

  let {
    p,
    valor = '',
    veredicto,
    resuelta = false,
    idBase,
    alCambiar,
    porque = null,
    parte = '',
    simulando = false,
  }: {
    p: Pregunta;
    /** The stored answer (the panel owns it: alCambiar gives the new one). */
    valor?: string;
    veredicto?: VeredictoPregunta;
    /** Show the right answer and the development. */
    resuelta?: boolean;
    idBase: string;
    alCambiar: (valor: string) => void;
    /** 1.0: the book's passage for each wrong option of a choice question (option index → explanation). */
    porque?: Record<string, Porque> | null;
    /** The exercise's part (links of the passages). */
    parte?: string;
    /** 1.1: a design question whose circuit is being simulated right now. */
    simulando?: boolean;
  } = $props();

  const id = $derived(`${idBase}-${p.id}`);
  const plano = (h: string) => h.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  const ICONO: Record<string, string> = { bien: '✓', cerca: '≈', mal: '✗', ilegible: '?' };

  function poner(v: string) {
    alCambiar(v);
  }

  // ---------------------------------------------------------------- order
  const orden = $derived.by(() => {
    if (p.tipo !== 'orden') return [];
    const l = leerLista(valor, p.elementos.length);
    const ok = new Set(l).size === l.length && l.every((x) => x >= 0 && x < l.length);
    return ok && valor ? l : p.mezcla;
  });
  function mover(i: number, d: number) {
    const l = [...orden];
    const j = i + d;
    if (j < 0 || j >= l.length) return;
    [l[i], l[j]] = [l[j]!, l[i]!];
    poner(escribirLista(l));
    // keep the focus on the moved element's same button so it can be moved again with the keyboard
    queueMicrotask(() => document.getElementById(`${id}-m${j}-${d < 0 ? 'sube' : 'baja'}`)?.focus());
  }

  // ---------------------------------------------------------------- classification
  const clases = $derived(p.tipo === 'clasificar' ? leerLista(valor, p.elementos.length) : []);
  const chips = $derived(p.tipo === 'clasificar' && p.categorias.reduce((n, c) => n + plano(c).length, 0) <= 44);
  function clasificar(i: number, c: number) {
    const l = [...clases];
    l[i] = c;
    poner(escribirLista(l));
  }

  // ---------------------------------------------------------------- combination
  const comb = $derived(leerCombinacion(valor));
  function combinar(campo: 'a' | 'b' | 'modo', v: string) {
    const c = { ...comb, [campo]: v };
    poner(escribirCombinacion(c.a, c.b, c.modo));
  }

  const marcado = $derived(veredicto && veredicto.tipo !== 'vacio' ? veredicto : null);
</script>

<div class="preg" data-p={p.id} data-tipo={p.tipo} class:bien={marcado?.tipo === 'bien'}>
  {#if p.tipo === 'eleccion'}
    <fieldset aria-describedby={marcado ? `${id}-fb` : undefined}>
      <legend>{@html p.enunciado}</legend>
      <div class="opciones">
        {#each p.opciones as o, k (k)}
          {@const correcta = resuelta && k === p.correcta}
          <label class="opcion" class:elegida={valor === String(k)} class:correcta>
            <input type="radio" name={id} value={String(k)} checked={valor === String(k)} onchange={() => poner(String(k))} />
            <span class="txt">{@html o}</span>
            {#if correcta}<span class="sello">✓ Correcta</span>{/if}
          </label>
        {/each}
      </div>
    </fieldset>
  {:else if p.tipo === 'orden'}
    <fieldset aria-describedby={marcado ? `${id}-fb` : undefined}>
      <legend>{@html p.enunciado}</legend>
      <ol class="orden" aria-label="Su orden">
        {#each orden as k, i (k)}
          <li data-elemento={k}>
            <span class="num" aria-hidden="true">{i + 1}</span>
            <span class="txt">{@html p.elementos[k]}</span>
            <span class="mover">
              <button type="button" id={`${id}-m${i}-sube`} class="flecha" aria-label={`Subir «${plano(p.elementos[k] ?? '')}»`} disabled={i === 0} onclick={() => mover(i, -1)}>↑</button>
              <button type="button" id={`${id}-m${i}-baja`} class="flecha" aria-label={`Bajar «${plano(p.elementos[k] ?? '')}»`} disabled={i === orden.length - 1} onclick={() => mover(i, 1)}>↓</button>
            </span>
          </li>
        {/each}
      </ol>
    </fieldset>
  {:else if p.tipo === 'clasificar'}
    <fieldset class="clasificar" aria-describedby={marcado ? `${id}-fb` : undefined}>
      <legend>{@html p.enunciado}</legend>
      {#each p.elementos as e, i (i)}
        {@const ok = resuelta ? e.cat : -1}
        <div class="fila" data-elemento={i}>
          {#if chips}
            <div class="chips" role="radiogroup" aria-labelledby={`${id}-e${i}`}>
              <span class="el" id={`${id}-e${i}`}>{@html e.texto}</span>
              <span class="cats">
                {#each p.categorias as c, k (k)}
                  <label class="chip" class:elegida={clases[i] === k} class:correcta={ok === k}>
                    <input type="radio" name={`${id}-e${i}`} value={String(k)} checked={clases[i] === k} onchange={() => clasificar(i, k)} />
                    <span>{@html c}</span>
                  </label>
                {/each}
              </span>
            </div>
          {:else}
            <label class="el" for={`${id}-s${i}`}>{@html e.texto}</label>
            <select id={`${id}-s${i}`} value={clases[i] != null && clases[i]! >= 0 ? String(clases[i]) : ''} onchange={(ev) => clasificar(i, Number((ev.currentTarget as HTMLSelectElement).value))}>
              <option value="" disabled>Elija…</option>
              {#each p.categorias as c, k (k)}<option value={String(k)}>{plano(c)}</option>{/each}
            </select>
            {#if ok >= 0}<span class="sello sol">✓ {@html p.categorias[ok]}</span>{/if}
          {/if}
        </div>
      {/each}
    </fieldset>
  {:else if p.tipo === 'exacta' || p.tipo === 'logica'}
    <div class="texto">
      <label class="nombre" for={id}>{@html p.enunciado}</label>
      <input
        {id}
        type="text"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        enterkeyhint="done"
        placeholder={p.tipo === 'logica' ? 'p. ej. A·B + C\'' : 'su respuesta'}
        aria-describedby={marcado ? `${id}-fb` : undefined}
        aria-invalid={marcado?.tipo === 'mal' ? 'true' : undefined}
        value={valor}
        oninput={(ev) => poner((ev.currentTarget as HTMLInputElement).value)}
      />
    </div>
  {:else if p.tipo === 'diseno'}
    <CamposDiseno {p} {valor} {id} descrito={marcado ? `${id}-fb` : undefined} alCambiar={poner} {simulando} />
  {:else if p.tipo === 'combinacion'}
    <fieldset aria-describedby={marcado ? `${id}-fb` : undefined}>
      <legend>{@html p.enunciado}</legend>
      <div class="comb">
        {#each ['a', 'b'] as const as campo, k (campo)}
          <span class="campo-r">
            <label for={`${id}-${campo}`}>R<sub>{k + 1}</sub></label>
            <span class="entrada">
              <input
                id={`${id}-${campo}`}
                type="text"
                autocomplete="off"
                autocapitalize="off"
                spellcheck="false"
                placeholder="p. ej. 6,8 k"
                value={comb[campo]}
                oninput={(ev) => combinar(campo, (ev.currentTarget as HTMLInputElement).value)}
              />
              <span class="u" aria-hidden="true">Ω</span>
            </span>
          </span>
        {/each}
        <span class="cats" role="radiogroup" aria-label="Conexión">
          {#each [['serie', 'En serie'], ['paralelo', 'En paralelo']] as [m, t] (m)}
            <label class="chip" class:elegida={comb.modo === m}>
              <input type="radio" name={`${id}-modo`} value={m} checked={comb.modo === m} onchange={() => combinar('modo', m!)} />
              <span>{t}</span>
            </label>
          {/each}
        </span>
      </div>
    </fieldset>
  {/if}

  {#if marcado}
    <p class="fb fb-{marcado.tipo}" id={`${id}-fb`} aria-live="polite">
      <span class="ic" aria-hidden="true">{ICONO[marcado.tipo]}</span>
      <span>{marcado.mensaje}</span>
    </p>
    {#if marcado.tipo === 'mal' && p.tipo === 'eleccion' && /^\d+$/.test(valor) && Number(valor) !== p.correcta}
      <!-- 1.1: a new exercise, or a book one turned into choices («razonar»), explains each wrong option in its own words (p.porque); the other book ones come from libro/porque/ -->
      <PorQueNo opcion={p.opciones[Number(valor)] ?? ''} porque={porque?.[valor] ?? null} {parte} extra={p.porque?.[valor] ?? ''} />
    {/if}
  {/if}
  {#if resuelta}
    <div class="desarrollo">
      {#if marcado?.tipo !== 'bien'}
        <p><strong>Respuesta:</strong> {@html respuestaCorrecta(p)}</p>
      {/if}
      {#if p.explicacion}
        <p><span class="de">{p.calculo ? 'Desarrollo' : 'Del libro'}</span> {@html p.explicacion}</p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .preg {
    display: grid;
    gap: 6px;
  }
  fieldset {
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }
  legend,
  .nombre {
    margin-bottom: 6px;
    padding: 0;
    color: var(--tinta);
    font-weight: 600;
  }
  .opciones {
    display: grid;
    gap: 6px;
  }
  .opcion,
  .orden li {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    padding: 6px 12px;
    border: 1px solid var(--linea);
    border-radius: 8px;
    background: var(--fondo);
    cursor: pointer;
  }
  .opcion input,
  .chip input {
    flex: none;
    width: 18px;
    height: 18px;
    margin: 0;
    accent-color: var(--acento);
  }
  .opcion:has(input:focus-visible),
  .chip:has(input:focus-visible) {
    outline: 2px solid var(--acento);
    outline-offset: 1px;
  }
  .opcion.elegida,
  .chip.elegida {
    border-color: var(--acento);
    background: var(--acento-tinte);
  }
  .opcion.correcta,
  .chip.correcta {
    border-color: var(--c-ejemplo);
  }
  .txt {
    flex: 1;
    min-width: 0;
  }
  .sello {
    flex: none;
    color: var(--tinta);
    font-size: 13.5px;
    font-weight: 700;
  }
  .orden {
    display: grid;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .orden li {
    cursor: default;
    padding-right: 4px;
  }
  .num {
    flex: none;
    min-width: 1.4em;
    color: var(--tinta-tenue);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .mover {
    display: flex;
    flex: none;
    gap: 2px;
  }
  .flecha {
    width: 44px;
    height: 44px;
    border: 1px solid var(--linea);
    border-radius: 8px;
    background: var(--superficie);
    color: var(--tinta);
    font-size: 18px;
  }
  .flecha:disabled {
    opacity: 0.4;
  }
  .flecha:focus-visible {
    outline: 2px solid var(--acento);
    outline-offset: 1px;
  }
  .clasificar {
    display: grid;
    gap: 8px;
  }
  .fila {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 4px 12px;
  }
  .chips {
    display: contents;
  }
  .cats {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    padding: 0 12px;
    border: 1px solid var(--linea);
    border-radius: 999px;
    background: var(--fondo);
    cursor: pointer;
  }
  select,
  input[type='text'] {
    width: 100%;
    min-height: 44px;
    padding: 0 12px;
    border: 1px solid var(--linea);
    border-radius: 8px;
    background: var(--fondo);
    color: var(--tinta);
    font-family: var(--sans);
    font-size: 16.5px;
  }
  select {
    min-width: 12em;
  }
  select:focus-visible,
  input[type='text']:focus-visible {
    outline: 2px solid var(--acento);
    outline-offset: 0;
    border-color: transparent;
  }
  input[aria-invalid='true'] {
    border-color: var(--c-precaucion);
  }
  .sol {
    grid-column: 1 / -1;
  }
  .texto {
    display: grid;
    gap: 2px;
  }
  .comb {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 14px;
  }
  .campo-r {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .campo-r label {
    font-weight: 600;
  }
  .entrada {
    position: relative;
    display: flex;
    align-items: center;
    width: 9.5em;
  }
  .entrada input {
    padding-right: 2.2em;
  }
  .u {
    position: absolute;
    right: 12px;
    color: var(--tinta-tenue);
    pointer-events: none;
  }
  .fb {
    display: flex;
    gap: 7px;
    margin: 0;
    padding: 8px 12px;
    border-radius: 10px;
    font-size: 14.5px;
  }
  .fb .ic {
    flex: none;
    font-weight: 700;
  }
  .fb-bien {
    background: var(--bien-tinte);
  }
  .fb-cerca {
    background: rgb(from var(--c-importante) r g b / 0.15);
  }
  .fb-mal,
  .fb-ilegible {
    background: var(--mal-tinte);
  }
  .desarrollo {
    padding: 8px 12px;
    border-radius: var(--radio-boton);
    background: var(--tarjeta-fondo);
    font-size: 15px;
  }
  .desarrollo p {
    margin: 0;
  }
  .desarrollo p + p {
    margin-top: 4px;
  }
  .de {
    margin-right: 4px;
    color: var(--c-tarjeta-texto);
    font-weight: 700;
  }
  @media (max-width: 520px) {
    .fila {
      grid-template-columns: 1fr;
    }
  }
</style>
