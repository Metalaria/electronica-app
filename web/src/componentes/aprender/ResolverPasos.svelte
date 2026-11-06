<script lang="ts">
  // 1.0 «Resolver paso a paso»: an exercise solved in small steps reviewed by hand (lib/pasos-guiados.ts). Each step is
  // a short question with its own check (a number with its unit and tolerance, as in the exercise's fields, or a
  // choice), an optional hint and, for a wrong option, «Por qué no». Once a step is right — or after two wrong checks —
  // it shows the book's sentence it comes from and the next step opens; the last one is the exercise's result. The
  // reader can leave at any moment. Nothing is stored (the panel counts a guided mode that was used as using the hints).
  import { onMount, tick } from 'svelte';
  import { comprobar, type Veredicto } from '../../lib/magnitudes';
  import type { PasoGuiado } from '../../lib/pasos-guiados';
  import PorQueNo from '../pregunta/PorQueNo.svelte';

  let {
    label,
    pasos,
    parte,
    alSalir,
    alUsar,
  }: {
    label: string;
    pasos: PasoGuiado[];
    parte: string;
    alSalir: () => void;
    /** Help seen so far, as the exercise's hints count it: 1 = the approach (a step checked or its hint), 2 = results. */
    alUsar: (n: number) => void;
  } = $props();

  type Estado = { valor: string; veredicto: Veredicto | null; fallos: number; pista: boolean; hecho: boolean; elegida: number };
  const nuevo = (): Estado => ({ valor: '', veredicto: null, fallos: 0, pista: false, hecho: false, elegida: -1 });
  let k = $state(0);
  let estados = $state<Estado[]>([nuevo()]);
  let titulo: HTMLElement | undefined = $state();

  const id = $derived(`pasos-${label.replace(/[^\w-]/g, '_')}`);
  const paso = $derived(pasos[k]);
  const e = $derived(estados[k]!);
  const terminado = $derived(k >= pasos.length);
  const ICONO: Record<string, string> = { bien: '✓', cerca: '≈', mal: '✗', unidad: '?', ilegible: '?' };

  function comprobarPaso(ev: SubmitEvent) {
    ev.preventDefault();
    if (!paso || e.hecho) return;
    if (paso.tipo === 'numerico') {
      const v = comprobar(e.valor, paso.respuesta, paso.alternativas);
      e.veredicto = v;
      if (v.tipo === 'bien') e.hecho = true;
      else if (v.tipo === 'cerca' || v.tipo === 'mal') e.fallos++;
    } else {
      if (e.elegida < 0) return;
      if (e.elegida === paso.correcta) e.hecho = true;
      else e.fallos++;
    }
    // counted as it happens: a checked step is the approach; a revealed answer is an intermediate result
    if (e.hecho || e.fallos > 0) alUsar(e.fallos >= 2 && !e.hecho ? 2 : 1);
  }

  function verPista() {
    e.pista = true;
    alUsar(1);
  }

  async function siguiente() {
    k++;
    // the result is reached: every intermediate result has been seen
    if (k >= pasos.length) alUsar(2);
    if (k < pasos.length && !estados[k]) estados.push(nuevo());
    await tick();
    titulo?.focus();
  }

  // the guided mode takes the focus when it opens (keyboard and screen-reader users land on its first step)
  onMount(() => titulo?.focus());

  const salir = () => alSalir();

  /** The step is settled: right, or two wrong checks (its answer is then shown). */
  const zanjado = $derived(e ? e.hecho || e.fallos >= 2 : false);
  const ultimo = $derived(pasos[pasos.length - 1]);
</script>

<section class="pasos" aria-labelledby={`${id}-tit`} data-pasos={label}>
  <header>
    <h4 id={`${id}-tit`} tabindex="-1" bind:this={titulo}>
      {#if terminado}Paso a paso · Hecho{:else}Paso a paso · Paso {k + 1} de {pasos.length}{/if}
    </h4>
    <button type="button" class="salir" onclick={salir}>Salir del paso a paso</button>
  </header>
  <ol class="barra" aria-hidden="true">
    {#each pasos as _, i (i)}<li class:hecho={i < k || terminado} class:actual={i === k && !terminado}></li>{/each}
  </ol>

  {#each pasos.slice(0, Math.min(k, pasos.length)) as p, i (i)}
    <div class="hecho-paso" data-paso={i + 1}>
      <span class="ok" aria-hidden="true">✓</span>
      <span>{@html p.pregunta} <strong>{@html p.tipo === 'numerico' ? `${p.nombre} = ${p.respuesta.texto}` : p.opciones[p.correcta]}</strong></span>
    </div>
  {/each}

  {#if !terminado && paso}
    <form class="paso" onsubmit={comprobarPaso} novalidate data-paso={k + 1}>
      {#if paso.tipo === 'numerico'}
        <label class="preg" for={`${id}-v`}>{@html paso.pregunta}</label>
        <span class="campo">
          <span class="nom" aria-hidden="true">{@html paso.nombre} =</span>
          <span class="entrada">
            <input
              id={`${id}-v`}
              type="text"
              autocomplete="off"
              autocapitalize="off"
              spellcheck="false"
              enterkeyhint="done"
              placeholder={paso.respuesta.unidad ? 'p. ej. 4,7 k' : 'valor'}
              disabled={zanjado}
              aria-describedby={e.veredicto && e.veredicto.tipo !== 'vacio' ? `${id}-fb` : undefined}
              bind:value={e.valor}
              oninput={() => (e.veredicto = null)}
            />
            {#if paso.respuesta.unidad}<span class="u" aria-hidden="true">{paso.respuesta.unidad}</span>{/if}
          </span>
        </span>
        {#if e.veredicto && e.veredicto.tipo !== 'vacio'}
          <p class="fb fb-{e.veredicto.tipo}" id={`${id}-fb`} aria-live="polite">
            <span class="ic" aria-hidden="true">{ICONO[e.veredicto.tipo]}</span>
            <span>{e.veredicto.tipo === 'bien' ? `Correcto: ${e.veredicto.texto}.` : e.veredicto.mensaje}</span>
          </p>
        {/if}
      {:else}
        <fieldset>
          <legend class="preg">{@html paso.pregunta}</legend>
          <div class="opciones">
            {#each paso.opciones as o, j (j)}
              <label class="opcion" class:elegida={e.elegida === j} class:correcta={zanjado && j === paso.correcta}>
                <input type="radio" name={`${id}-o${k}`} checked={e.elegida === j} disabled={zanjado} onchange={() => (e.elegida = j)} />
                <span>{@html o}</span>
              </label>
            {/each}
          </div>
        </fieldset>
        {#if e.fallos > 0 || e.hecho}
          <p class="fb {e.hecho ? 'fb-bien' : 'fb-mal'}" aria-live="polite">
            <span class="ic" aria-hidden="true">{e.hecho ? '✓' : '✗'}</span>
            <span>{e.hecho ? 'Correcto.' : 'No es esa.'}</span>
          </p>
          {#if !e.hecho && e.elegida >= 0 && e.elegida !== paso.correcta && paso.porque[String(e.elegida)]}
            <PorQueNo opcion={paso.opciones[e.elegida] ?? ''} {parte} extra={paso.porque[String(e.elegida)]} />
          {/if}
        {/if}
      {/if}

      {#if e.pista && paso.pista}
        <p class="pista"><span class="pn">Pista</span> {@html paso.pista}</p>
      {/if}

      {#if zanjado}
        <div class="desarrollo">
          {#if !e.hecho}
            <p><strong>Respuesta:</strong> {@html paso.tipo === 'numerico' ? `${paso.nombre} = ${paso.respuesta.texto}` : paso.opciones[paso.correcta]}</p>
          {/if}
          <p><span class="de">Del libro</span> {@html paso.explicacion}</p>
        </div>
        <div class="acciones">
          <button type="button" class="boton primario" onclick={siguiente}>{k + 1 < pasos.length ? 'Siguiente paso' : 'Ver el resultado'}</button>
        </div>
      {:else}
        <div class="acciones">
          <button type="submit" class="boton primario">Comprobar el paso</button>
          {#if paso.pista && !e.pista}
            <button type="button" class="boton" onclick={verPista}>Pista</button>
          {/if}
        </div>
      {/if}
    </form>
  {:else if terminado && ultimo}
    <div class="final" aria-live="polite">
      <p>
        Ha llegado al resultado:
        <strong>{@html ultimo.tipo === 'numerico' ? `${ultimo.nombre} = ${ultimo.respuesta.texto}` : ultimo.opciones[ultimo.correcta]}</strong>.
        Escriba ahora las respuestas del ejercicio y compruébelas.
      </p>
      <button type="button" class="boton primario" onclick={salir}>Volver al ejercicio</button>
    </div>
  {/if}
</section>

<style>
  .pasos {
    display: grid;
    gap: 10px;
    margin-top: 12px;
    padding: 12px 14px;
    border: 1px solid var(--linea);
    border-left: 3px solid var(--acento);
    border-radius: 8px;
    background: var(--fondo);
  }
  header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 6px 12px;
  }
  h4 {
    margin: 0;
    color: var(--acento);
    font-size: 13.5px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  h4:focus {
    outline: none;
  }
  h4:focus-visible {
    outline: 2px solid var(--acento);
    outline-offset: 2px;
  }
  .salir {
    min-height: 44px;
    padding: 0 10px;
    border: 0;
    border-radius: 6px;
    background: none;
    color: var(--tinta-suave);
    font-size: 14px;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .salir:hover {
    color: var(--tinta);
  }
  .barra {
    display: flex;
    gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .barra li {
    flex: 1;
    height: 5px;
    border-radius: 3px;
    background: var(--linea);
  }
  .barra li.hecho {
    background: var(--c-ejemplo);
  }
  .barra li.actual {
    background: var(--acento);
  }
  .hecho-paso {
    display: flex;
    gap: 8px;
    color: var(--tinta-suave);
    font-size: 14.5px;
  }
  .hecho-paso .ok {
    color: var(--tinta);
    font-weight: 700;
  }
  .paso {
    display: grid;
    gap: 8px;
  }
  fieldset {
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }
  .preg {
    margin-bottom: 4px;
    padding: 0;
    color: var(--tinta);
    font-weight: 600;
  }
  .campo {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 10px;
  }
  .nom {
    color: var(--tinta);
  }
  .entrada {
    position: relative;
    display: flex;
    align-items: center;
    width: min(100%, 13em);
  }
  input[type='text'] {
    width: 100%;
    min-height: 44px;
    padding: 0 3.2em 0 12px;
    border: 1px solid var(--linea);
    border-radius: 8px;
    background: var(--superficie);
    color: var(--tinta);
    font-family: var(--sans);
    font-size: 16.5px;
  }
  input[type='text']:focus-visible {
    outline: 2px solid var(--acento);
    outline-offset: 0;
    border-color: transparent;
  }
  .u {
    position: absolute;
    right: 12px;
    color: var(--tinta-tenue);
    pointer-events: none;
  }
  .opciones {
    display: grid;
    gap: 6px;
  }
  .opcion {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    padding: 6px 12px;
    border: 1px solid var(--linea);
    border-radius: 8px;
    background: var(--superficie);
    cursor: pointer;
  }
  .opcion input {
    flex: none;
    width: 18px;
    height: 18px;
    margin: 0;
    accent-color: var(--acento);
  }
  .opcion:has(input:focus-visible) {
    outline: 2px solid var(--acento);
    outline-offset: 1px;
  }
  .opcion.elegida {
    border-color: var(--acento);
    background: var(--acento-tinte);
  }
  .opcion.correcta {
    border-color: var(--c-ejemplo);
  }
  .fb {
    display: flex;
    gap: 7px;
    margin: 0;
    padding: 6px 10px;
    border-radius: 7px;
    font-size: 14.5px;
  }
  .fb .ic {
    flex: none;
    font-weight: 700;
  }
  .fb-bien {
    background: rgb(from var(--c-ejemplo) r g b / 0.13);
  }
  .fb-cerca {
    background: rgb(from var(--c-importante) r g b / 0.15);
  }
  .fb-mal,
  .fb-unidad,
  .fb-ilegible {
    background: rgb(from var(--c-precaucion) r g b / 0.11);
  }
  .pista,
  .desarrollo {
    margin: 0;
    padding: 8px 12px;
    border-left: 3px solid var(--c-tarjeta);
    border-radius: 3px 8px 8px 3px;
    background: var(--tarjeta-fondo);
    font-size: 15px;
  }
  .desarrollo p {
    margin: 0;
  }
  .desarrollo p + p {
    margin-top: 4px;
  }
  .pn,
  .de {
    margin-right: 4px;
    color: var(--c-tarjeta-texto);
    font-weight: 700;
  }
  .acciones {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .acciones :global(.boton),
  .final :global(.boton) {
    min-height: 44px;
  }
  .final {
    display: grid;
    gap: 8px;
    justify-items: start;
  }
  .final p {
    margin: 0;
  }
  @media (prefers-reduced-motion: no-preference) {
    .barra li {
      transition: background-color 0.2s;
    }
  }
</style>
