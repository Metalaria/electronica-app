<script lang="ts">
  // The DC voltmeter of section 15.11.2 (Brymen BM869s in the book): black probe on ground, red probe on the
  // point to measure; both can be placed by tapping the schematic. The reading is the simulated operating point
  // (ngspice); when the point is in the book's voltage map or is a test point, the book's value is shown next to it.
  import type { EstadoKit } from './estado.svelte';
  import { nombreNodo } from './estado.svelte';
  import { fx, voltios } from './formato';
  import Cita from './ui/Cita.svelte';
  import Modelado from './ui/Modelado.svelte';

  let { k }: { k: EstadoKit } = $props();

  const lectura = $derived(k.lectura);
  const sinModelo = $derived(k.roja != null && k.dc != null && k.tension(k.roja) == null);
  const libro = $derived.by(() => {
    if (!k.roja || k.negra !== 'N0') return null;
    return k.kit.mapa.find((m) => m.nodo === k.roja) ?? null;
  });
  const tp = $derived(k.roja ? k.kit.tps.find((t) => t.nodo === k.roja) : undefined);
  const dentro = $derived(libro && lectura != null ? Math.abs(lectura - libro.esperado) <= libro.esperado * libro.tol : null);

  // Settled readings go to the log.
  let espera: ReturnType<typeof setTimeout> | null = null;
  $effect(() => {
    const v = lectura;
    const r = k.roja;
    const listo = k.dcEstado === 'listo';
    if (espera) clearTimeout(espera);
    if (r == null || v == null || !listo) return;
    espera = setTimeout(() => k.anotar(nombreNodo(k, r) + (k.negra !== 'N0' ? ` − ${nombreNodo(k, k.negra)}` : ''), voltios(v)), 600);
    return () => {
      if (espera) clearTimeout(espera);
    };
  });

  function colocar(p: 'roja' | 'negra') {
    k.siguiente = p;
    k.modo = 'multimetro';
  }
</script>

<div class="multimetro" data-multimetro>
  <div class="pantalla" class:simulando={k.dcEstado === 'simulando'}>
    <span class="modo">V ⎓</span>
    <span class="valor" data-lectura={lectura == null ? '' : lectura.toFixed(3)}>
      {#if k.roja == null}----{:else if sinModelo}—{:else if lectura == null}…{:else}{fx(lectura, Math.abs(lectura) < 10 ? 3 : 2)}{/if}
    </span>
    <span class="u">V</span>
  </div>
  <div class="puntas">
    <button type="button" class="punta roja" class:activa={k.modo === 'multimetro' && k.siguiente === 'roja'} onclick={() => colocar('roja')}>
      <span class="bola"></span><span class="texto"><b>Punta roja</b><span>{nombreNodo(k, k.roja)}</span></span>
    </button>
    <button type="button" class="punta negra" class:activa={k.modo === 'multimetro' && k.siguiente === 'negra'} onclick={() => colocar('negra')}>
      <span class="bola"></span><span class="texto"><b>Punta negra</b><span>{nombreNodo(k, k.negra)}</span></span>
    </button>
  </div>
  {#if k.negra !== 'N0'}
    <button type="button" class="enlace" onclick={() => (k.negra = 'N0')}>Llevar la punta negra a masa</button>
  {/if}
  {#if k.modo === 'multimetro'}
    <p class="ayuda">Toque un cable, un nodo o la patilla de un componente en el esquema para colocar la punta {k.siguiente}.
      <button type="button" class="enlace" onclick={() => (k.modo = 'normal')}>Terminar</button></p>
  {/if}
  {#if sinModelo}
    <p class="nota">El libro no da la tensión de esta patilla y el modelo de continua no la calcula (depende de la polarización interna del integrado).</p>
  {/if}
  {#if libro}
    <p class="libro" class:bien={dentro === true} class:mal={dentro === false}>
      Libro: <b>{fx(libro.esperado, 1)} V</b>{#if libro.aprox}&nbsp;(aprox.){/if} ± {Math.round(libro.tol * 100)} %
      <Cita cita={k.kit.citas[libro.cita]} />
      {#if dentro === true}<span class="marca">dentro de la tolerancia</span>{:else if dentro === false}<span class="marca">fuera de la tolerancia</span>{/if}
    </p>
  {:else if tp}
    <p class="libro">{tp.id}: {tp.esperado} <Cita cita={k.kit.citas[tp.cita]} /></p>
  {/if}
  <p class="pie">Lectura: punto de trabajo simulado con ngspice <Modelado texto="modelo de continua" nota="Modelo del kit completo: valores del esquema; integrados como macromodelos con las tensiones y consumos del libro" /></p>
</div>

<style>
  .multimetro {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .pantalla {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 8px 14px;
    border-radius: 10px;
    background: #c9d3b6;
    color: #1d2416;
    font-family: 'Source Code Pro', ui-monospace, monospace;
    border: 3px solid #e5b52b;
  }
  .pantalla.simulando .valor {
    opacity: 0.55;
  }
  .modo {
    font-size: 13px;
    font-weight: 700;
  }
  .valor {
    flex: 1;
    font-size: 34px;
    font-weight: 600;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .u {
    font-size: 16px;
    font-weight: 700;
  }
  .puntas {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }
  .punta {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 48px;
    padding: 6px 10px;
    border: 1px solid var(--linea);
    border-radius: 10px;
    background: var(--superficie);
    color: var(--tinta);
    text-align: left;
    cursor: pointer;
    font-family: var(--sans);
  }
  .punta.activa {
    border-color: var(--acento);
    box-shadow: 0 0 0 2px var(--acento-suave);
  }
  .bola {
    flex: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
  }
  .roja .bola {
    background: #d63a2f;
  }
  .negra .bola {
    background: #222;
    border: 1px solid #888;
  }
  .texto {
    display: flex;
    flex-direction: column;
    min-width: 0;
    font-size: 12.5px;
  }
  .texto span {
    color: var(--tinta-suave);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .enlace {
    align-self: flex-start;
    min-height: 32px;
    padding: 0 4px;
    border: 0;
    background: none;
    color: var(--acento);
    font: inherit;
    font-size: 13px;
    text-decoration: underline;
    cursor: pointer;
  }
  .ayuda,
  .nota,
  .libro,
  .pie {
    margin: 0;
    font-size: 13px;
    line-height: 1.4;
    color: var(--tinta-suave);
  }
  .libro {
    color: var(--tinta);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }
  .libro.bien .marca {
    color: #1e8449;
    font-weight: 700;
  }
  .libro.mal .marca {
    color: #b03a2e;
    font-weight: 700;
  }
  .pie {
    font-size: 12px;
  }
</style>
