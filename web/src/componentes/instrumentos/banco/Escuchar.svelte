<script lang="ts">
  // «Escuchar» (0.10): the signal at the earphone's node, or at an oscilloscope probe, through the speaker.
  // The bench adds the node to its transient (long and fine enough for audio); motor/escucha.ts turns it
  // into samples and auricular.ts plays them. Sound starts only from a tap (browsers, Android) and stops when
  // the view is left or hidden.
  import { onMount, untrack } from 'svelte';
  import type { Banco, FuenteEscucha } from '../banco.svelte.ts';
  import { COLOR_PUNTA, LETRA_PUNTA } from '../esquema/Plano.svelte';
  import { prepararEscucha, type Escucha } from '../motor/escucha.ts';
  import { auricular } from '../auricular.ts';
  import type { Datos } from '../banco.svelte.ts';

  let { b, pista }: { b: Banco; /** How to place the earphone in this view (Spanish). */ pista?: string } = $props();

  let analisis = $state.raw<Escucha | null>(null);
  let volumen = $state(0);
  let sinAudio = $state(false);
  let alternativa = $state(false);
  let nivel = $state(0);
  let ultimo: Datos | null = null;

  const fuentes = $derived(
    (
      [
        ['esc', b.auricular, 'Auricular'],
        ['ch1', b.sondas.ch1, 'Sonda CH1'],
        ['ch2', b.sondas.ch2, 'Sonda CH2'],
      ] as [FuenteEscucha, string | null, string][]
    ).filter(([, n]) => !!n),
  );

  function actualizar() {
    if (!b.escucha) return;
    if (!b.nodoEscucha) {
      parar();
      return;
    }
    const d = b.datos;
    if (!d || d.plan.netlist !== b.plan.netlist || d === ultimo) return;
    ultimo = d;
    const s = b.senalEscucha();
    if (s === null) return;
    analisis = prepararEscucha(s, auricular.tasa);
    alternativa = false;
    if (analisis.sonido) auricular.tocar(analisis.sonido);
    else auricular.parar();
  }

  $effect(() => {
    void b.version;
    void b.escucha;
    void b.nodoEscucha;
    untrack(actualizar);
  });

  function escuchar(f: FuenteEscucha) {
    if (b.escucha === f) {
      parar();
      return;
    }
    if (!auricular.preparar()) {
      sinAudio = true;
      return;
    }
    auricular.volumen(volumen);
    b.escucha = f;
    analisis = null;
    ultimo = null;
    actualizar();
  }

  function oirAlternativa() {
    if (!analisis?.alternativa || !auricular.preparar()) return;
    alternativa = true;
    auricular.tocar(analisis.alternativa.sonido);
  }

  function parar() {
    b.escucha = null;
    analisis = null;
    alternativa = false;
    ultimo = null;
    auricular.parar();
  }

  $effect(() => {
    const v = volumen;
    untrack(() => auricular.volumen(v));
  });

  onMount(() => {
    const oculto = () => document.visibilityState !== 'visible' && b.escucha && parar();
    document.addEventListener('visibilitychange', oculto);
    // Level meter while something sounds.
    let raf = 0;
    const medir = () => {
      nivel = b.escucha ? auricular.nivel() : 0;
      raf = requestAnimationFrame(medir);
    };
    raf = requestAnimationFrame(medir);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', oculto);
      parar();
    };
  });

  const esperando = $derived(!!b.escucha && !analisis);
</script>

<section class="escuchar" aria-label="Escuchar señales">
  <h3>Escuchar</h3>
  {#if sinAudio}
    <p class="nota">Este navegador no permite reproducir sonido (Web Audio).</p>
  {:else if !fuentes.length}
    <p class="nota">{pista ?? 'Ponga el auricular (♪) en un nodo, o una sonda del osciloscopio, para oír su señal.'}</p>
  {:else}
    <div class="botones" role="group" aria-label="Qué escuchar">
      {#each fuentes as [f, nodo, nombre] (f)}
        <button type="button" class="fuente" aria-pressed={b.escucha === f} style={`--c:${COLOR_PUNTA[f]}`} onclick={() => escuchar(f)}>
          <span class="disco">{LETRA_PUNTA[f]}</span>{b.escucha === f ? 'Parar' : `Escuchar ${nombre.toLowerCase()}`}<span class="nodo">{nodo}</span>
        </button>
      {/each}
    </div>
    <label class="volumen">
      <span>Volumen</span>
      <input type="range" min="-20" max="40" step="1" bind:value={volumen} aria-label="Volumen (dB)" />
      <span class="db">{volumen > 0 ? '+' : ''}{volumen} dB</span>
    </label>
    {#if b.escucha}
      <div class="medidor" aria-hidden="true"><span style={`width:${Math.min(100, nivel * 260)}%`}></span></div>
      <p class="estado" aria-live="polite">
        {#if esperando}Simulando el tramo que se va a oír…{:else if analisis}{analisis.texto}{/if}
      </p>
      {#if analisis?.alternativa}
        <button type="button" class="boton" aria-pressed={alternativa} onclick={oirAlternativa}>{analisis.alternativa.etiqueta}</button>
        {#if alternativa}<p class="nota">{analisis.alternativa.texto}</p>{/if}
      {/if}
    {/if}
    <p class="nota">0 dB: 1 V de pico llena el limitador; las señales pequeñas se oyen flojas, como en un auricular de verdad (suba el volumen). El otro cable del auricular va a la masa.</p>
  {/if}
</section>

<style>
  .escuchar {
    margin-top: 12px;
    padding: 10px 12px;
    border: 1px solid var(--linea);
    border-radius: 12px;
    background: var(--superficie);
    font-family: var(--sans);
  }
  h3 {
    margin: 0 0 6px;
    font-size: 15px;
    color: var(--titulos);
  }
  .botones {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .fuente {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-height: 44px;
    padding: 4px 12px 4px 6px;
    border: 1px solid var(--linea);
    border-radius: 22px;
    background: var(--superficie);
    color: var(--tinta);
    font: inherit;
    font-size: 14px;
  }
  .fuente[aria-pressed='true'] {
    border-color: var(--c);
    background: color-mix(in srgb, var(--c) 14%, var(--superficie));
  }
  .disco {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: var(--c);
    color: #fff;
    font-weight: 700;
  }
  .nodo {
    font-family: var(--mono);
    font-size: 12px;
    color: var(--tinta-suave);
  }
  .volumen {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 8px 0 4px;
    font-size: 14px;
  }
  .volumen input {
    flex: 1;
    min-width: 0;
    min-height: 32px;
  }
  .db {
    width: 4.2em;
    font-family: var(--mono);
    font-size: 12.5px;
    text-align: right;
  }
  .medidor {
    height: 6px;
    border-radius: 3px;
    background: var(--superficie-2);
    overflow: hidden;
  }
  .medidor span {
    display: block;
    height: 100%;
    background: #8e44c9;
    transition: width 0.08s;
  }
  .estado {
    margin: 6px 0;
    font-size: 14px;
    color: var(--tinta);
  }
  .nota {
    margin: 6px 0 0;
    font-size: 12.5px;
    color: var(--tinta-suave);
  }
</style>
