<script lang="ts">
  // 1.1 lesson card asked on its own (motor fixes 1.1): «Práctica inteligente» and the section's spaced review ask
  // the predictions, questions and challenges of the hand-authored lessons as one more kind of item. The card is the
  // lesson's own — its widget, options, estimate, order, pairs or challenge conditions, with the explanations and
  // hints — in the state the generator checked it in (lib/leccion11/motor.ts valoresSueltos). Its checks are
  // reported under the lesson's answer id (XP once per card wherever it is answered; the same mastery rounds) with
  // origin «inteligente»; `onresponder` is called when the round closes (right, or the second wrong check), as the
  // session's practice items do.
  import { tick, untrack } from 'svelte';
  import { emitir } from '../../lib/aprendizaje/eventos';
  import { compilarModelo, enRango, formatear, objetivoEstimar, valoresDeTarjeta, type Valores } from '../../lib/leccion11/modelo';
  import { botonPrincipal, comprobar, eventoDeComprobacion, nuevoEstado, reintentar, valoresSueltos, type Aviso, type EstadoTarjeta } from '../../lib/leccion11/motor';
  import { rutaTarjeta } from '../../lib/leccion11/ruta';
  import { textoPlano } from '../../lib/leccion11/texto';
  import type { Leccion11 } from '../../lib/leccion11/tipos';
  import Ecuacion from '../Ecuacion.svelte';
  import CircuitoLeccion from './CircuitoLeccion.svelte';
  import GraficaLeccion from './GraficaLeccion.svelte';
  import Opciones from './Opciones.svelte';
  import Estimar from './Estimar.svelte';
  import Ordenar from './Ordenar.svelte';
  import Emparejar from './Emparejar.svelte';
  // 1.2 learning-by-doing steps and the hint ladder (motor12)
  import Actividad12 from '../leccion12/Actividad12.svelte';
  import Widget12 from '../leccion12/Widget12.svelte';
  import Escalera from '../leccion12/Escalera.svelte';
  import TextoVivo from './TextoVivo.svelte';

  let {
    leccion,
    k,
    prefijo,
    onresponder,
  }: {
    leccion: Leccion11;
    /** Position of the card in the lesson. */
    k: number;
    /** Unique prefix of the ids on the page. */
    prefijo: string;
    /** The round closed: right or not, and whether at the first attempt without help. */
    onresponder: (r: { bien: boolean; primera: boolean }) => void;
  } = $props();

  // (the session mounts one card per item: its props do not change while it is on screen)
  const t = $derived(leccion.tarjetas[k]!);
  let propios = $state<Valores>(untrack(() => valoresSueltos(leccion, k)));
  let e = $state<EstadoTarjeta>(untrack(() => nuevoEstado(leccion.tarjetas[k]!)));
  let aviso = $state<Aviso | null>(null);
  let raiz: HTMLElement | undefined = $state();
  let respondida = false;

  const mc = $derived(compilarModelo(leccion.modelo));
  // (1.2: with the card's state, so an «averia» card's widget shows the faulty board)
  const efectivos = $derived(valoresDeTarjeta(t, propios, e));
  const evaluados = $derived(mc.evaluar(efectivos));
  const boton = $derived(botonPrincipal(t, e, evaluados));
  const objetivo = $derived(t.estimar ? objetivoEstimar(mc, t.estimar, efectivos) : 0);
  // (review 11c: the hidden reading stays hidden after a wrong check — the retry would be answered by the screen —;
  // it is shown once the card is right or its round has closed, the second wrong check: nothing more is reported)
  const oculto = $derived(!!t.widget?.ocultar && !e.resuelta && !e.cerrada);

  function valor(id: string): string {
    return formatear(mc.magnitud(id), evaluados[id]);
  }

  function alMover(id: string, x: number) {
    propios = { ...propios, [id]: x };
    const cambios: Partial<EstadoTarjeta> = {};
    if (!e.movidos.includes(id)) cambios.movidos = [...e.movidos, id];
    // moving a challenge's values after a failed check takes the verdict away (it no longer describes them)
    if (e.comprobado && !e.bien && t.condiciones) {
      cambios.comprobado = false;
      cambios.bien = null;
      aviso = null;
    }
    if (Object.keys(cambios).length) e = { ...e, ...cambios };
  }

  function cambiarEstado(c: Partial<EstadoTarjeta>) {
    e = { ...e, ...c };
  }

  function elegirOpcion(j: number) {
    if (!t.opciones || e.comprobado || e.resuelta || e.descartadas.includes(j) || j >= t.opciones.length) return;
    cambiarEstado({ eleccion: j });
  }

  function principal(ev?: MouseEvent) {
    if (boton.bloqueado || (ev && ev.detail > 1)) return;
    if (boton.accion === 'comprobar') {
      const { estado, aviso: a } = comprobar(leccion, t, e, efectivos);
      const r = eventoDeComprobacion(leccion, t, e, estado, 'inteligente');
      if (r) {
        emitir(r.evento);
        estado.cerrada = r.cerrada;
        if (r.cerrada && !respondida) {
          respondida = true;
          onresponder({ bien: r.evento.correcta, primera: r.evento.correcta && r.evento.intento === 1 && r.evento.pistas === 0 });
        }
      }
      e = estado;
      aviso = a;
    } else if (boton.accion === 'reintentar') {
      e = reintentar(t, e);
      aviso = null;
      void tick().then(() => raiz?.querySelector<HTMLElement>('.opcion:not([aria-disabled="true"]), [role="slider"]')?.focus());
    }
  }
</script>

<div class="l11-suelta" bind:this={raiz} data-tarjeta={t.id} data-tipo={t.tipo} data-leccion11-suelta={leccion.id}>
  <span class="etiqueta">Lección {leccion.num || leccion.titulo} · {t.fase}</span>
  <h2><TextoVivo texto={t.titulo} {valor} /></h2>
  {#if t.texto.length}<p class="texto"><TextoVivo texto={t.texto} {valor} /></p>{/if}

  {#if t.ec}
    <div class="formula">
      <div class="ec"><Ecuacion bloque={{ t: 'ec', svg: t.ec.svg, fuente: t.ec.fuente, w: t.ec.w, h: t.ec.h }} /></div>
      {#if t.sustitucion}
        <p class="sustitucion" aria-label={`Con sus valores: ${textoPlano(t.sustitucion, valor)}`}>
          <span class="suave">Con sus valores:</span> <TextoVivo texto={t.sustitucion} {valor} />
        </p>
      {/if}
    </div>
  {/if}
  {#if t.widget?.tipo === 'circuito'}
    <CircuitoLeccion {leccion} widget={t.widget} valores={evaluados} propios={efectivos} {oculto} {prefijo} {valor} {alMover} />
  {:else if t.widget?.tipo === 'grafica'}
    <GraficaLeccion {leccion} widget={t.widget} valores={evaluados} propios={efectivos} {oculto} {prefijo} {valor} {alMover} />
  {:else if t.widget?.tipo === 'figura' || t.widget?.tipo === 'logica'}
    <Widget12 {t} {e} {oculto} {prefijo} cambiar={cambiarEstado} />
  {/if}

  {#if t.nota}<p class="nota"><TextoVivo texto={t.nota} {valor} /></p>{/if}

  {#if t.condiciones}
    <div class="chips" data-condiciones>
      {#each t.condiciones as c, j (j)}
        {@const ok = enRango(c, evaluados)}
        <span class="chip" class:ok data-condicion={j} data-cumple={ok ? 'si' : 'no'}><span class="solo-lector">{ok ? 'Cumple: ' : 'No cumple todavía: '}</span><TextoVivo texto={c.rotulo} {valor} /></span>
      {/each}
    </div>
  {/if}

  {#if t.opciones}
    <Opciones opciones={t.opciones} eleccion={e.eleccion} descartadas={e.descartadas} comprobado={e.comprobado} bien={e.bien} resuelta={e.resuelta} {valor} elegir={elegirOpcion} />
  {:else if t.estimar}
    <Estimar estimar={t.estimar} estimacion={e.estimacion} {objetivo} comprobado={e.comprobado} resuelta={e.resuelta} {prefijo} mover={(x) => cambiarEstado({ estimacion: x, comprobado: false, bien: null })} />
  {:else if t.ordenar}
    <Ordenar elementos={t.ordenar.elementos} orden={e.orden} bloqueado={e.resuelta} comprobado={e.comprobado} {valor} cambiar={(o) => cambiarEstado({ orden: o, comprobado: false, bien: null })} />
  {:else if t.emparejar}
    <Emparejar parejas={t.emparejar.parejas} inicio={t.emparejar.inicio} puestas={e.puestas} bloqueado={e.resuelta} comprobado={e.comprobado} {valor} cambiar={(p) => cambiarEstado({ puestas: p, comprobado: false, bien: null })} />
  {/if}
  {#if t.actividad}
    <Actividad12 {leccion} {t} {e} valores={evaluados} {efectivos} {prefijo} {valor} cambiar={cambiarEstado} />
  {/if}
  <Escalera {t} {e} {valor} cambiar={cambiarEstado} />

  {#if aviso}
    <div class={`banner ${aviso.bien ? 'bien' : 'mal'}`} role="status" data-veredicto={aviso.bien ? 'bien' : 'mal'}>
      <strong>{aviso.titulo}</strong>
      {#each aviso.textos as x, j (j)}<p><TextoVivo texto={x} {valor} /></p>{/each}
    </div>
  {/if}
  {#if boton.accion !== 'continuar'}
    <button type="button" class="primario" disabled={boton.bloqueado} onclick={principal} data-comprobar-l11 data-accion={boton.accion}>{boton.texto}</button>
  {/if}
  {#if e.cerrada || e.resuelta}
    <!-- (only once answered: the session would be left half done) -->
    <a class="enlace" href={rutaTarjeta(leccion.parte, leccion.seccion, k)} data-abrir-leccion11>Ver esta tarjeta en su lección</a>
  {/if}
</div>

<style>
  .l11-suelta {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 18px;
    border-radius: var(--v11-radio-tarjeta);
    background: var(--v11-fondo);
    color: var(--v11-tinta);
    font-family: var(--v11-texto);
  }
  .etiqueta {
    color: var(--v11-tinta-suave);
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  h2 {
    margin: 0;
    color: var(--v11-tinta);
    font: 700 23px/1.2 var(--v11-titular);
    text-wrap: balance;
  }
  .texto {
    margin: 0;
    font-size: 16px;
    line-height: 1.5;
  }
  .formula {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px 16px;
    border: 1.5px solid var(--v11-linea);
    border-radius: var(--v11-radio-panel);
  }
  .ec {
    --tinta: var(--v11-tinta);
    --tam: 20px;
    color: var(--v11-tinta);
    font-size: 20px;
  }
  .ec :global(.ec) {
    margin: 0;
  }
  .ec :global(.calcular) {
    min-height: 44px;
  }
  .ec :global(.ec-marco) {
    padding: 4px 0;
    background: transparent;
    text-align: left;
  }
  .sustitucion {
    margin: 0;
    font-size: 15px;
    font-variant-numeric: tabular-nums;
  }
  .suave {
    color: var(--v11-tinta-suave);
  }
  .nota {
    margin: 0;
    padding: 10px 12px;
    border-radius: 10px;
    background: var(--v11-panel);
    font-size: 14px;
    line-height: 1.45;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .chip {
    padding: 7px 12px;
    border-radius: 999px;
    background: var(--v11-mal-tinte);
    color: var(--v11-mal-texto);
    font-size: 14px;
    font-weight: 600;
  }
  .chip.ok {
    background: var(--v11-bien-tinte);
    color: var(--v11-bien-texto);
  }
  .banner {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px 14px;
    border-radius: 14px;
    font-size: 14px;
    line-height: 1.45;
  }
  .banner strong {
    font-size: 16px;
  }
  .banner p {
    margin: 0;
  }
  .banner.bien {
    background: var(--v11-bien-tinte);
    color: var(--v11-bien-texto);
  }
  .banner.mal {
    background: var(--v11-mal-tinte);
    color: var(--v11-mal-texto);
  }
  .primario {
    min-height: 52px;
    border: 0;
    border-radius: var(--v11-radio-boton);
    background: var(--v11-azul);
    color: var(--v11-sobre-azul);
    font: 600 17px var(--v11-texto);
    cursor: pointer;
  }
  .primario:hover:not(:disabled) {
    background: var(--v11-azul-hover);
  }
  .primario:disabled {
    background: var(--v11-inactivo);
    color: var(--v11-sobre-inactivo);
    cursor: default;
  }
  .enlace {
    display: inline-flex;
    align-items: center;
    align-self: flex-start;
    min-height: 44px;
    color: var(--v11-azul);
    font-size: 14px;
    font-weight: 600;
  }
  button:focus-visible,
  a:focus-visible {
    outline: 3px solid var(--v11-foco);
    outline-offset: 2px;
  }
  .solo-lector {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
