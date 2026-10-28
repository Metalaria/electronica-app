<script lang="ts">
  // «Medir» on the breadboard (0.10). The real instruments (Brymen BM869s, FNIRSI 2C53T, an earphone) of
  // componentes/instrumentos/, used as in the lab: turn the dial, plug the red lead into the right jack, put
  // the probes into holes (or drag them), open the circuit to put an ammeter in series. «¿Qué quieres
  // medir?» is a tutor (tutor.svelte.ts): it says and shows each step, ticks it when done and explains
  // mistakes; «Hazlo por mí» only as a last resort.
  import { untrack } from 'svelte';
  import type { Protoboard } from './estado.svelte';
  import type { MedidaProtoboard } from './medida.svelte.ts';
  import { Tutor, TAREAS, erroresMedida, type Tarea } from './tutor.svelte.ts';
  import Aparatos from '../instrumentos/banco/Aparatos.svelte';
  import Escuchar from '../instrumentos/banco/Escuchar.svelte';
  import { activarBanco } from '../instrumentos/banco/activo.svelte.ts';
  import { COLOR_PUNTA, LETRA_PUNTA, NOMBRE_PUNTA_PROTO, PUNTAS_PROTO, type PuntaProto } from '../instrumentos/puntas.ts';
  import { autoHorizontal } from '../instrumentos/motor/osciloscopio.ts';
  import { frecuencia, type Serie } from '../instrumentos/motor/senal.ts';
  import { motor } from '../../simulador/cliente.svelte';

  let { pb, medida }: { pb: Protoboard; medida: MedidaProtoboard } = $props();

  // svelte-ignore state_referenced_locally
  const b = medida.b;
  // svelte-ignore state_referenced_locally
  const vivo = activarBanco(b);
  // svelte-ignore state_referenced_locally
  const tutor = new Tutor(pb, medida);
  // svelte-ignore state_referenced_locally
  medida.tutor = tutor;
  // For the tests: the instruments of the board.
  $effect(() => {
    const g = globalThis as unknown as { __epaMedida?: unknown };
    g.__epaMedida = { medida, tutor, b, auto };
    return () => {
      if ((g.__epaMedida as { medida?: unknown } | undefined)?.medida === medida) delete g.__epaMedida;
    };
  });

  // The bench follows the board and the leads.
  $effect(() => {
    void pb.nl;
    void medida.puntas;
    untrack(() => medida.sincronizar());
  });

  // ---------------------------------------------------------------- the oscilloscope's AUTO
  // As the real one: it looks at the signal and chooses time base, V/div and trigger. With a known source
  // frequency the bench's AUTO is enough; otherwise (a 555, an oscillator) the frequency is found on what was
  // simulated, widening the time base until whole periods appear.
  let autoPendiente = $state(false);
  function autoCompleto(): boolean {
    const d = b.datos;
    if (!d || d.plan.netlist !== b.plan.netlist) return false;
    const { entradas } = b.entradasOsc();
    const e = entradas.find((x) => x !== null) ?? null;
    if (e === null) return true;
    const f = b.fnirsi;
    // Done when the time base did not change: then V/div and the trigger come from what is on the screen.
    const antes = f.sDiv;
    if (b.plan.fBase || typeof e === 'number') {
      vivo.auto();
      return f.sDiv === antes;
    }
    const s = e as Serie;
    let max = -Infinity;
    let min = Infinity;
    for (const v of s.y) {
      if (v > max) max = v;
      if (v < min) min = v;
    }
    const r = max - min > 1e-6 ? frecuencia(s, (max + min) / 2, (max - min) * 0.1) : null;
    if (r && r.n >= 2) {
      f.pulsarAuto(entradas, r.f);
      return f.sDiv === antes;
    }
    // No whole periods yet: a slower time base, up to 1 s/div.
    if (max - min > 1e-6 && f.sDiv < 1) {
      f.sDiv = Math.min(1, autoHorizontal(1 / (12 * f.sDiv * 10)));
      return false;
    }
    f.pulsarAuto(entradas, null);
    return true;
  }
  $effect(() => {
    void b.version;
    if (!autoPendiente) return;
    untrack(() => {
      if (autoCompleto() || ++intentosAuto > 5) autoPendiente = false;
    });
  });
  let intentosAuto = 0;
  function auto() {
    tutor.autoPulsado = true;
    autoPendiente = true;
    intentosAuto = 0;
    if (autoCompleto()) autoPendiente = false;
  }

  // ---------------------------------------------------------------- the tutor
  const pasos = $derived(tutor.pasos);
  const actual = $derived(tutor.actual);
  const paso = $derived(actual >= 0 ? pasos[actual] : undefined);
  let pestanaAparato = $state<'brymen' | 'fnirsi'>('brymen');
  // The probe «in hand» and the instrument shown follow the step.
  $effect(() => {
    const p = paso;
    untrack(() => {
      if (p?.punta) medida.activa = p.punta;
      if (p?.bm || ['tension', 'tensionPieza', 'corriente', 'resistencia'].includes(tutor.tarea ?? '')) pestanaAparato = 'brymen';
      if (p?.fn || tutor.tarea === 'senal') pestanaAparato = 'fnirsi';
    });
  });
  // A step on an instrument (the dial, a jack, a button): bring the instrument into view.
  let aparatos: HTMLDivElement | undefined = $state();
  let pasoVisto = '';
  $effect(() => {
    const p = paso;
    const k = p ? `${tutor.tarea}:${p.id}` : '';
    if (k === pasoVisto) return;
    pasoVisto = k;
    if ((p?.bm || p?.fn) && aparatos) untrack(() => aparatos!.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  });
  function empezar(t: Tarea) {
    tutor.empezar(tutor.tarea === t ? null : t);
    pb.sel = [];
  }

  // Mistakes, explained, with what to do instead.
  const errores = $derived.by(() => {
    void b.tic;
    void b.version;
    return erroresMedida(medida, {
      enSerie: (pieza) => {
        b.brymen.cambiarFusibles();
        b.fnirsi.fusibleMA = true;
        b.avisoFusible = '';
        medida.quitar('bmRojo');
        medida.quitar('bmNegro');
        tutor.empezar('corriente');
        if (pieza) tutor.elegir({ t: 'pieza', id: pieza });
      },
    });
  });

  const puntasSueltas = $derived(PUNTAS_PROTO.filter((p) => medida.puntas[p] && medida.nodoDe(p) === null));

  // ---------------------------------------------------------------- first-use hint (per device)
  let pista = $state((() => {
    try {
      return localStorage.getItem('epa:medir-pista') !== 'vista';
    } catch {
      return true;
    }
  })());
  function cerrarPista() {
    pista = false;
    try {
      localStorage.setItem('epa:medir-pista', 'vista');
    } catch {
      /* private mode */
    }
  }

  const estado = $derived(
    motor.fase === 'descargando'
      ? 'Descargando el simulador…'
      : motor.fase === 'preparando'
        ? 'Preparando ngspice…'
        : b.simulando
          ? 'Midiendo…'
          : b.error
            ? 'Error en la simulación'
            : b.datos
              ? `Simulado en ${b.datos.ms} ms`
              : '',
  );
  let mano = $state(false);
</script>

<div class="medir">
  {#if pista}
    <div class="pista" role="note">
      <p>Aquí se mide como en el laboratorio: gire el selector, ponga la punta roja en el borne que toca y lleve las puntas a los agujeros (tóquelos, o arrastre las puntas). Si no sabe por dónde empezar, elija abajo qué quiere medir: se lo irá enseñando paso a paso.</p>
      <button type="button" class="cerrar" aria-label="Cerrar la pista" onclick={cerrarPista}>✕</button>
    </div>
  {/if}

  <section class="que" aria-label="¿Qué quieres medir?">
    <h3>¿Qué quieres medir?</h3>
    <div class="tareas">
      {#each TAREAS as t (t.id)}
        <button type="button" class="tarea" data-tarea={t.id} aria-pressed={tutor.tarea === t.id} onclick={() => empezar(t.id)}>
          <span class="titulo">{t.titulo}</span><span class="detalle">{t.detalle}</span>
        </button>
      {/each}
    </div>
    {#if tutor.tarea}
      <ol class="pasos" aria-live="polite">
        {#each pasos as p, i (p.id)}
          {@const hecho = p.hecho()}
          <li class:hecho class:actual={i === actual} data-paso={p.id}>
            <span class="marca" aria-hidden="true">{hecho ? '✓' : i === actual ? '▶' : i + 1}</span>
            <span class="texto">
              {p.texto}
              {#if i === actual && p.porque}<span class="porque">{p.porque}</span>{/if}
            </span>
          </li>
        {/each}
      </ol>
      {#if tutor.terminado}
        <p class="explicacion" data-explicacion>{tutor.explicacion}</p>
      {/if}
      <div class="acciones-tutor">
        {#if paso?.hacer && !tutor.terminado}
          <button type="button" class="boton secundario" disabled={tutor.haciendo} onclick={() => void tutor.hazloPorMi()}>Hazlo por mí</button>
        {/if}
        <button type="button" class="boton" onclick={() => tutor.empezar(null)}>{tutor.terminado ? 'Otra medida' : 'Dejarlo'}</button>
      </div>
    {/if}
  </section>

  {#each errores as e, i (i)}
    <div class="error-medida" role="alert">
      <p>{e.texto}</p>
      {#if e.accion}<button type="button" class="boton pequeno" onclick={e.accion.hacer}>{e.accion.etiqueta}</button>{/if}
      {#if /fusible/.test(e.texto)}
        <button
          type="button"
          class="boton pequeno"
          onclick={() => {
            b.brymen.cambiarFusibles();
            b.fnirsi.fusibleMA = true;
            b.avisoFusible = '';
          }}>Cambiar los fusibles</button
        >
      {/if}
    </div>
  {/each}

  <div class="aparatos" bind:this={aparatos}>
    <Aparatos {b} alAuto={auto} bind:pestana={pestanaAparato} guiaBm={paso?.bm ?? null} guiaFn={paso?.fn ?? null} />
  </div>

  <div class="opciones">
    <label class="interruptor"><input type="checkbox" bind:checked={b.alimentado} /> Alimentación encendida</label>
    <span class="estado" aria-live="polite">{estado}</span>
  </div>

  <details class="mano" bind:open={mano}>
    <summary>Puntas y sondas ({Object.keys(medida.puntas).length} puestas)</summary>
    <p class="nota">La punta elegida va al agujero que toque; una punta puesta se puede arrastrar a otro.</p>
    <div class="puntas" role="radiogroup" aria-label="Punta que se va a colocar">
      {#each PUNTAS_PROTO as p (p)}
        {@const q = medida.puntas[p]}
        {@const n = q ? medida.nodoDe(p) : null}
        <button
          type="button"
          class="punta"
          role="radio"
          aria-checked={medida.activa === p}
          data-punta={p}
          style={`--c:${COLOR_PUNTA[p]}`}
          onclick={() => (medida.activa = p)}
          title={NOMBRE_PUNTA_PROTO[p]}
        >
          <span class="disco">{LETRA_PUNTA[p]}</span>
          <span class="txt">{NOMBRE_PUNTA_PROTO[p].replace(' · ', ' ')}</span>
          <span class="nodo">{!q ? '—' : n === null ? 'al aire' : n}</span>
        </button>
      {/each}
    </div>
    {#if medida.activa && medida.puntas[medida.activa]}
      {@const a = medida.activa as PuntaProto}
      <button type="button" class="boton quitar" onclick={() => medida.quitar(a)}>Quitar {NOMBRE_PUNTA_PROTO[a].toLowerCase()}</button>
    {/if}
  </details>
  {#if !mano && medida.activa}
    <p class="en-mano" style={`--c:${COLOR_PUNTA[medida.activa]}`}><span class="disco">{LETRA_PUNTA[medida.activa]}</span> En la mano: {NOMBRE_PUNTA_PROTO[medida.activa].toLowerCase()}. Toque un agujero para ponerla.</p>
  {/if}

  {#each puntasSueltas as p (p)}
    <p class="nota">{NOMBRE_PUNTA_PROTO[p]}: está en una tira vacía, no toca nada.</p>
  {/each}
  {#if (b.sondas.ch1 || b.sondas.ch2) && !medida.puntas.masa}
    <p class="nota">La pinza de masa de la sonda no está puesta: se mide respecto a la masa del circuito (con una de verdad, sin pinza, la medida sería ruido).</p>
  {/if}
  {#if b.fuenteGenerador}<p class="nota">El generador del FNIRSI alimenta el circuito por sus puntas (forma, frecuencia y amplitud en su modo generador).</p>{/if}
  {#each b.plan.avisos as a (a)}<p class="aviso">{a}</p>{/each}
  {#if b.error}<pre class="error">{b.error}</pre>{/if}

  <Escuchar {b} pista="Ponga el auricular (♪) en un agujero, o una sonda del osciloscopio, para oír su señal." />
</div>

<style>
  .medir {
    container-type: inline-size;
    font-family: var(--sans);
  }
  .pista {
    position: relative;
    margin-bottom: 10px;
    padding: 10px 40px 10px 12px;
    border-radius: 12px;
    background: var(--acento-tinte);
    font-size: 13.5px;
    line-height: 1.4;
  }
  .pista p {
    margin: 0;
  }
  .cerrar {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 36px;
    height: 36px;
    border: 0;
    background: none;
    font-size: 16px;
    color: var(--tinta-suave);
  }
  h3 {
    margin: 0 0 8px;
    font-size: 15px;
    color: var(--titulos);
  }
  .tareas {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 6px;
  }
  .tarea {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    min-height: 52px;
    padding: 6px 10px;
    border: 1px solid var(--linea);
    border-radius: 10px;
    background: var(--superficie);
    color: var(--tinta);
    font: inherit;
    text-align: left;
  }
  .tarea[aria-pressed='true'] {
    border-color: var(--acento);
    background: var(--acento-tinte);
  }
  .tarea .titulo {
    font-size: 14px;
    font-weight: 600;
  }
  .tarea .detalle {
    font-size: 12px;
    color: var(--tinta-suave);
  }
  .pasos {
    margin: 10px 0 6px;
    padding: 0;
    list-style: none;
  }
  .pasos li {
    display: flex;
    gap: 8px;
    padding: 6px 4px;
    border-radius: 8px;
    font-size: 14px;
    line-height: 1.35;
    color: var(--tinta-suave);
  }
  .pasos li.actual {
    background: color-mix(in srgb, #ffd34d 22%, var(--superficie));
    color: var(--tinta);
    font-weight: 600;
  }
  .pasos li.hecho {
    color: var(--tinta);
  }
  .marca {
    flex: none;
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 1px solid var(--linea);
    font-size: 12px;
  }
  .hecho .marca {
    border-color: #2e9a4a;
    background: #2e9a4a;
    color: #fff;
  }
  .porque {
    display: block;
    margin-top: 2px;
    font-weight: 400;
    font-size: 12.5px;
    color: var(--tinta-suave);
  }
  .explicacion {
    margin: 6px 0;
    padding: 8px 10px;
    border-left: 4px solid #2e9a4a;
    border-radius: 6px;
    background: var(--superficie-2);
    font-size: 14.5px;
    font-weight: 600;
    color: var(--tinta);
  }
  .acciones-tutor {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .error-medida {
    margin: 8px 0;
    padding: 8px 10px;
    border: 1px solid color-mix(in srgb, var(--c-importante) 50%, transparent);
    border-radius: 10px;
    background: color-mix(in srgb, var(--c-importante) 8%, var(--superficie));
    font-size: 13.5px;
    line-height: 1.4;
  }
  .error-medida p {
    margin: 0 0 6px;
  }
  .error-medida .boton {
    margin-right: 6px;
  }
  .nota {
    margin: 4px 0 8px;
    font-size: 13px;
    color: var(--tinta-suave);
  }
  .mano summary {
    min-height: 40px;
    display: flex;
    align-items: center;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }
  .puntas {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 6px;
  }
  .punta {
    display: flex;
    align-items: center;
    gap: 7px;
    min-height: 44px;
    padding: 4px 8px;
    border: 1px solid var(--linea);
    border-radius: 10px;
    background: var(--superficie);
    color: var(--tinta);
    font: inherit;
    font-size: 13px;
    text-align: left;
  }
  .punta[aria-checked='true'] {
    border-color: var(--c);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--c) 35%, transparent);
  }
  .disco {
    flex: none;
    display: inline-grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: var(--c);
    color: #fff;
    font-weight: 700;
  }
  .txt {
    flex: 1;
    min-width: 0;
    line-height: 1.2;
  }
  .nodo {
    font-family: var(--mono);
    font-size: 12px;
    color: var(--tinta-suave);
  }
  .quitar {
    margin-top: 8px;
  }
  .en-mano {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 4px 0;
    font-size: 13.5px;
  }
  .opciones {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin: 10px 0 6px;
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
  .estado {
    font-size: 12.5px;
    color: var(--tinta-suave);
  }
  .aviso {
    margin: 6px 0;
    font-size: 13.5px;
    color: var(--c-importante);
  }
  pre.error {
    white-space: pre-wrap;
    font-size: 12px;
    color: var(--c-precaucion);
  }
  .boton.pequeno {
    min-height: 34px;
    padding: 0 10px;
    font-size: 13px;
  }
  .aparatos {
    margin-top: 10px;
  }
</style>
