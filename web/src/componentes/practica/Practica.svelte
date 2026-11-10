<script lang="ts" module>
  /** What a kind of question reports when it is checked. */
  export interface Comprobacion {
    bien: boolean;
    /** Short message about the attempt («Las cifras están bien, pero sobra un prefijo…»), plain text. */
    mensaje?: string;
    /** The attempt does not count (unreadable number, unit of another quantity): only the message. */
    nula?: boolean;
  }

  /** The interface every kind of question gives the shell (bind:this). */
  export interface ControlPractica {
    comprobar(): Promise<Comprobacion> | Comprobacion;
    /** Clear the interaction for a new attempt (keeping what was right when it makes sense). */
    reintentar(): void;
  }

  /** The final answer of an item: right or wrong, and after how many attempts. */
  export interface RespuestaPractica {
    bien: boolean;
    intentos: number;
  }
</script>

<script lang="ts">
  // «Aprender haciendo» (0.10): the shell of every interactive item in the 0.9 question style
  // (componentes/pregunta/Pregunta.svelte): the statement, the interaction of its kind, «Comprobar», the hint
  // ladder (first the book's idea or formula, then the set-up), a second attempt before the solution, and the
  // explanation with the book fragment that justifies it and the link to its place in the book.
  // A prediction has a single answer: the simulation is its explanation.
  import { tick, untrack } from 'svelte';
  import Check from '@lucide/svelte/icons/check';
  import X from '@lucide/svelte/icons/x';
  import Lightbulb from '@lucide/svelte/icons/lightbulb';
  import { prepararHtml, rutaDeRef } from '../../lib/datos';
  import type { ItemPractica, Pista } from './tipos';
  import { NOMBRE_TIPO } from './datos';
  import EcLibro from './EcLibro.svelte';
  import Numerico from './Numerico.svelte';
  import Prediccion from './Prediccion.svelte';
  import Deslizador from './Deslizador.svelte';
  import Toque from './Toque.svelte';
  import Ordenar from './Ordenar.svelte';
  import Parejas from './Parejas.svelte';
  import Montar from './Montar.svelte';
  import Reto from './Reto.svelte';
  import Construye from './Construye.svelte';
  import Averia from './Averia.svelte';
  // 0.11: every check is reported as a learning event (sound, vibration, XP…); a right answer celebrates.
  import { emitir, type OrigenRespuesta } from '../../lib/aprendizaje/eventos';
  import { prepararSonido } from '../../lib/aprendizaje/retroalimentacion';
  import Destello from '../progreso/Destello.svelte';
  import Seguridad from '../pregunta/Seguridad.svelte';

  let {
    item,
    etiqueta = '',
    respuesta = null,
    onresponder,
    final = $bindable(false),
    origen = 'practica',
    semilla = null,
    repetir = true,
  }: {
    item: ItemPractica;
    /** Where it is shown (for the learning events): a lesson, Repaso's «Practicar», under an exercise. */
    origen?: OrigenRespuesta;
    /** Small line above the statement; the kind of question by default. */
    etiqueta?: string;
    /** The first final answer, kept by the caller (a revisited item shows it was answered). */
    respuesta?: RespuestaPractica | null;
    /** Called once, with the first final answer. */
    onresponder?: (r: RespuestaPractica) => void;
    /** The explanation is on show (the caller enables «Continuar»). */
    final?: boolean;
    /** 0.11 (group B): fixed values of a problem with changing values (the problem of the day). */
    semilla?: number | null;
    /** Offer «Probar otra vez» / «Otro con otros valores» after the answer (not for the problem of the day). */
    repetir?: boolean;
  } = $props();

  let control: ControlPractica | undefined = $state();
  /** The kind's component can be checked (an answer is complete). */
  let listo = $state(false);
  /** Hints computed by the kind's component (problems with changing values); the item's otherwise. */
  let pistasPropias = $state<Pista[] | null>(null);
  let intento = $state(1);
  let mensaje = $state('');
  let resultado = $state<boolean | null>(null);
  let vistas = $state(0);
  let comprobando = $state(false);
  let tarjeta: HTMLElement | undefined = $state();
  let ronda = $state(0);
  /** Right answer just given in this round (the seal celebrates; a revisited item does not). */
  let recien = $state(false);

  // 1.0: a challenge gives three attempts (each failure says how far it is and opens one more hint)
  const maxIntentos = $derived(item.tipo === 'prediccion' ? 1 : item.tipo === 'reto' || item.tipo === 'construye' ? 3 : 2);
  const pistas = $derived(pistasPropias ?? item.pistas);
  const titulo = $derived(item.tipo === 'ordenar' ? 'Ordene los pasos como los da el libro.' : item.enunciado);
  const contexto = $derived(item.tipo === 'ordenar' ? item.enunciado : '');

  // A revisited item starts afresh but remembers it was answered (the recorded answer is the caller's).
  untrack(() => {
    final = false;
  });

  /**
   * QA 1.0: let the browser paint «Comprobando…» before the check runs. A check starts with synchronous work (the
   * circuit's netlist of «Monte el circuito») that held the old button on screen ~0,44 s at 4× CPU slowdown. One frame,
   * with a timer as a floor where frames do not run (a hidden tab).
   */
  function pintar(): Promise<void> {
    return new Promise((listo) => {
      let hecho = false;
      const fin = () => {
        if (!hecho) {
          hecho = true;
          listo();
        }
      };
      requestAnimationFrame(() => setTimeout(fin, 0));
      setTimeout(fin, 100);
    });
  }

  async function comprobar() {
    if (!control || comprobando || resultado !== null) return;
    comprobando = true;
    prepararSonido();
    try {
      // the previous attempt's message goes away, so the next one (even the same text) is announced again
      mensaje = '';
      await tick();
      await pintar();
      const r = await control.comprobar();
      if (r.nula) {
        mensaje = r.mensaje ?? '';
        return;
      }
      const cierra = r.bien || intento >= maxIntentos;
      emitir({ tipo: 'respuesta', id: item.id, clase: 'practica', origen, correcta: r.bien, intento, pistas: vistas, final: cierra, parte: item.parte, seccion: item.seccion, subtipo: item.tipo });
      if (cierra) {
        recien = r.bien;
        resultado = r.bien;
        mensaje = r.bien ? '' : (r.mensaje ?? '');
        final = true;
        if (!respuesta) onresponder?.({ bien: r.bien, intentos: intento });
        await tick();
        tarjeta?.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
      } else {
        mensaje = r.mensaje ?? 'No es correcto.';
        intento++;
        // The second attempt comes with the first hint (the ladder goes on with «Otra pista»); a challenge opens
        // one more rung after each failed attempt.
        if (vistas < 1 && pistas.length) vistas = 1;
        else if ((item.tipo === 'reto' || item.tipo === 'construye') && vistas < pistas.length) vistas = Math.max(vistas, Math.min(pistas.length, intento - 1));
      }
    } finally {
      comprobando = false;
    }
  }

  function otraVez() {
    recien = false;
    resultado = null;
    final = false;
    mensaje = '';
    intento = 1;
    vistas = 0;
    ronda++;
  }

  function reintentar() {
    mensaje = '';
    control?.reintentar();
  }

  const refHref = $derived(rutaDeRef(item.ref) ?? `#/${item.parte}/${encodeURIComponent(item.ref)}`);
</script>

<div class="practica10" data-practica={item.id} data-tipo={item.tipo} data-intento={intento} data-final={final ? (resultado ? 'bien' : 'mal') : undefined}>
  <div class="cab">
    <span class="etiqueta">{etiqueta || NOMBRE_TIPO[item.tipo]}</span>
    {#if item.tipo !== 'numerico'}
      {#if contexto}<p class="contexto">{@html prepararHtml(contexto)}</p>{/if}
      <h2 class="enunciado">{@html prepararHtml(titulo)}</h2>
    {/if}
  </div>

  {#key ronda}
    {#if item.tipo === 'numerico'}
      <Numerico bind:this={control} {item} {final} bind:listo bind:pistas={pistasPropias} onenviar={comprobar} semillaFija={semilla} />
    {:else if item.tipo === 'prediccion'}
      <Prediccion bind:this={control} {item} {final} bind:listo onenviar={comprobar} />
    {:else if item.tipo === 'deslizador'}
      <Deslizador bind:this={control} {item} {final} bind:listo />
    {:else if item.tipo === 'toque'}
      <Toque bind:this={control} {item} {final} bind:listo bind:pistas={pistasPropias} />
    {:else if item.tipo === 'ordenar'}
      <Ordenar bind:this={control} {item} {final} bind:listo />
    {:else if item.tipo === 'parejas'}
      <Parejas bind:this={control} {item} {final} bind:listo />
    {:else if item.tipo === 'protoboard'}
      <Montar bind:this={control} {item} {final} bind:listo />
    {:else if item.tipo === 'reto'}
      <Reto bind:this={control} {item} {final} bind:listo />
    {:else if item.tipo === 'construye'}
      <Construye bind:this={control} {item} {final} bind:listo />
    {:else if item.tipo === 'averia'}
      <Averia bind:this={control} {item} {final} bind:listo />
    {/if}
  {/key}

  {#if !final}
    {#if mensaje}
      <div class="intento" role="alert" data-reintento>
        <span class="sello mal" aria-hidden="true"><X size={16} strokeWidth={3} /></span>
        <div>
          <p class="que">{mensaje}</p>
          {#if intento > 1 && intento <= maxIntentos}<p class="queda">Tiene otro intento antes de ver la solución.</p>{/if}
        </div>
      </div>
    {/if}
    {#if vistas > 0}
      <ol class="pistas" data-pistas={vistas}>
        {#each pistas.slice(0, vistas) as p, i (i)}
          <li class="pista">
            <span class="rot"><Lightbulb size={15} aria-hidden="true" /> Pista {i + 1} · {p.titulo}</span>
            {#if p.ec}<EcLibro svg={p.ec.svg} w={p.ec.w} h={p.ec.h} />{/if}
            {#if p.html}<div class="txt">{@html prepararHtml(p.html)}</div>{/if}
          </li>
        {/each}
      </ol>
    {/if}
    <div class="acciones">
      {#if vistas < pistas.length}
        <button type="button" class="pedir" onclick={() => vistas++} data-pista>
          <Lightbulb size={17} aria-hidden="true" />
          {vistas === 0 ? 'Ver una pista' : 'Otra pista'}
        </button>
      {/if}
      {#if mensaje && intento > 1 && (item.tipo === 'ordenar' || item.tipo === 'parejas' || item.tipo === 'protoboard' || item.tipo === 'toque' || item.tipo === 'reto' || item.tipo === 'construye' || item.tipo === 'averia')}
        <button type="button" class="pedir" onclick={reintentar} data-de-nuevo>Borrar y volver a empezar</button>
      {/if}
      {#if item.tipo !== 'numerico' && item.tipo !== 'prediccion'}
        <!-- busy: aria-disabled, not disabled, so the focus stays on the button while it checks (QA 1.0) -->
        <button
          type="button"
          class="comprobar"
          disabled={!listo}
          aria-disabled={comprobando ? 'true' : undefined}
          aria-busy={comprobando ? 'true' : undefined}
          onclick={comprobar}
          data-comprobar
          data-comprobando={comprobando ? '' : undefined}
        >
          {comprobando ? 'Comprobando…' : 'Comprobar'}
        </button>
        <span class="solo-lector" role="status" data-estado-comprobar>{comprobando ? 'Comprobando…' : ''}</span>
      {/if}
    </div>
  {:else}
    <section class="respuesta" class:bien={resultado} bind:this={tarjeta} role="status" data-feedback={resultado ? 'bien' : 'mal'}>
      <div class="veredicto">
        <Destello activo={recien}><span class="sello" aria-hidden="true">{#if resultado}<Check size={18} strokeWidth={3} />{:else}<X size={18} strokeWidth={3} />{/if}</span></Destello>
        <h3>{resultado ? (intento > 1 ? '¡Correcto a la segunda!' : '¡Correcto!') : item.tipo === 'prediccion' ? 'No era eso' : 'No es correcto'}</h3>
      </div>
      {#if resultado && recien}<Seguridad item={item.id} />{/if}
      {#if !resultado && mensaje && !mensaje.startsWith('No es correcto')}<p class="sol">{mensaje}</p>{/if}
      {#each item.citas as c, i (i)}
        <blockquote data-cita>
          <span class="de">Del libro · {c.donde}</span>
          <p>{@html prepararHtml(c.html)}</p>
        </blockquote>
      {/each}
      <div class="enlaces">
        <a class="ver" href={refHref} data-ver-ref>Ver {item.verRef}</a>
        {#if repetir}<button type="button" class="otra-vez" onclick={otraVez} data-otra-vez>{item.tipo === 'numerico' ? 'Otro con otros valores' : 'Probar otra vez'}</button>{/if}
      </div>
    </section>
  {/if}
</div>

<style>
  .practica10 {
    /* 1.1: the mock-up's feedback tokens (estilos/tokens11.css), as in pregunta/Pregunta.svelte; the kinds' components
       inside read them too (--ok-texto / --mal-texto for words on the tints) */
    --ok: var(--v11-bien);
    --ok-tinte: var(--v11-bien-tinte);
    --ok-texto: var(--v11-bien-texto);
    --mal: var(--v11-mal);
    --mal-tinte: var(--v11-mal-tinte);
    --mal-texto: var(--v11-mal-texto);
    --sobre-veredicto: #ffffff;
    display: flex;
    flex-direction: column;
    gap: 18px;
    font-family: var(--sans);
  }
  :global(:root[data-tema='oscuro']) .practica10 {
    --sobre-veredicto: #10161d;
  }
  .cab {
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
  .contexto {
    margin: 0;
    color: var(--tinta-suave);
    font-family: var(--serif);
    font-size: 17px;
    line-height: 1.5;
  }
  .enunciado {
    margin: 0;
    color: var(--titulos);
    font-family: var(--titular);
    font-size: clamp(21px, 3vw, 25px);
    font-weight: 700;
    letter-spacing: -0.01em;
    line-height: 1.28;
    text-wrap: pretty;
  }
  .intento {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 12px 14px;
    border-radius: var(--radio-boton);
    background: var(--mal-tinte);
  }
  .intento p {
    margin: 0;
    color: var(--tinta);
    font-size: 15.5px;
    line-height: 1.45;
  }
  .intento .queda {
    color: var(--tinta-suave);
    font-size: 14px;
  }
  .sello {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--mal);
    color: var(--sobre-veredicto);
  }
  .pistas {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .pista {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px 14px;
    border: 1px dashed var(--ambar);
    border-radius: var(--radio-boton);
    background: var(--ambar-tinte);
  }
  .pista .rot {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--tinta-suave);
    font-size: 12.5px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .pista .txt {
    color: var(--tinta);
    font-family: var(--serif);
    font-size: 16px;
    line-height: 1.5;
  }
  .acciones {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
  }
  .pedir {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    padding: 0 14px;
    border: 1.5px solid var(--linea);
    border-radius: var(--radio-boton);
    background: var(--superficie);
    color: var(--tinta);
    font-size: 15px;
    font-weight: 600;
  }
  .pedir:hover {
    background: var(--hover);
  }
  .comprobar {
    margin-left: auto;
    min-height: 52px;
    padding: 0 24px;
    border: 0;
    border-radius: var(--v11-radio-boton);
    background: var(--bloque, var(--acento));
    color: var(--sobre-bloque, var(--sobre-acento));
    font-size: 17px;
    font-weight: 600;
  }
  /* 1.1: the mock-up's grey disabled button, text readable (it was faded) */
  .comprobar:disabled {
    background: var(--v11-inactivo);
    color: var(--v11-sobre-inactivo);
    cursor: default;
  }
  .comprobar[aria-busy='true'] {
    opacity: 0.75;
    cursor: progress;
  }
  .respuesta {
    display: flex;
    flex-direction: column;
    gap: 14px;
    /* 1.1: the mock-up's feedback banner: the verdict's tint, no stripe; links on it in the checked blue */
    padding: 18px;
    border-radius: var(--radio-tarjeta-p);
    background: var(--mal-tinte);
    color: var(--tinta);
    --acento: var(--v11-azul);
    scroll-margin-bottom: 120px;
    animation: entrar 0.2s ease;
  }
  .respuesta.bien {
    background: var(--ok-tinte);
  }
  @keyframes entrar {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .respuesta {
      animation: none;
    }
  }
  .veredicto {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .veredicto .sello {
    width: 34px;
    height: 34px;
  }
  .bien .veredicto .sello {
    background: var(--ok);
  }
  .veredicto h3 {
    margin: 0;
    color: var(--mal-texto);
    font-size: 19px;
    font-weight: 700;
  }
  .bien .veredicto h3 {
    color: var(--ok-texto);
  }
  .sol {
    margin: 0;
    color: var(--tinta);
    font-size: 15.5px;
  }
  blockquote {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 0;
    padding: 12px 14px;
    border-radius: 12px;
    background: var(--superficie-2);
  }
  .de {
    color: var(--tinta-suave);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  blockquote p {
    margin: 0;
    color: var(--tinta);
    font-family: var(--serif);
    font-size: 16px;
    line-height: 1.5;
  }
  .enlaces {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 18px;
    align-items: center;
  }
  .ver {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    font-size: 15px;
    font-weight: 600;
  }
  .otra-vez {
    min-height: 44px;
    padding: 0 4px;
    border: 0;
    background: transparent;
    color: var(--acento);
    font-size: 15px;
    font-weight: 600;
  }
  .otra-vez:hover {
    text-decoration: underline;
  }
  /* Shared by the kinds' components (they live inside this shell). */
  .practica10 :global(.p10-placa) {
    position: relative;
    padding: 10px;
    border: 1px solid var(--linea);
    border-radius: 14px;
    background: var(--placa);
  }
  .practica10 :global(.p10-solucion) {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px;
    border: 1px solid var(--linea);
    border-radius: 14px;
    background: var(--superficie);
  }
  .practica10 :global(.p10-solucion .rot) {
    color: var(--tinta-suave);
    font-size: 12.5px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
</style>
