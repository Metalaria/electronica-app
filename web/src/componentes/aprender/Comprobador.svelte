<script lang="ts">
  // Answer panel of one exercise or problem: a field per requested quantity (SI prefixes, units, decimal
  // comma), «Comprobar» with per-field feedback, progressive hints, «Ver solución», and the attempt
  // state saved on the device. 1.0: also the structured questions (PreguntaEjercicio: choice, order, classification…),
  // each settled with its development quoted from the book; and, for what cannot be checked automatically, a
  // self-assessment: the reader writes the answer, opens the solution with the list of what is asked, and rates it.
  import type { ItemEjercicio } from '../../lib/ejercicios.svelte';
  import { NOMBRE_CLASE } from '../../lib/ejercicios.svelte';
  import { onDestroy } from 'svelte';
  import { comprobar, type Veredicto } from '../../lib/magnitudes';
  import { comprobarPregunta, legible, type VeredictoPregunta } from '../../lib/preguntas-ejercicio';
  import {
    aprendizaje,
    autoevaluar,
    ayudaAlResolver,
    estadoEjercicio,
    guardarRespuestaEscrita,
    MAX_TEXTO_EJERCICIO,
    registrarIntento,
    volcarEjercicios,
    reiniciarEjercicio,
    usarPista,
    verSolucion,
    valorComprobado,
  } from '../../lib/aprendizaje.svelte';
  import Icono from '../Icono.svelte';
  import OtrosValores from '../practica/OtrosValores.svelte';
  import PreguntaEjercicio from './PreguntaEjercicio.svelte';
  import { cargarPorque, type PorqueParte } from '../pregunta/porque';
  import Seguridad from '../pregunta/Seguridad.svelte';
  import { cargarPasos, type PasoGuiado } from '../../lib/pasos-guiados';
  import ResolverPasos from './ResolverPasos.svelte';
  import { faltaSimular, simularDiseno } from '../../lib/diseno-ejercicio';
  import { prepararSalto } from '../../lib/ruta.svelte';

  let {
    label,
    item,
    solucionVisible = false,
    alVerSolucion,
    sinSolucion = false,
    pasoAPaso = true,
  }: {
    label: string;
    item: ItemEjercicio;
    solucionVisible?: boolean;
    /** Shows (or hides) the book's solution. */
    alVerSolucion?: (ver: boolean) => void;
    sinSolucion?: boolean;
    /** 1.0: offer «Resolver paso a paso» when the exercise has reviewed guided steps (never in an exam). */
    pasoAPaso?: boolean;
  } = $props();

  const estado = $derived(aprendizaje.ejercicios[label]);
  // 1.0 «¿Qué seguridad tiene?»: offered when the exercise gets solved by a check during this visit
  let resueltoAntes: boolean | null = null;
  const recienResuelto = $derived.by(() => {
    const r = !!estado?.resuelto;
    if (resueltoAntes === null) resueltoAntes = r;
    return r && !resueltoAntes && !estado?.solucion;
  });
  const preguntas = $derived(item.preguntas ?? []);
  // 1.0: the book's passage for each wrong option of the choice questions (loaded only when there are some)
  let porques = $state<PorqueParte | null>(null);
  $effect(() => {
    const parte = item.parte;
    if (!preguntas.some((q) => q.tipo === 'eleccion')) return;
    let vivo = true;
    void cargarPorque(parte).then((d) => {
      if (vivo) porques = d;
    });
    return () => {
      vivo = false;
    };
  });
  const auto = $derived(item.modo === 'auto' && (item.respuestas.length > 0 || preguntas.length > 0));

  // 1.0 «Resolver paso a paso»: the reviewed guided steps of this exercise, if it has them
  let pasos = $state<PasoGuiado[] | null>(null);
  let guiado = $state(false);
  let botonPasos: HTMLButtonElement | undefined = $state();
  $effect(() => {
    const l = label;
    pasos = null;
    guiado = false;
    if (!pasoAPaso || !auto) return;
    let vivo = true;
    void cargarPasos().then((d) => {
      if (vivo) pasos = d?.items[l]?.pasos ?? null;
    });
    return () => {
      vivo = false;
    };
  });
  function entrarPasos() {
    guiado = true;
  }
  /**
   * The guided mode is help, counted as it is used (review 10e: counting it on leaving missed a check made with the
   * panel open and a reader who just navigated away): n = 1 once a step is checked or its hint seen (the approach),
   * 2 once a step's answer is revealed or the result reached (the intermediate results). The exercise's own hints stay
   * hidden while the guided panel is open, and show afterwards only as far as was counted.
   */
  function usarPasos(n: number) {
    if (item.pistas.length) usarPista(label, Math.min(n, item.pistas.length));
  }
  function salirPasos() {
    guiado = false;
    queueMicrotask(() => botonPasos?.focus());
  }

  let valores = $state<Record<string, string>>({});
  let veredictos = $state<Record<string, Veredicto>>({});
  let vPreguntas = $state<Record<string, VeredictoPregunta>>({});
  /** 1.0: the reader's written answer to what is not checked automatically, and the checklist marks. */
  let texto = $state('');
  let marcas = $state<Record<string, boolean>>({});
  /**
   * 1.1 («razonar»): a written answer saved while this exercise was self-assessed, kept on show (and editable) after it
   * became fully self-checked with no open part left, so it is never hidden from its owner.
   */
  let textoPrevio = $state(false);
  let iniciado = '';

  // Restore the last values typed (once per item).
  $effect(() => {
    if (iniciado === label || !aprendizaje.listo) return;
    iniciado = label;
    const e = aprendizaje.ejercicios[label];
    const guardados = e?.valores ?? {};
    valores = {};
    for (const r of item.respuestas) if (guardados[r.id] != null) valores[r.id] = guardados[r.id]!;
    for (const q of item.preguntas ?? []) if (guardados[q.id] != null) valores[q.id] = guardados[q.id]!;
    texto = guardados.texto ?? '';
    textoPrevio = !item.otras?.length && texto.trim() !== '';
    marcas = {};
    (item.otras ?? []).forEach((_, k) => (marcas[`c${k + 1}`] = guardados[`c${k + 1}`] === '1'));
    veredictos = {};
    vPreguntas = {};
    // the verdict of what the last «Comprobar» checked; a draft typed after it comes back without one
    for (const r of item.respuestas) {
      const v = guardados[r.id];
      if (v && valorComprobado(e, r.id)) veredictos[r.id] = comprobar(v, r, r.alternativas);
    }
    for (const q of item.preguntas ?? []) {
      const v = guardados[q.id];
      if (v && valorComprobado(e, q.id)) vPreguntas[q.id] = comprobarPregunta(q, v);
    }
  });

  // what is being written is stored at once when the panel goes away (navigation), not only when the page hides
  onDestroy(() => void volcarEjercicios());

  function escribir(ev: Event) {
    texto = (ev.currentTarget as HTMLTextAreaElement).value.slice(0, MAX_TEXTO_EJERCICIO);
    guardarRespuestaEscrita(label, { texto });
  }
  function marcar(k: number, si: boolean) {
    marcas[`c${k + 1}`] = si;
    guardarRespuestaEscrita(label, { [`c${k + 1}`]: si ? '1' : '' });
  }
  /** A question is settled (its answer and development shown) once right, after two failed checks or with the solution open. */
  const zanjada = (id: string) =>
    vPreguntas[id]?.tipo === 'bien' || solucionVisible || !!estado?.resuelto || (estado?.fallos ?? 0) >= 2;

  const pistasVistas = $derived(Math.min(item.pistas.length, estado?.pistas ?? 0));
  const idBase = $derived(`cmp-${label.replace(/[^\w-]/g, '_')}`);

  // 1.0 accessibility pass: one live line that is always in the page says what «Comprobar» found (the per-field
  // messages appear with the check, and a live region inserted with its text is not announced reliably); the messages
  // stay tied to their fields with aria-describedby, so each one is read again when its field takes the focus.
  let resumenComprobacion = $state('');
  /** Shown while nothing has been answered after a «Comprobar» that found nothing to check. */
  let avisoVacio = $state('');
  const hayRespuesta = $derived(Object.values(valores).some((x) => !!x?.trim()));
  const sinEtiquetas = (h: string) => h.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
  function resumirComprobacion(vs: Record<string, Veredicto>, vp: Record<string, VeredictoPregunta>, nBien: number): string {
    const total = item.respuestas.length + preguntas.length;
    const partes: string[] = [];
    for (const r of item.respuestas) {
      const v = vs[r.id];
      if (!v || v.tipo === 'vacio') continue;
      partes.push(`${sinEtiquetas(r.nombre)}: ${v.tipo === 'bien' ? `correcto, ${v.texto}` : v.mensaje}`);
    }
    for (const q of preguntas) {
      const v = vp[q.id];
      if (v && v.tipo !== 'vacio' && v.tipo !== 'bien') partes.push(v.mensaje);
    }
    if (!partes.length) return 'Todavía no hay nada que comprobar: responda al menos una parte.';
    return `${nBien} de ${total} ${total === 1 ? 'respuesta correcta' : 'respuestas correctas'}. ${partes.join('. ')}`.replace(/\.\./g, '.');
  }

  /** 1.1: a design question's circuit is being simulated (its check waits for the measurements). */
  let simulando = $state(false);

  /**
   * 1.1: before checking, the design questions whose values have not been simulated yet are simulated (the app's
   * ngspice, lib/simular-diseno.ts); the measurements are stored with the values. False if the simulation failed.
   */
  async function simularDisenos(): Promise<boolean> {
    const pendientes = preguntas.filter((q) => q.tipo === 'diseno' && faltaSimular(q, valores[q.id] ?? ''));
    if (!pendientes.length) return true;
    simulando = true;
    resumenComprobacion = 'Simulando el circuito…';
    try {
      const { medirDiseno } = await import('../../lib/simular-diseno');
      for (const q of pendientes) {
        if (q.tipo !== 'diseno') continue;
        const v = await simularDiseno(q, valores[q.id] ?? '', medirDiseno);
        valores[q.id] = v;
        guardarRespuestaEscrita(label, { [q.id]: v });
      }
      return true;
    } catch (e) {
      const cancelada = e instanceof Error && /sustituida|detenida/i.test(e.message);
      avisoVacio = cancelada
        ? 'La simulación se ha interrumpido: vuelva a pulsar «Comprobar».'
        : `No se ha podido simular el circuito (${e instanceof Error ? e.message : String(e)}).`;
      resumenComprobacion = avisoVacio;
      return false;
    } finally {
      simulando = false;
    }
  }

  async function comprobarTodo(ev: SubmitEvent) {
    ev.preventDefault();
    if (simulando) return;
    if (!(await simularDisenos())) return;
    const nuevos: Record<string, Veredicto> = {};
    const nuevasP: Record<string, VeredictoPregunta> = {};
    let legibles = 0;
    const bien: string[] = [];
    for (const r of item.respuestas) {
      const v = comprobar(valores[r.id] ?? '', r, r.alternativas);
      nuevos[r.id] = v;
      if (v.tipo === 'bien' || v.tipo === 'cerca' || v.tipo === 'mal') legibles++;
      if (v.tipo === 'bien') bien.push(r.id);
    }
    for (const q of preguntas) {
      const v = comprobarPregunta(q, valores[q.id] ?? '');
      nuevasP[q.id] = v;
      if (legible(v)) legibles++;
      if (v.tipo === 'bien') bien.push(q.id);
    }
    veredictos = nuevos;
    vPreguntas = nuevasP;
    resumenComprobacion = resumirComprobacion(nuevos, nuevasP, bien.length);
    // Only a check with something readable counts as an attempt. Final QA 1.0: a check with nothing to check says so
    // on screen too (an ordering left as shown did nothing visible).
    avisoVacio = '';
    if (legibles === 0) {
      const sinTocar = preguntas.filter((q) => !(valores[q.id] ?? ''));
      avisoVacio =
        preguntas.length && sinTocar.length === preguntas.length && !item.respuestas.length && preguntas.every((q) => q.tipo === 'orden')
          ? 'Ordene los elementos con las flechas antes de comprobar.'
          : 'Todavía no hay nada que comprobar: responda al menos una parte.';
      resumenComprobacion = avisoVacio;
      return;
    }
    const completo = bien.length === item.respuestas.length + preguntas.length;
    registrarIntento(label, $state.snapshot(valores), bien, completo);
  }

  function pista() {
    if (pistasVistas < item.pistas.length) usarPista(label, pistasVistas + 1);
    else mostrarSolucion();
  }

  function mostrarSolucion() {
    if (!solucionVisible) verSolucion(label);
    alVerSolucion?.(!solucionVisible);
  }

  function reiniciar() {
    reiniciarEjercicio(label);
    valores = {};
    veredictos = {};
    vPreguntas = {};
    texto = '';
    textoPrevio = false;
    marcas = {};
  }

  const resumenEstado = $derived.by(() => {
    if (!estado) return '';
    const partes: string[] = [];
    // review 10j: a try not solved is a failure even with fallos 0 (what the merge leaves of an attempt after a reset
    // this device had not seen), and a solve is told with the help the device that solved it had (never «a la primera»
    // on another device when it had opened the solution)
    const fallado = estadoEjercicio(estado) === 'fallado';
    const a = ayudaAlResolver(estado);
    if (!auto) {
      // self-assessed: comparing with the solution is the method, not a peek (0.12 said «después de ver la solución»)
      if (estado.resuelto) partes.push('Autoevaluado: lo tenía bien');
      else if (fallado) partes.push('Autoevaluado: no lo tenía bien');
    } else if (estado.resuelto) {
      if (a.intentos <= 1 && !a.pistas && !a.solucion) partes.push('Resuelto a la primera');
      else if (a.solucion) partes.push('Resuelto después de ver la solución');
      else if (a.pistas) partes.push(`Resuelto con ${a.pistas === 1 ? 'una pista' : `${a.pistas} pistas`}`);
      else partes.push('Resuelto');
    } else if (fallado) partes.push('Pendiente de acertar');
    if (a.intentos) partes.push(`${a.intentos} ${a.intentos === 1 ? 'intento' : 'intentos'}`);
    return partes.join(' · ');
  });

  const ICONO: Record<string, string> = { bien: '✓', cerca: '≈', mal: '✗', unidad: '?', ilegible: '?' };
</script>

<div class="comprobador" class:resuelto={estado?.resuelto} data-label={label}>
  {#if item.dato}
    <!-- 1.1: a datum the book's solution uses and its statement leaves out, right under «Se pide» -->
    <p class="dato-ej" data-dato><strong>Dato que usa la solución del libro:</strong> {@html item.dato}</p>
  {/if}
  {#if item.banco}
    <!-- 1.1: the quantities of this exercise can be read off the simulated instruments of the test bench -->
    <p class="banco-ej" data-banco>
      <a class="boton" href={`#/instrumentos/practica/${item.banco.practica}`} onclick={() => prepararSalto({ texto: 'Volver al ejercicio' })}>
        <Icono nombre="ver" tam={16} /> Medir en el banco (práctica {item.banco.practica})
      </a>
      <span>{@html item.banco.texto}</span>
    </p>
  {/if}
  {#if auto}
    <form onsubmit={comprobarTodo} novalidate>
      <p class="solo-lector" aria-live="polite" data-resumen-comprobacion>{resumenComprobacion}</p>
      <div class="campos">
        {#each item.respuestas as r (r.id)}
          {@const v = veredictos[r.id]}
          <div class="campo" data-r={r.id}>
            <label class="nombre" for={`${idBase}-${r.id}`}>{@html r.nombre}</label>
            <span class="entrada" class:conunidad={!!r.unidad}>
              <input
                id={`${idBase}-${r.id}`}
                type="text"
                inputmode="text"
                autocomplete="off"
                autocapitalize="off"
                spellcheck="false"
                enterkeyhint="done"
                placeholder={r.unidad ? 'p. ej. 4,7 k' : 'valor'}
                aria-describedby={v && v.tipo !== 'vacio' ? `${idBase}-${r.id}-fb` : undefined}
                aria-invalid={v?.tipo === 'mal' ? 'true' : undefined}
                bind:value={valores[r.id]}
                oninput={(ev) => {
                  delete veredictos[r.id];
                  guardarRespuestaEscrita(label, { [r.id]: (ev.currentTarget as HTMLInputElement).value });
                }}
              />
              {#if r.unidad}<span class="u" aria-hidden="true">{r.unidad}</span>{/if}
            </span>
            {#if v && v.tipo !== 'vacio'}
              <p class="fb fb-{v.tipo}" id={`${idBase}-${r.id}-fb`}>
                <span class="ic" aria-hidden="true">{ICONO[v.tipo]}</span>
                {#if v.tipo === 'bien'}
                  <span>Correcto{v.nota ? ` (${v.nota})` : ''}: {v.texto}.</span>
                {:else}
                  <span>{v.mensaje}</span>
                {/if}
              </p>
            {/if}
          </div>
        {/each}
        {#each preguntas as q (q.id)}
          <PreguntaEjercicio
            p={q}
            valor={valores[q.id] ?? ''}
            veredicto={vPreguntas[q.id]}
            resuelta={zanjada(q.id)}
            {idBase}
            porque={porques?.ejercicios[`${label}/${q.id}`] ?? null}
            parte={item.parte}
            simulando={simulando && q.tipo === 'diseno'}
            alCambiar={(v) => {
              valores[q.id] = v;
              delete vPreguntas[q.id];
              // kept while choosing, like what is typed (review 10e): not an attempt
              guardarRespuestaEscrita(label, { [q.id]: v });
            }}
          />
        {/each}
      </div>
      {#if item.otras?.length}
        <p class="otras">
          <strong>También se pide</strong>, para comparar con la solución:
          {#each item.otras as o, k (k)}{@html o.texto}{k < item.otras.length - 1 ? '; ' : '.'}{/each}
        </p>
        {@render escrita()}
      {:else if textoPrevio}
        {@render escrita()}
      {/if}
      <!-- (the live line above already announces it; this one is for the eyes) -->
      {#if avisoVacio && !hayRespuesta}<p class="aviso-vacio" aria-hidden="true" data-aviso-vacio>{avisoVacio}</p>{/if}
      <div class="acciones">
        <button type="submit" class="boton primario" aria-disabled={simulando || undefined}>
          <Icono nombre="hecho" tam={17} /> {simulando ? 'Simulando…' : 'Comprobar'}
        </button>
        {@render botones()}
      </div>
    </form>
  {:else}
    <p class="comparar">
      {#if item.clase === 'sin-solucion'}
        El libro no trae la solución de este ejercicio.
      {:else}
        <span class="clase">{NOMBRE_CLASE[item.clase]}</span>
        Resuélvalo por escrito y compare con la solución.
        {#if item.otras?.length}
          Se pide: {#each item.otras as o, k (k)}{@html o.texto}{k < item.otras.length - 1 ? '; ' : '.'}{/each}
        {/if}
      {/if}
    </p>
    {#if item.clase !== 'sin-solucion'}{@render escrita()}{/if}
    <div class="acciones">
      {@render botones()}
    </div>
    {#if solucionVisible && item.clase !== 'sin-solucion'}
      {@render criterios()}
      <div class="autoevaluacion" role="group" aria-label="Autoevaluación">
        <span>¿Lo tenía bien?</span>
        <button class="boton" class:elegido={estado?.resuelto} onclick={() => autoevaluar(label, true)}>
          <Icono nombre="hecho" tam={16} /> Sí
        </button>
        <button class="boton" class:elegido={estadoEjercicio(estado) === 'fallado'} onclick={() => autoevaluar(label, false)}>
          <Icono nombre="x" tam={16} /> No
        </button>
      </div>
    {/if}
  {/if}

  {#if auto && solucionVisible && item.otras?.length}
    {@render criterios()}
  {/if}

  {#if guiado && pasos}
    <ResolverPasos {label} {pasos} parte={item.parte} alSalir={salirPasos} alUsar={usarPasos} />
  {:else if auto && pasos && !estado?.resuelto && (estado?.fallos ?? 0) >= 2}
    <p class="desarrollo-aviso oferta">
      ¿Lo resolvemos por partes, con una pregunta corta en cada paso?
      <button type="button" class="boton primario" onclick={entrarPasos} data-oferta-pasos>Resolver paso a paso</button>
    </p>
  {/if}

  {#if auto && !solucionVisible && !sinSolucion && (estado?.resuelto || (estado?.fallos ?? 0) >= 2)}
    <p class="desarrollo-aviso">
      {estado?.resuelto ? `Resuelto. Compare su desarrollo con el ${item.nuevo || item.ampliacion ? 'de la solución' : 'del libro'}.` : pasos && !guiado ? `O vea el desarrollo completo${item.nuevo || item.ampliacion ? '' : ' del libro'}.` : `Vea el desarrollo completo${item.nuevo || item.ampliacion ? '' : ' del libro'}.`}
      <button type="button" class="boton" onclick={mostrarSolucion}>
        <Icono nombre="ver" tam={17} /> Ver el desarrollo
      </button>
    </p>
  {/if}

  {#if auto && recienResuelto}
    <Seguridad item={label} />
  {/if}

  {#if pistasVistas > 0 && !guiado}
    <ol class="pistas" aria-live="polite">
      {#each item.pistas.slice(0, pistasVistas) as p, k (k)}
        <li><span class="pn">Pista {k + 1}</span> {@html p}</li>
      {/each}
    </ol>
  {/if}

  {#if item.nota}
    <p class="nota-ej">{@html item.nota}</p>
  {/if}
  {#if item.errata}
    <p class="errata" data-errata><strong>Aviso:</strong> {@html item.errata}</p>
  {/if}

  <OtrosValores {label} parte={item.parte} />

  {#if resumenEstado}
    <p class="estado">
      {#if estado?.resuelto}<span class="ok" aria-hidden="true">✓</span>{/if}
      <span>{resumenEstado}</span>
      <button type="button" class="reiniciar" onclick={reiniciar}>Reiniciar</button>
    </p>
  {/if}
</div>

{#snippet escrita()}
  <div class="escrita">
    <label for={`${idBase}-texto`}>Su respuesta <span class="opc">(opcional; se guarda en este dispositivo y se sincroniza)</span></label>
    <textarea
      id={`${idBase}-texto`}
      rows="3"
      maxlength={MAX_TEXTO_EJERCICIO}
      value={texto}
      oninput={escribir}
      aria-describedby={`${idBase}-cuenta`}
    ></textarea>
    <span class="cuenta" id={`${idBase}-cuenta`}>{texto.length} / {MAX_TEXTO_EJERCICIO} caracteres</span>
  </div>
{/snippet}

{#snippet criterios()}
  <fieldset class="criterios">
    <legend>Compare con la solución{item.nuevo || item.ampliacion ? '' : ' del libro'}. Lo que se pide:</legend>
    {#each item.otras ?? [] as o, k (k)}
      <label class="criterio">
        <input type="checkbox" checked={!!marcas[`c${k + 1}`]} onchange={(ev) => marcar(k, (ev.currentTarget as HTMLInputElement).checked)} />
        <span>{@html o.texto}</span>
      </label>
    {/each}
  </fieldset>
{/snippet}

{#snippet botones()}
  {#if pasos && !guiado}
    <button type="button" class="boton discreto" bind:this={botonPasos} onclick={entrarPasos} data-pasos-boton>Resolver paso a paso</button>
  {/if}
  {#if item.pistas.length}
    <button type="button" class="boton" onclick={pista} aria-label={pistasVistas < item.pistas.length ? `Pista ${pistasVistas + 1} de ${item.pistas.length}` : 'Ver la solución'}>
      <Icono nombre="pista" tam={17} />
      {pistasVistas < item.pistas.length ? `Pista ${pistasVistas + 1}/${item.pistas.length}` : 'Solución'}
    </button>
  {/if}
  {#if !sinSolucion}
    <button type="button" class="boton" aria-expanded={solucionVisible} onclick={mostrarSolucion}>
      <Icono nombre={solucionVisible ? 'ocultar' : 'ver'} tam={17} />
      {solucionVisible ? 'Ocultar solución' : 'Ver solución'}
    </button>
  {/if}
{/snippet}

<style>
  .comprobador {
    margin: 0.2em 0 0.9em;
    padding: 12px 14px 10px;
    border: 1px solid var(--linea);
    border-radius: 10px;
    background: var(--superficie);
    font-family: var(--sans);
    font-size: 15.5px;
    line-height: 1.4;
  }
  .comprobador.resuelto {
    border-color: color-mix(in srgb, var(--c-ejemplo) 55%, var(--linea));
  }
  .campos {
    display: grid;
    gap: 10px;
  }
  .campo {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(150px, 210px);
    align-items: center;
    gap: 4px 12px;
  }
  .nombre {
    color: var(--tinta);
    font-weight: 600;
  }
  .nombre :global(sub) {
    font-size: 0.75em;
  }
  .entrada {
    position: relative;
    display: flex;
    align-items: center;
  }
  input {
    width: 100%;
    min-height: 44px;
    padding: 0 12px;
    border: 1px solid var(--linea);
    border-radius: 8px;
    background: var(--fondo);
    color: var(--tinta);
    font-family: var(--sans);
    font-size: 16.5px;
    font-variant-numeric: tabular-nums;
  }
  .conunidad input {
    padding-right: 3.2em;
  }
  input:focus-visible {
    outline: 2px solid var(--acento);
    outline-offset: 0;
    border-color: transparent;
  }
  input[aria-invalid='true'] {
    border-color: var(--c-precaucion);
  }
  .u {
    position: absolute;
    right: 12px;
    color: var(--tinta-tenue);
    font-size: 15px;
    pointer-events: none;
  }
  .fb {
    grid-column: 1 / -1;
    display: flex;
    gap: 7px;
    margin: 0;
    padding: 8px 12px;
    border-radius: 10px;
    font-size: 14.5px;
    animation: aparecer 0.16s ease-out;
  }
  .fb .ic {
    flex: none;
    font-weight: 700;
  }
  .fb-bien {
    background: var(--bien-tinte);
    color: var(--tinta);
  }
  .fb-bien .ic {
    color: var(--bien-texto);
  }
  .fb-cerca {
    background: rgb(from var(--c-importante) r g b / 0.15);
  }
  .fb-cerca .ic {
    color: var(--c-importante);
  }
  .fb-mal,
  .fb-unidad,
  .fb-ilegible {
    background: var(--mal-tinte);
  }
  .fb-mal .ic,
  .fb-unidad .ic,
  .fb-ilegible .ic {
    color: var(--mal-texto);
  }
  @keyframes aparecer {
    from {
      opacity: 0;
      transform: translateY(-2px);
    }
  }
  .aviso-vacio {
    margin: 10px 0 0;
    color: var(--tinta);
    font-size: 15px;
    font-weight: 600;
  }
  .otras,
  .comparar {
    margin: 10px 0 0;
    color: var(--tinta-suave);
    font-size: 14.5px;
  }
  .comparar {
    margin-top: 0;
  }
  .clase {
    display: inline-block;
    margin-right: 6px;
    padding: 0 8px;
    border-radius: 999px;
    background: var(--acento-tinte);
    color: var(--acento);
    font-size: 12.5px;
    font-weight: 700;
    letter-spacing: 0.03em;
    line-height: 22px;
    text-transform: uppercase;
  }
  .acciones,
  .autoevaluacion {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
  }
  .acciones :global(.boton),
  .autoevaluacion .boton {
    min-height: 44px;
  }
  .autoevaluacion span {
    color: var(--tinta-suave);
    font-weight: 600;
  }
  .autoevaluacion .elegido {
    border-color: var(--acento);
    background: var(--acento-tinte);
  }
  .escrita {
    display: grid;
    gap: 4px;
    margin-top: 10px;
  }
  .escrita label {
    color: var(--tinta);
    font-weight: 600;
  }
  .escrita .opc,
  .cuenta {
    color: var(--tinta-tenue);
    font-size: 13.5px;
    font-weight: 400;
  }
  .cuenta {
    justify-self: end;
  }
  textarea {
    width: 100%;
    min-height: 88px;
    padding: 8px 12px;
    border: 1px solid var(--linea);
    border-radius: 8px;
    background: var(--fondo);
    color: var(--tinta);
    font-family: var(--sans);
    font-size: 16px;
    line-height: 1.4;
    resize: vertical;
  }
  textarea:focus-visible {
    outline: 2px solid var(--acento);
    outline-offset: 0;
    border-color: transparent;
  }
  .criterios {
    display: grid;
    gap: 2px;
    margin: 12px 0 0;
    padding: 0;
    border: 0;
  }
  .criterios legend {
    margin-bottom: 4px;
    color: var(--tinta-suave);
    font-weight: 600;
  }
  .criterio {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    cursor: pointer;
  }
  .criterio input {
    flex: none;
    width: 18px;
    height: 18px;
    accent-color: var(--acento);
  }
  .desarrollo-aviso {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 10px;
    margin: 12px 0 0;
    color: var(--tinta-suave);
    font-size: 14.5px;
  }
  .discreto {
    border-color: transparent;
    background: none;
    color: var(--tinta-suave);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .desarrollo-aviso .boton {
    min-height: 44px;
  }
  .pistas {
    display: grid;
    gap: 6px;
    margin: 12px 0 0;
    padding: 0;
    list-style: none;
  }
  .pistas li {
    padding: 8px 12px;
    border-radius: var(--radio-boton);
    background: var(--tarjeta-fondo);
    font-size: 15px;
    animation: aparecer 0.18s ease-out;
  }
  .pn {
    margin-right: 4px;
    color: var(--c-tarjeta-texto);
    font-weight: 700;
  }
  .nota-ej {
    margin: 10px 0 0;
    color: var(--tinta-tenue);
    font-size: 13.5px;
  }
  .banco-ej {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 12px;
    margin: 0 0 10px;
    color: var(--tinta-suave);
    font-size: 14px;
  }
  .dato-ej {
    margin: 0 0 10px;
    padding: 6px 10px;
    border-left: 3px solid var(--c-nota);
    border-radius: 0 7px 7px 0;
    background: rgb(from var(--c-nota) r g b / 0.1);
    font-size: 14px;
  }
  .errata {
    margin: 10px 0 0;
    padding: 6px 10px;
    border-radius: 7px;
    background: rgb(from var(--c-importante) r g b / 0.12);
    font-size: 14px;
  }
  .estado {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin: 10px 0 0;
    color: var(--tinta-tenue);
    font-size: 13.5px;
  }
  .estado .ok {
    color: var(--c-ejemplo);
    font-weight: 700;
  }
  .reiniciar {
    min-height: 44px;
    margin-left: auto;
    padding: 0 10px;
    border: 0;
    border-radius: 6px;
    background: none;
    color: var(--tinta-tenue);
    font-size: 13.5px;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .reiniciar:hover {
    color: var(--tinta);
  }
  @media (max-width: 520px) {
    .campo {
      grid-template-columns: 1fr;
    }
    .comprobador {
      padding: 10px 12px 8px;
    }
  }
</style>
