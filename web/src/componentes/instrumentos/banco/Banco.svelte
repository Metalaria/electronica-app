<script lang="ts">
  // The test bench view: the circuit drawn (tap a node to place the selected lead), the leads and probes,
  // the component values, the two instruments, and (optionally) a guided practice. Simulates whenever the
  // bench changes; the instruments read five (multimeters) to eight (oscilloscope) times per second, only
  // while the page is visible.
  import type { Snippet } from 'svelte';
  import type { Banco, Punta } from '../banco.svelte.ts';
  import Plano, { type Fuente } from '../esquema/Plano.svelte';
  import Conexiones from './Conexiones.svelte';
  import Aparatos from './Aparatos.svelte';
  import Escuchar from './Escuchar.svelte';
  import { activarBanco } from './activo.svelte.ts';
  import Parametros from '../../simulador/Parametros.svelte';
  import { listarParametros, aplicarParametro } from '../../../simulador/motor/netlist.ts';
  import { motor } from '../../../simulador/cliente.svelte';
  import type { GuiaBrymen, GuiaFnirsi } from '../guia';

  let {
    b,
    plano,
    lateral,
    lateralArriba = false,
    barra = null,
    tamano,
    guiaBm = null,
    guiaFn = null,
    pestana = $bindable('fnirsi'),
  }: {
    b: Banco;
    /** The drawing; null: the circuit has none; undefined: still being decided (its place is kept). */
    plano: Fuente | null | undefined;
    /** Practice panel or circuit chooser, shown next to the bench. */
    lateral?: Snippet;
    /**
     * Review 11c: on narrow screens the panel goes first (a lab's step had sat ~2 200 px down, under the circuit and
     * the instruments). Wide screens keep it under the circuit, next to the instruments.
     */
    lateralArriba?: boolean;
    /** A compact bar that sticks to the bottom of the window on narrow screens (the lab's step and «Comprobar»). */
    barra?: Snippet | null;
    /** 0.12 QA: [width, height] of the automatic drawing it will get (precomputed), to keep its place exactly. */
    tamano?: [number, number] | null;
    /** 1.1 labs: what the instruments light up («Mostrar dónde»), and the instrument shown on narrow screens. */
    guiaBm?: GuiaBrymen | null;
    guiaFn?: GuiaFnirsi | null;
    pestana?: 'brymen' | 'fnirsi';
  } = $props();

  let activa = $state<Punta | null>('bmRojo');

  // Simulation, readings and acquisitions (banco/activo.svelte.ts). The bench of a view never changes.
  // svelte-ignore state_referenced_locally
  const vivo = activarBanco(b);

  // ---------------------------------------------------------------- parameters
  const parametros = $derived(listarParametros(b.texto));
  const rangos = $derived.by(() => {
    const r: Record<string, { min: number; max: number; original: number }> = {};
    for (const p of listarParametros(b.original)) r[p.id] = { min: p.min, max: p.max, original: p.valor };
    return r;
  });
  function cambiar(id: string, v: number) {
    b.texto = aplicarParametro(b.texto, id, v);
  }

  const estado = $derived(
    motor.fase === 'descargando'
      ? `Descargando el motor… ${motor.descarga !== null ? Math.round(motor.descarga * 100) + ' %' : ''}`
      : motor.fase === 'preparando'
        ? 'Preparando el motor…'
        : b.simulando
          ? 'Simulando…'
          : b.error
            ? 'Error en la simulación'
            : b.datos
              ? `Simulado en ${b.datos.ms} ms`
              : '',
  );
</script>

<div class="envoltura">
<div class="banco" class:lateral-arriba={lateralArriba}>
  <section class="bloque circuito" aria-label="Circuito">
    <div class="cab">
      <h2>Circuito</h2>
      <span class="estado" class:error={!!b.error} aria-live="polite">{estado}</span>
    </div>
    {#if plano}
      <Plano fuente={plano} puntas={b.puntas} {activa} alTocar={(n) => activa && b.poner(activa, n)} />
    {:else if plano === undefined}
      <!-- 0.11: while the drawing loads, an empty place of about its size: «Este circuito no tiene dibujo» used to
           show for a moment and the drawing then pushed everything under it some 290 px down -->
      {#if tamano}
        <!-- as Plano lays out an automatic drawing (at most 1.3 × its width), with its hint under it -->
        <div class="reserva-plano exacta" aria-busy="true" style:aspect-ratio="{tamano[0]} / {tamano[1]}" style:max-width="{Math.round(tamano[0] * 1.3)}px"></div>
        {#if activa}<div class="reserva-ayuda" aria-hidden="true">Toque un nodo para poner la punta</div>{/if}
      {:else if tamano !== null}
        <div class="reserva-plano" aria-busy="true"></div>
      {/if}
    {:else}
      <p class="sin-dibujo">Este circuito no tiene dibujo: coloque las puntas con la lista de nodos.</p>
    {/if}
    <Conexiones {b} bind:activa />
    <div class="opciones">
      <label class="interruptor"><input type="checkbox" bind:checked={b.alimentado} /> Circuito alimentado</label>
      {#if b.fuenteGenerador}<span class="nota">El generador del FNIRSI excita <code>{b.fuenteGenerador}</code>.</span>{/if}
    </div>
    {#if b.avisoFusible}<p class="aviso">{b.avisoFusible} <button class="boton pequeno" onclick={() => { b.brymen.cambiarFusibles(); b.fnirsi.fusibleMA = true; b.avisoFusible = ''; }}>Cambiar los fusibles</button></p>{/if}
    {#each b.plan.avisos as a (a)}<p class="aviso">{a}</p>{/each}
    {#if b.error}<pre class="error">{b.error}</pre>{/if}
  </section>

  <div class="instrumentos">
    <Aparatos {b} alAuto={vivo.auto} {guiaBm} {guiaFn} bind:pestana />
    <Escuchar {b} />
  </div>

  {#if lateral}<div class="lateral bloque">{@render lateral()}</div>{/if}

  {#if parametros.length}
    <section class="bloque parametros">
      <Parametros {parametros} {rangos} alCambiar={cambiar} />
    </section>
  {/if}
  {@render barra?.()}
</div>
</div>

<style>
  .envoltura {
    container-type: inline-size;
  }
  .banco {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: 'circuito' 'instrumentos' 'lateral' 'parametros';
    gap: 14px;
    padding: 12px 16px 40px;
    max-width: 1500px;
    margin: 0 auto;
  }
  .banco.lateral-arriba {
    grid-template-areas: 'lateral' 'circuito' 'instrumentos' 'parametros';
  }
  .circuito {
    grid-area: circuito;
    min-width: 0;
  }
  .lateral {
    grid-area: lateral;
    min-width: 0;
  }
  .parametros {
    grid-area: parametros;
    min-width: 0;
  }
  .bloque {
    padding: 12px;
    border: 1px solid var(--linea);
    border-radius: 12px;
    background: var(--superficie);
  }
  .cab {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 8px;
  }
  h2 {
    margin: 0;
    font-family: var(--sans);
    font-size: 16px;
    color: var(--titulos);
  }
  .estado {
    font-family: var(--sans);
    font-size: 12.5px;
    color: var(--tinta-tenue);
  }
  .estado.error {
    color: var(--c-precaucion);
  }
  .reserva-plano {
    aspect-ratio: 5 / 2;
    max-height: 52vh;
  }
  .reserva-plano.exacta {
    width: 100%;
    max-height: none;
    margin: 0 auto;
  }
  /* the same box as Plano's «.ayuda» */
  .reserva-ayuda {
    margin-top: 6px;
    padding: 4px 10px;
    border-left: 4px solid transparent;
    font-family: var(--sans);
    font-size: 13px;
    visibility: hidden;
  }
  .sin-dibujo,
  .nota {
    font-family: var(--sans);
    font-size: 13px;
    color: var(--tinta-suave);
  }
  .opciones {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
    margin-top: 10px;
    font-family: var(--sans);
    font-size: 14px;
  }
  .interruptor {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 40px;
  }
  .interruptor input {
    width: 20px;
    height: 20px;
  }
  .aviso {
    font-family: var(--sans);
    font-size: 13.5px;
    color: var(--c-importante);
  }
  pre.error {
    white-space: pre-wrap;
    font-size: 12px;
    color: var(--c-precaucion);
  }
  .instrumentos {
    grid-area: instrumentos;
    min-width: 0;
  }
  .boton.pequeno {
    min-height: 32px;
    padding: 0 10px;
    font-size: 13px;
  }

  /* Wide: bench panel on the left, instruments on the right. */
  @container (min-width: 940px) {
    .banco {
      grid-template-columns: minmax(300px, 1fr) minmax(560px, 1.5fr);
      grid-template-areas: 'circuito instrumentos' 'lateral instrumentos' 'parametros instrumentos';
      grid-template-rows: auto auto 1fr;
    }
    .banco.lateral-arriba {
      grid-template-areas: 'circuito instrumentos' 'lateral instrumentos' 'parametros instrumentos';
    }
    .instrumentos {
      position: sticky;
      top: calc(var(--alto-barra) + 8px);
      align-self: start;
    }
  }
</style>
