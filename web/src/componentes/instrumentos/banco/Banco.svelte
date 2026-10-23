<script lang="ts">
  // The test bench view: the circuit drawn (tap a node to place the selected lead), the leads and probes,
  // the component values, the two instruments, and (optionally) a guided practice. Simulates whenever the
  // bench changes; the instruments read five (multimeters) to eight (oscilloscope) times per second, only
  // while the page is visible.
  import { onMount, untrack, type Snippet } from 'svelte';
  import type { Banco, Punta } from '../banco.svelte.ts';
  import Plano, { type Fuente } from '../esquema/Plano.svelte';
  import Conexiones from './Conexiones.svelte';
  import BrymenVista from '../brymen/Brymen.svelte';
  import FnirsiVista from '../fnirsi/Fnirsi.svelte';
  import Parametros from '../../simulador/Parametros.svelte';
  import { listarParametros, aplicarParametro } from '../../../simulador/motor/netlist.ts';
  import { motor } from '../../../simulador/cliente.svelte';
  import { tono, pitido } from '../audio';
  import { formatoSI } from '../../grafica';

  let {
    b,
    plano,
    lateral,
  }: {
    b: Banco;
    plano: Fuente | null;
    /** Practice panel or circuit chooser, shown next to the bench. */
    lateral?: Snippet;
  } = $props();

  let activa = $state<Punta | null>('bmRojo');
  let pestana = $state<'brymen' | 'fnirsi'>('fnirsi');

  // ---------------------------------------------------------------- simulation
  $effect(() => {
    const n = b.plan.netlist;
    untrack(() => b.pedir(n));
  });

  // ---------------------------------------------------------------- readings
  function leerMultimetros() {
    b.brymen.leer(b.senalDmm('bm'));
    b.fnirsi.leerDmm(b.senalDmm('fn'));
    tono(b.brymen.pantalla.pitido);
    b.leido = b.version;
    b.tic++;
  }
  function adquirir() {
    const { entradas, inicio, fin } = b.entradasOsc();
    b.fnirsi.adquirir(entradas, inicio, fin);
  }
  // A new result or a change of the oscilloscope's settings: read and acquire at once.
  $effect(() => {
    void b.version;
    const f = b.fnirsi;
    void [f.sDiv, f.hpos, f.disparo, f.modo, f.run, f.esperando, f.encendido, ...f.canales.map((c) => [c.vDiv, c.pos, c.on, c.invertir, c.menuX10])];
    untrack(() => {
      adquirir();
      leerMultimetros();
    });
  });
  // BeepJack.
  let ultimoBeep = 0;
  $effect(() => {
    const n = b.brymen.beepJack;
    if (n !== ultimoBeep) {
      ultimoBeep = n;
      pitido(450);
    }
  });

  onMount(() => {
    const visible = () => document.visibilityState === 'visible';
    const t1 = setInterval(() => visible() && leerMultimetros(), 200);
    const t2 = setInterval(() => {
      const f = b.fnirsi;
      if (!visible() || f.modo !== 'osc' || (!f.run && !f.esperando)) return;
      adquirir();
    }, 125);
    const oculto = () => !visible() && tono(false);
    document.addEventListener('visibilitychange', oculto);
    return () => {
      clearInterval(t1);
      clearInterval(t2);
      document.removeEventListener('visibilitychange', oculto);
      tono(false);
      b.cancelar();
    };
  });

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

  function auto() {
    const { entradas } = b.entradasOsc();
    b.fnirsi.pulsarAuto(entradas, b.plan.fBase ?? (b.fuenteGenerador ? b.fnirsi.dds.frecuencia : null));
  }

  // ---------------------------------------------------------------- readouts under the instruments
  const infoOsc = $derived.by(() => {
    const f = b.fnirsi;
    const W = 12 * f.sDiv;
    const fs = Math.min(250e6, 1000 / W);
    return `Muestreo real ${formatoSI(fs, 'S/s', 3)} (1 000 puntos en ${formatoSI(W, 's', 3)}): sin alias hasta ${formatoSI(fs / 2, 'Hz', 3)}`;
  });
  const infoBm = $derived.by(() => {
    void b.tic;
    const l = b.brymen.pantalla.principal;
    if (!l || l.valor === null) return '';
    const inc = l.incertidumbre;
    const base = l.unidad.replace(/^[kMmµn](?=[VAΩFHS])/, '');
    return `Brymen: ${l.texto.replace('.', ',')} ${l.unidad}${inc !== null ? ` ± ${formatoSI(inc, base, 2)} según el manual` : ''}`;
  });
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
<div class="banco">
  <section class="bloque circuito" aria-label="Circuito">
    <div class="cab">
      <h3>Circuito</h3>
      <span class="estado" class:error={!!b.error} aria-live="polite">{estado}</span>
    </div>
    {#if plano}
      <Plano fuente={plano} puntas={b.puntas} {activa} alTocar={(n) => activa && b.poner(activa, n)} />
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
    <div class="pestanas" role="tablist" aria-label="Instrumentos">
      <button role="tab" aria-selected={pestana === 'brymen'} onclick={() => (pestana = 'brymen')}>Brymen BM869s</button>
      <button role="tab" aria-selected={pestana === 'fnirsi'} onclick={() => (pestana = 'fnirsi')}>FNIRSI 2C53T</button>
    </div>
    <div class="par">
      <figure class="instrumento brymen" class:oculto={pestana !== 'brymen'}>
        <BrymenVista m={b.brymen} />
        <figcaption>{infoBm || 'Brymen BM869s · 50 000 cuentas · 10 MΩ'}</figcaption>
      </figure>
      <figure class="instrumento fnirsi" class:oculto={pestana !== 'fnirsi'}>
        <FnirsiVista f={b.fnirsi} alAuto={auto} />
        <figcaption>{b.fnirsi.modo === 'osc' ? infoOsc : b.fnirsi.modo === 'gen' ? 'Generador DDS: 1 Hz … 50 kHz, 0,1 … 3 V (de 0 a la amplitud)' : 'Multímetro del 2C53T: 19 999 cuentas'}</figcaption>
      </figure>
    </div>
  </div>

  {#if lateral}<div class="lateral bloque">{@render lateral()}</div>{/if}

  {#if parametros.length}
    <section class="bloque parametros">
      <Parametros {parametros} {rangos} alCambiar={cambiar} />
    </section>
  {/if}
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
  h3 {
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
  .pestanas {
    display: flex;
    gap: 6px;
    margin-bottom: 8px;
  }
  .pestanas button {
    flex: 1;
    min-height: 44px;
    border: 1px solid var(--linea);
    border-radius: 10px;
    background: var(--superficie);
    font-family: var(--sans);
    font-weight: 600;
  }
  .pestanas button[aria-selected='true'] {
    border-color: var(--acento);
    color: var(--acento);
    background: var(--acento-tinte);
  }
  .par {
    display: flex;
    gap: 16px;
    align-items: flex-start;
    justify-content: center;
  }
  .instrumento {
    margin: 0;
    min-width: 0;
  }
  .instrumento.brymen {
    flex: 0 1 300px;
  }
  .instrumento.fnirsi {
    flex: 0 1 360px;
  }
  .oculto {
    display: none;
  }
  figcaption {
    margin-top: 6px;
    font-family: var(--sans);
    font-size: 12.5px;
    color: var(--tinta-suave);
    text-align: center;
    line-height: 1.35;
  }
  .boton.pequeno {
    min-height: 32px;
    padding: 0 10px;
    font-size: 13px;
  }

  /* Two instruments side by side as soon as they fit; the tabs only on narrow screens. */
  @container (min-width: 640px) {
    .pestanas {
      display: none;
    }
    .oculto {
      display: block;
    }
    .instrumento.brymen {
      flex: 0 1 290px;
    }
  }
  /* Wide: bench panel on the left, instruments on the right. */
  @container (min-width: 940px) {
    .banco {
      grid-template-columns: minmax(300px, 1fr) minmax(560px, 1.5fr);
      grid-template-areas: 'circuito instrumentos' 'lateral instrumentos' 'parametros instrumentos';
      grid-template-rows: auto auto 1fr;
    }
    .instrumentos {
      position: sticky;
      top: calc(var(--alto-barra) + 8px);
      align-self: start;
    }
    .par {
      gap: 12px;
    }
  }
</style>
