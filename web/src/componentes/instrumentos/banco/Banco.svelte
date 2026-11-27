<script lang="ts">
  // The test bench view: the circuit drawn (tap a node to move the picked lead), the leads placed, the two instruments,
  // and (optionally) a guided practice. Simulates whenever the bench changes; the instruments read five (multimeters)
  // to eight (oscilloscope) times per second, only while the page is visible.
  // 2.1 «lavado de cara» (mock-ups Banco.png, BancoMovil.png): a title block («Banco · simulado en 31 ms», the circuit's
  // name and the page's buttons); on the left CIRCUITO (the schematic), PUNTAS PUESTAS (only the leads placed) and
  // folded rows (Medir en serie, component values, Escuchar, and the page's own); on the right the Brymen and the
  // FNIRSI exactly as drawn in 2.0. On a phone a segmented control shows the circuit or one instrument, big, with a
  // one-line summary of its leads that opens their editor.
  import type { Snippet } from 'svelte';
  import type { Banco, Punta } from '../banco.svelte.ts';
  import Plano, { type Fuente } from '../esquema/Plano.svelte';
  import Puntas, { resumenPuntas } from './Puntas.svelte';
  import Aparatos from './Aparatos.svelte';
  import Escuchar from './Escuchar.svelte';
  import { activarBanco } from './activo.svelte.ts';
  import { abrirEncima } from '../../../lib/encima';
  import { untrack } from 'svelte';
  import Parametros from '../../simulador/Parametros.svelte';
  import { listarParametros, aplicarParametro } from '../../../simulador/motor/netlist.ts';
  import { motor } from '../../../simulador/cliente.svelte';
  import { COLOR_PUNTA } from '../puntas';
  import type { GuiaBrymen, GuiaFnirsi } from '../guia';

  let {
    b,
    plano,
    titulo = '',
    antetitulo = 'Banco',
    volver = null,
    acciones,
    extra,
    plegables,
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
    /** 2.1: the page's title (the circuit, the practice) and the short line above it, before the simulation's state. */
    titulo?: string;
    antetitulo?: string;
    /** A way back when the bench was opened from somewhere else (the schematic editor). */
    volver?: { href: string; texto: string } | null;
    /** The page's buttons next to the title («Cambiar de circuito», «Usar un aparato real»). */
    acciones?: Snippet;
    /** What those buttons open, under the title block. */
    extra?: Snippet;
    /** The page's own folded rows, after the bench's («Registrador y comparación», «Diagnóstico»). */
    plegables?: Snippet;
    /** Practice panel, shown in the left column. */
    lateral?: Snippet;
    /**
     * Review 11c: on narrow screens the panel goes first (a lab's step had sat ~2 200 px down, under the circuit and
     * the instruments). Wide screens keep it in the left column.
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
      ? `descargando el motor… ${motor.descarga !== null ? Math.round(motor.descarga * 100) + ' %' : ''}`
      : motor.fase === 'preparando'
        ? 'preparando el motor…'
        : b.simulando
          ? 'simulando…'
          : b.error
            ? 'error en la simulación'
            : b.datos
              ? `simulado en ${b.datos.ms} ms`
              : '',
  );

  // ---------------------------------------------------------------- phone: circuit or one instrument
  /** On a phone (container under 640 px): the circuit, or the instrument of `pestana`. */
  let vista = $state<'circuito' | 'aparato'>('aparato');
  const segmento = $derived(vista === 'circuito' ? 'circuito' : pestana);
  function elegirSegmento(s: 'circuito' | 'brymen' | 'fnirsi') {
    if (s === 'circuito') vista = 'circuito';
    else {
      vista = 'aparato';
      pestana = s;
    }
  }
  // a lab that shows an instrument («Mostrar dónde») shows it on the phone too
  let pestanaAntes: string | undefined;
  $effect(() => {
    const p = pestana;
    if (pestanaAntes !== undefined && p !== pestanaAntes) vista = 'aparato';
    pestanaAntes = p;
  });
  function teclasSegmento(ev: KeyboardEvent) {
    const orden = ['circuito', 'brymen', 'fnirsi'] as const;
    const k = orden.indexOf(segmento);
    let n = -1;
    if (ev.key === 'ArrowRight') n = (k + 1) % 3;
    else if (ev.key === 'ArrowLeft') n = (k + 2) % 3;
    else if (ev.key === 'Home') n = 0;
    else if (ev.key === 'End') n = 2;
    else return;
    ev.preventDefault();
    elegirSegmento(orden[n]!);
    const raiz = ev.currentTarget as HTMLElement;
    queueMicrotask(() => raiz.querySelectorAll<HTMLElement>('[role="tab"]')[n]?.focus());
  }
  const resumen = $derived.by(() => {
    void b.tic;
    return resumenPuntas(b, pestana);
  });
  let editorMovil = $state(false);
  // 2.2: the phone's lead editor (opened from «Puntas: …») is on top: the system's back closes it first
  $effect(() => {
    if (!editorMovil) return;
    const quitar = abrirEncima('editor-puntas-movil', () => (editorMovil = false));
    return () => untrack(quitar);
  });

  // ---------------------------------------------------------------- «Medir en serie»: a meter in series with a terminal
  const opcionesSerie = $derived(
    b.circuito.elementos
      .filter((e) => e.tipo !== 'K')
      .flatMap((e) => e.terminales.map((t, i) => ({ v: `${e.nombre}#${i}`, t: `${e.nombre} · ${t.nombre} (nodo ${t.nodo})` }))),
  );
  function enSerie(m: 'bm' | 'fn', valor: string) {
    if (!valor) {
      if (m === 'bm') b.bm = { rojo: null, negro: null, serie: null };
      else b.fn = { rojo: null, negro: null, serie: null };
      return;
    }
    const [el, i] = valor.split('#');
    b.enSerie(m, el!, Number(i));
  }
</script>

<div class="envoltura">
<div class="banco" class:lateral-arriba={lateralArriba} class:cargando={!b.texto} data-segmento={segmento}>
  <header class="cabeza">
    <div class="cabeza21">
      {#if volver}<a class="volver" href={volver.href}>{volver.texto}</a>{/if}
      <p class="antetitulo21">{antetitulo}{#if estado}{' · '}<span class="estado" class:error={!!b.error} aria-live="polite">{estado}</span>{/if}</p>
      <h1 class="titulo21">{titulo}</h1>
    </div>
    {#if acciones}<div class="acciones">{@render acciones()}</div>{/if}
  </header>
  {#if extra}<div class="extra">{@render extra()}</div>{/if}

  <div class="segmentos" role="tablist" aria-label="Qué ver" tabindex="-1" onkeydown={teclasSegmento}>
    {#each [['circuito', 'Circuito'], ['brymen', 'Brymen'], ['fnirsi', 'FNIRSI']] as [s, t] (s)}
      <button type="button" role="tab" id="banco-seg-{s}" aria-selected={segmento === s} aria-controls={s === 'circuito' ? 'banco-panel-circuito' : 'banco-panel-aparato'} tabindex={segmento === s ? 0 : -1} onclick={() => elegirSegmento(s as 'circuito' | 'brymen' | 'fnirsi')}>{t}</button>
    {/each}
  </div>

  <section class="circuito" class:fuera={vista !== 'circuito'} id="banco-panel-circuito" aria-labelledby="banco-circuito-titulo">
    <div class="cab">
      <h2 class="etiqueta21" id="banco-circuito-titulo">Circuito</h2>
      <label class="interruptor"><input type="checkbox" bind:checked={b.alimentado} /> Circuito alimentado</label>
    </div>
    <div class="lamina-plano" data-recorrido="banco-dibujo">
      {#if plano}
        <Plano fuente={plano} puntas={b.puntas} {activa} alTocar={(n) => activa && b.poner(activa, n)} alSoltar={(p, n) => b.poner(p as Punta, n)} />
      {:else if plano === undefined}
        <!-- 0.11: while the drawing loads, an empty place of about its size: «Este circuito no tiene dibujo» used to
             show for a moment and the drawing then pushed everything under it some 290 px down -->
        {#if tamano}
          <!-- as Plano lays out an automatic drawing (at most 1.3 × its width) -->
          <div class="reserva-plano exacta" aria-busy="true" style:aspect-ratio="{tamano[0]} / {tamano[1]}" style:max-width="{Math.round(tamano[0] * 1.3)}px"></div>
        {:else if tamano !== null}
          <div class="reserva-plano" aria-busy="true"></div>
        {/if}
      {:else}
        <p class="sin-dibujo">Este circuito no tiene dibujo: coloque las puntas con la lista de nodos de cada punta.</p>
      {/if}
    </div>
    {#if b.fuenteGenerador}<p class="nota">El generador del FNIRSI excita <code>{b.fuenteGenerador}</code>.</p>{/if}
  </section>

  {#if b.avisoFusible || b.plan.avisos.length || b.error}<div class="avisos">
    {#if b.avisoFusible}<p class="aviso aviso21 mal">{b.avisoFusible} <button class="boton pequeno" onclick={() => { b.brymen.cambiarFusibles(); b.fnirsi.fusibleMA = true; b.avisoFusible = ''; }}>Cambiar los fusibles</button></p>{/if}
    {#each b.plan.avisos as a (a)}<p class="aviso aviso21 mal">{a}</p>{/each}
    {#if b.error}<pre class="error">{b.error}</pre>{/if}
  </div>{/if}

  <!-- (while the circuit loads, its leads' place is kept: four rows, as a catalogue circuit starts with) -->
  <div class="puntas" class:fuera={vista !== 'circuito'} class:reserva={!b.texto} data-recorrido="banco-puntas">
    <Puntas {b} bind:activa />
  </div>

  <div class="instrumentos" class:fuera={vista === 'circuito'} id="banco-panel-aparato">
    <Aparatos {b} alAuto={vivo.auto} {guiaBm} {guiaFn} bind:pestana pestanas={false} />
    <div class="resumen-movil">
      <button type="button" class="resumen" aria-expanded={editorMovil} aria-controls="banco-editor-movil" onclick={() => (editorMovil = !editorMovil)} data-resumen-puntas>
        <span class="puntos" aria-hidden="true">{#each resumen.puntas as p (p)}<span style:background={p === 'bmNegro' ? 'var(--v11-tinta)' : COLOR_PUNTA[p]}></span>{/each}</span>
        <span class="texto"
          >Puntas:{#if resumen.serie}{' '}en serie con <span class="mono">{resumen.serie}</span>{:else if resumen.texto.length}{#each resumen.texto as t, i (t.nombre)}{i ? ', ' : ' '}{t.nombre} en <span class="mono">{t.nodo}</span>{/each}{:else}{' '}ninguna puesta{/if}</span
        >
        <span class="chevron" class:abierto={editorMovil} aria-hidden="true"></span>
      </button>
      {#if editorMovil}
        <div id="banco-editor-movil" class="editor-movil">
          <Puntas {b} bind:activa id="puntas-movil" />
        </div>
      {/if}
    </div>
  </div>

  {#if lateral}<div class="lateral">{@render lateral()}</div>{/if}

  <div class="plegables" class:fuera={vista !== 'circuito'}>
    <details class="plegable21" data-plegable="serie">
      <summary>Medir en serie</summary>
      <div class="plegable21-cuerpo serie">
        <p class="nota">Para medir corriente, el aparato se pone en serie con un terminal de una pieza (abre el circuito ahí y lo cierra a través de él).</p>
        <label>
          <span>Brymen en serie con</span>
          <select value={b.bm.serie ? `${b.bm.serie.elemento}#${b.bm.serie.terminal}` : ''} onchange={(e) => enSerie('bm', (e.currentTarget as HTMLSelectElement).value)}>
            <option value="">— (en paralelo, entre dos nodos)</option>
            {#each opcionesSerie as o (o.v)}<option value={o.v}>{o.t}</option>{/each}
          </select>
        </label>
        <label>
          <span>Multímetro del FNIRSI en serie con</span>
          <select value={b.fn.serie ? `${b.fn.serie.elemento}#${b.fn.serie.terminal}` : ''} onchange={(e) => enSerie('fn', (e.currentTarget as HTMLSelectElement).value)}>
            <option value="">— (en paralelo, entre dos nodos)</option>
            {#each opcionesSerie as o (o.v)}<option value={o.v}>{o.t}</option>{/each}
          </select>
        </label>
      </div>
    </details>
    {#if parametros.length}
      <details class="plegable21" data-plegable="valores">
        <summary>Valores de los componentes</summary>
        <div class="plegable21-cuerpo parametros">
          <Parametros {parametros} {rangos} alCambiar={cambiar} />
        </div>
      </details>
    {/if}
    <details class="plegable21" data-plegable="escuchar">
      <summary>Escuchar</summary>
      <div class="plegable21-cuerpo">
        <Escuchar {b} plano />
      </div>
    </details>
    {@render plegables?.()}
  </div>
  {@render barra?.()}
</div>
</div>

<style>
  .envoltura {
    container-type: inline-size;
    font-family: var(--sans);
  }
  /* Phone and narrow: one column. Wide (below): the left column and the instruments. */
  .banco {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: 'cabeza' 'extra' 'segmentos' 'circuito' 'avisos' 'puntas' 'instrumentos' 'lateral' 'plegables';
    row-gap: 0;
    column-gap: var(--e21-6);
    max-width: 1500px;
    margin: 0 auto;
    padding: var(--e21-4) var(--e21-margen) var(--e21-6);
  }
  .banco.lateral-arriba {
    grid-template-areas: 'cabeza' 'extra' 'lateral' 'segmentos' 'circuito' 'avisos' 'puntas' 'instrumentos' 'plegables';
  }
  /* (0.12 QA's rule: nothing moves when the circuit arrives. Its name may take two lines where «Banco de pruebas» took
     one, so until the circuit is loaded only the title block shows; the rest keeps its place, unseen) */
  .banco.cargando > :global(:not(.cabeza)),
  .banco.cargando .acciones {
    visibility: hidden;
  }
  /* The guided lab's step bar (practicas/PanelLaboratorio.svelte, sticky at the bottom on narrow screens): a sticky grid
     item cannot leave its grid area, and in a row of its own it stayed at the end of the page — with the instrument on
     screen there was no «Comprobar» (2.1 close-out). It spans every row, at their end, so it sticks over the whole
     bench; the last rows keep room for it (below, under 940 px, where it shows). */
  .banco > :global(.barra-paso) {
    grid-row: 1 / -1;
    grid-column: 1 / -1;
    align-self: end;
    /* (right over the bottom bar, as in 2.0: not the parts' own space under them) */
    margin-bottom: 0;
  }
  @container (max-width: 939px) {
    .banco:has(> :global(.barra-paso)) {
      padding-bottom: calc(var(--e21-6) + 128px);
    }
  }
  /* (no row gap: an area left empty would still add one; each part keeps its space under it) */
  .banco > :global(*) {
    margin-bottom: var(--e21-4);
  }
  .cabeza {
    grid-area: cabeza;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--e21-2) var(--e21-3);
    min-width: 0;
  }
  .volver {
    align-self: flex-start;
    font-size: 15px;
    font-weight: 500;
    color: var(--v11-azul);
    text-decoration: none;
  }
  .acciones {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }
  .extra {
    grid-area: extra;
    min-width: 0;
  }
  .estado.error {
    color: var(--v11-mal-texto);
  }
  .segmentos {
    grid-area: segmentos;
    display: none;
  }
  .circuito {
    grid-area: circuito;
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
  }
  .cab {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px 16px;
  }
  .interruptor {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 48px;
    color: var(--v11-tinta-suave);
    font-size: 14px;
  }
  .interruptor input {
    width: 20px;
    height: 20px;
    accent-color: var(--v11-azul);
  }
  /* the schematic on its sheet (the drawing itself is that of 2.0) */
  .lamina-plano {
    padding: 16px;
    border-radius: 14px;
    background: var(--v11-panel);
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
  .sin-dibujo,
  .nota {
    margin: 0;
    font-size: 15px;
    color: var(--v11-tinta-suave);
  }
  .avisos {
    grid-area: avisos;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }
  .aviso .boton {
    margin-left: 8px;
  }
  pre.error {
    margin: 0;
    white-space: pre-wrap;
    font-size: 13px;
    color: var(--v11-mal-texto);
  }
  .puntas {
    grid-area: puntas;
    min-width: 0;
  }
  /* (0.12 QA's rule, kept in 2.1: nothing under the circuit moves when it arrives; the list of a catalogue circuit's
     four leads with its button is 276 px high) */
  .puntas.reserva {
    min-height: 276px;
  }
  .instrumentos {
    grid-area: instrumentos;
    min-width: 0;
    /* (desktop: the sizes of 2.0, Brymen 300 px and FNIRSI 360 px wide, where the window is tall enough) */
    --alto-aparato: min(700px, calc(100svh - 160px));
  }
  .lateral {
    grid-area: lateral;
    min-width: 0;
  }
  .plegables {
    grid-area: plegables;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .serie {
    display: grid;
    gap: 12px;
  }
  .serie label {
    display: grid;
    gap: 4px;
    font-size: 13px;
    color: var(--v11-tinta-suave);
  }
  .serie select {
    min-width: 0;
    max-width: 100%;
    min-height: 48px;
    border: 1px solid var(--v11-linea);
    border-radius: 12px;
    background: transparent;
    color: var(--v11-tinta);
    padding: 0 10px;
    font-size: 15px;
  }
  .resumen-movil {
    display: none;
  }

  /* ---------------------------------------------------------------- phone */
  @container (max-width: 639px) {
    /* (the phone: a tighter top, so a lab's step stays in the first screen) */
    .banco {
      padding-top: var(--e21-2);
    }
    .banco > :global(*) {
      margin-bottom: var(--e21-3);
    }
    .banco > .cabeza {
      margin-bottom: var(--e21-2);
    }
    /* (the page's buttons stay in every segment: the real instruments matter most next to the drawn ones) */
    .acciones :global(.boton) {
      min-height: 48px;
      padding: 0 14px;
      font-size: 14px;
    }
    .segmentos {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      padding: 4px;
      border-radius: 14px;
      background: var(--v11-panel);
    }
    .segmentos button {
      min-height: 48px;
      border: 0;
      border-radius: 10px;
      background: transparent;
      color: var(--v11-tinta-suave);
      font: inherit;
      font-size: 15px;
      font-weight: 500;
    }
    .segmentos button[aria-selected='true'] {
      background: var(--v11-linea);
      color: var(--v11-tinta);
      font-weight: 600;
    }
    .segmentos button:focus-visible {
      outline: 2px solid var(--v11-foco);
      outline-offset: -2px;
    }
    .fuera {
      display: none;
    }
    .instrumentos {
      --alto-aparato: min(520px, calc(100svh - 360px));
    }
    .resumen-movil {
      display: block;
      margin-top: var(--e21-3);
    }
    .resumen {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      min-height: 56px;
      padding: 0;
      border: 0;
      border-top: 1px solid var(--v11-linea);
      border-bottom: 1px solid var(--v11-linea);
      background: transparent;
      color: var(--v11-tinta);
      font: inherit;
      font-size: 16px;
      text-align: left;
    }
    .resumen .puntos {
      display: flex;
      gap: 4px;
    }
    .resumen .puntos span {
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }
    .resumen .texto {
      flex: 1;
      min-width: 0;
    }
    .mono {
      font-family: var(--mono);
      color: var(--v11-azul);
    }
    .chevron {
      flex: none;
      width: 8px;
      height: 8px;
      margin-right: 8px;
      border-right: 1.8px solid var(--v11-borde);
      border-bottom: 1.8px solid var(--v11-borde);
      transform: rotate(-45deg);
    }
    .chevron.abierto {
      transform: rotate(45deg);
    }
    .editor-movil {
      padding-top: var(--e21-2);
    }
  }

  /* ---------------------------------------------------------------- wide: left column, instruments on the right */
  @container (min-width: 940px) {
    .banco {
      grid-template-columns: minmax(340px, 400px) minmax(0, 1fr);
      grid-template-areas:
        'cabeza cabeza'
        'extra extra'
        'circuito instrumentos'
        'avisos instrumentos'
        'puntas instrumentos'
        'lateral instrumentos'
        'plegables instrumentos';
      grid-template-rows: auto auto auto auto auto auto 1fr;
    }
    .banco.lateral-arriba {
      grid-template-areas:
        'cabeza cabeza'
        'extra extra'
        'circuito instrumentos'
        'avisos instrumentos'
        'puntas instrumentos'
        'lateral instrumentos'
        'plegables instrumentos';
    }
    .instrumentos {
      position: sticky;
      top: calc(var(--alto-barra) + 8px);
      align-self: start;
    }
  }
</style>
