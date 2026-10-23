<script lang="ts">
  // Controls of a live schematic, under the figure (and in the full-screen view): play/pause, conventional
  // current or electron flow, the voltage legend, the time of the transient with its scrubber and a linked
  // plot of the selected node or branch, the sliders of the component values, and the assumptions. For a
  // drawing that cannot be simulated, why not.
  import Pause from '@lucide/svelte/icons/pause';
  import Play from '@lucide/svelte/icons/play';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
  import { untrack } from 'svelte';
  import type { EstadoEsquema } from './modelo.svelte';
  import { gradiente, COLOR_CORRIENTE, COLOR_ELECTRON } from './color';
  import { si } from '../formato';
  import { nombreElemento, textoEtiqueta } from './textos';
  import { parametros, resimular, restaurar } from './resimular';
  import Valor from './Valor.svelte';
  import { Grafica, PlotLink, type Series } from '../../grafica';

  let {
    est,
    numero = null,
    amplio = false,
  }: {
    est: EstadoEsquema;
    /** «Circuito 2» when the figure has several drawings. */
    numero?: number | null;
    /** Full-screen view: values open, larger plot. */
    amplio?: boolean;
  } = $props();

  // A schematic driven by a netlist (simulator page) takes its values from the page's own sliders.
  const lista = $derived(est.externo ? [] : parametros(est, nombreElemento));
  let valoresAbiertos = $state(untrack(() => amplio));
  let supuestosAbiertos = $state(false);

  const ref = $derived(Math.max(Math.abs(est.rangos.vmin), Math.abs(est.rangos.vmax)));
  const leyenda = $derived(est.simulable && ref > 0 ? gradiente(est.rangos.vmin, est.rangos.vmax, ref) : null);
  const ttotal = $derived(est.tran ? est.tran.t[est.tran.t.length - 1]! : 0);

  // ---------------------------------------------------------------- sliders
  let espera: ReturnType<typeof setTimeout> | null = null;
  function mover(id: string, v: number) {
    est.cambios = { ...est.cambios, [id]: v };
    if (espera) clearTimeout(espera);
    espera = setTimeout(() => void resimular(est), 160);
  }
  function soltar() {
    if (espera) clearTimeout(espera);
    espera = null;
    void resimular(est);
  }
  function valorDe(id: string, original: number): number {
    return est.cambios[id] ?? original;
  }

  // ---------------------------------------------------------------- linked plot (transient)
  const enlace = new PlotLink();
  let puesto: number | null = null;

  const curvas = $derived.by((): { v: Series[]; i: Series[] } | null => {
    const tr = est.tran;
    const s = est.seleccion;
    if (!tr || !s) return null;
    const t = Float64Array.from(tr.t);
    const serie = (a: (number | null)[] | null | undefined, name: string, unit: string, color?: string): Series | null =>
      a ? { name, unit, x: t, y: Float64Array.from(a, (v) => v ?? NaN), color } : null;
    const v: Series[] = [];
    const i: Series[] = [];
    if (s.k === 'elem') {
      const e = est.esq.elementos.find((x) => x.id === s.id);
      const r = tr.elementos[s.id];
      if (e && r) {
        const sv = serie(r.tension, `V ${e.designador ?? ''}`.trim(), 'V');
        const si2 = serie(r.corriente ?? r.terminales?.[Object.keys(r.terminales ?? {})[0] ?? ''], `I ${e.designador ?? ''}`.trim(), 'A', COLOR_CORRIENTE);
        if (sv) v.push(sv);
        if (si2) i.push(si2);
      }
    } else {
      const nodo = est.nodoDe(s);
      const n = est.esq.nodos.find((x) => x.id === nodo);
      if (nodo && n) {
        const nombre = n.tierra ? 'masa' : (n.etiquetas ?? []).map(textoEtiqueta).filter(Boolean)[0] ?? `nodo ${nodo.replace(/^N/, '')}`;
        const sv = serie(tr.nodos[nodo], `V ${nombre}`, 'V');
        if (sv) v.push(sv);
      }
      if (s.k === 'tramo') {
        const si2 = serie(tr.tramos[s.id], 'I cable', 'A', COLOR_CORRIENTE);
        if (si2) i.push(si2);
      }
    }
    return v.length || i.length ? { v, i } : null;
  });

  // The plots' crosshair follows the time shown; moving over a plot scrubs the time (and pauses).
  $effect(() => {
    const t = est.tiempo;
    if (!curvas || t == null) return;
    untrack(() => {
      puesto = t;
      enlace.hoverX = t;
    });
  });
  $effect(() => {
    const h = enlace.hoverX;
    untrack(() => {
      if (h == null || h === puesto || !ttotal) return;
      est.reproduciendo = false;
      est.fase = Math.min(1, Math.max(0, h / ttotal));
      puesto = est.tiempo;
    });
  });

  const motivos = $derived(est.esq.simulacion?.motivos ?? []);
  const supuestos = $derived(est.externo ? [] : (est.esq.simulacion?.supuestos ?? []));

  function explicar(m: string): string {
    return m
      .replace(/^faltan valores: /, 'faltan los valores de ')
      .replace(/^componentes no soportados: /, 'tiene componentes que el simulador no modela: ')
      .replace(/^sin fuentes$/, 'no tiene ninguna fuente')
      .replace(/^sin masa.*$/, 'no tiene masa ni una fuente que la defina')
      .replace(/^ngspice no resuelve: /, 'ngspice no lo resuelve: ');
  }
</script>

<section class="panel-e" class:amplio aria-label={numero ? `Circuito ${numero}` : 'Circuito'}>
  {#if numero}<h4 class="num">Circuito {numero}</h4>{/if}
  {#if est.externo && !est.op}
    <p class="pista">{est.estadoSim === 'simulando' ? 'Calculando las corrientes del circuito…' : est.mensaje || 'Simule el circuito para ver sus tensiones y corrientes en el dibujo.'}</p>
  {:else if est.simulable}
    <div class="fila">
      <button
        type="button"
        class="b icono"
        aria-label={est.reproduciendo ? 'Pausar' : 'Reproducir'}
        title={est.reproduciendo ? 'Pausar (espacio)' : 'Reproducir (espacio)'}
        onclick={() => (est.reproduciendo = !est.reproduciendo)}
      >
        {#if est.reproduciendo}<Pause size={18} />{:else}<Play size={18} />{/if}
      </button>
      <div class="segmentos" role="group" aria-label="Sentido de las partículas">
        <button type="button" aria-pressed={!est.electrones} onclick={() => (est.electrones = false)}>
          <span class="punto" style:background={COLOR_CORRIENTE}></span>Corriente
        </button>
        <button type="button" aria-pressed={est.electrones} onclick={() => (est.electrones = true)}>
          <span class="punto" style:background={COLOR_ELECTRON}></span>Electrones
        </button>
      </div>
      {#if leyenda}
        <div class="leyenda" aria-label={`Color de los cables según su tensión, de ${si(est.rangos.vmin, 'V', 3)} a ${si(est.rangos.vmax, 'V', 3)}`}>
          <span class="barra" style:background={leyenda}></span>
          <span class="ext">{si(est.rangos.vmin, 'V', 2)}</span>
          <span class="ext der">{si(est.rangos.vmax, 'V', 2)}</span>
        </div>
      {/if}
      {#if lista.length}
        <button type="button" class="b" aria-expanded={valoresAbiertos} onclick={() => (valoresAbiertos = !valoresAbiertos)}>
          <SlidersHorizontal size={16} /> Valores
        </button>
      {/if}
    </div>

    {#if est.tran}
      <div class="tiempo">
        <label for={`fv-t-${est.indice}`}>t = <output>{si(est.tiempo ?? 0, 's', 3)}</output></label>
        <input
          id={`fv-t-${est.indice}`}
          type="range"
          min="0"
          max="1000"
          step="1"
          value={Math.round(est.fase * 1000)}
          aria-valuetext={si(est.tiempo ?? 0, 's', 3)}
          oninput={(ev) => {
            est.reproduciendo = false;
            est.fase = Number((ev.currentTarget as HTMLInputElement).value) / 1000;
          }}
        />
        <span class="ext">{si(ttotal, 's', 2)}{est.externo ? '' : ' (2 periodos)'}</span>
      </div>
      {#if curvas}
        <div class="graficas">
          {#if curvas.v.length}
            <Grafica series={curvas.v} xAxis={{ label: 'Tiempo', unit: 's', scale: 'linear' }} yAxis={{ label: 'Tensión', unit: 'V', scale: 'linear' }} link={enlace} height={amplio ? 170 : 130} help={false} animate={false} />
          {/if}
          {#if curvas.i.length}
            <Grafica series={curvas.i} xAxis={{ label: 'Tiempo', unit: 's', scale: 'linear' }} yAxis={{ label: 'Corriente', unit: 'A', scale: 'linear' }} link={enlace} height={amplio ? 170 : 130} help={false} animate={false} />
          {/if}
        </div>
      {:else}
        <p class="pista">Toque un cable, un nodo o un componente para ver su tensión y su corriente a lo largo del periodo.</p>
      {/if}
    {/if}

    {#if est.estadoSim !== 'libro' || est.mensaje}
      <p class="estado" class:error={est.estadoSim === 'error'} role="status">
        {#if est.estadoSim === 'simulando'}Simulando con ngspice…{:else if est.estadoSim === 'error'}{est.mensaje}{:else}Resultado de ngspice con los valores cambiados.{/if}
      </p>
    {/if}

    {#if valoresAbiertos && lista.length}
      <div class="valores">
        {#each lista as p (p.id)}
          <Valor {p} valor={valorDe(p.id, p.original)} alMover={(v) => mover(p.id, v)} alSoltar={soltar} />
        {/each}
        <button type="button" class="b restaurar" disabled={!Object.keys(est.cambios).length} onclick={() => restaurar(est)}>
          <RotateCcw size={15} /> Valores del libro
        </button>
      </div>
    {/if}

    {#if supuestos.length}
      <details class="supuestos" bind:open={supuestosAbiertos}>
        <summary>Supuestos de la simulación ({supuestos.length})</summary>
        <ul>{#each supuestos as s, i (i)}<li>{s}</li>{/each}</ul>
      </details>
    {/if}
  {:else}
    <p class="motivo">
      <strong>Solo conexiones.</strong>
      Este esquema no se puede simular: {motivos.map(explicar).join('; ') || 'falta información del circuito'}.
      Pase el puntero (o toque) por un cable para ver qué terminales une.
    </p>
  {/if}
</section>

<style>
  .panel-e {
    display: grid;
    gap: 8px;
    margin: 0.5em auto 0;
    max-width: 46em;
    font-family: var(--sans);
    font-size: 14px;
    color: var(--tinta);
    text-align: left;
  }
  .num {
    margin: 0.3em 0 0;
    font-size: 13px;
    font-weight: 700;
    color: var(--tinta-suave);
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }
  .fila {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 10px;
  }
  .b {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 34px;
    padding: 0 12px;
    border: 1px solid var(--linea);
    border-radius: 9px;
    background: var(--superficie);
    color: var(--tinta-suave);
    font-size: 13.5px;
    font-weight: 600;
  }
  .b:hover:not(:disabled) {
    border-color: var(--acento-borde);
    color: var(--tinta);
  }
  .b[aria-expanded='true'] {
    background: var(--acento-tinte);
    border-color: var(--acento-borde);
    color: var(--acento);
  }
  .b:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .b.icono {
    width: 38px;
    padding: 0;
    color: var(--acento);
  }
  .segmentos {
    display: inline-flex;
    padding: 2px;
    border: 1px solid var(--linea);
    border-radius: 10px;
    background: var(--superficie-2);
  }
  .segmentos button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 30px;
    padding: 0 10px;
    border: 0;
    border-radius: 8px;
    background: none;
    color: var(--tinta-suave);
    font-size: 13px;
    font-weight: 600;
  }
  .segmentos button[aria-pressed='true'] {
    background: var(--superficie);
    color: var(--tinta);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
  }
  .punto {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    border: 1px solid rgba(0, 0, 0, 0.35);
  }
  .leyenda {
    display: grid;
    grid-template-columns: auto auto;
    justify-content: space-between;
    min-width: 128px;
    flex: 0 1 180px;
    row-gap: 1px;
  }
  .barra {
    grid-column: 1 / -1;
    height: 8px;
    border-radius: 4px;
    border: 1px solid rgba(0, 0, 0, 0.12);
  }
  .ext {
    color: var(--tinta-tenue);
    font-size: 11.5px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .ext.der {
    text-align: right;
  }
  .tiempo {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 10px;
  }
  .tiempo label {
    min-width: 7.5em;
    color: var(--tinta-suave);
    font-variant-numeric: tabular-nums;
  }
  .tiempo output {
    color: var(--tinta);
    font-weight: 700;
  }
  .tiempo input {
    width: 100%;
    min-width: 0;
    height: 30px;
    margin: 0;
    accent-color: var(--acento);
  }
  .graficas {
    display: grid;
    gap: 4px;
  }
  .amplio .graficas {
    gap: 10px;
  }
  .pista,
  .estado {
    margin: 0;
    color: var(--tinta-tenue);
    font-size: 13px;
  }
  .estado.error {
    color: var(--c-precaucion);
  }
  .valores {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 230px), 1fr));
    gap: 4px 18px;
    padding: 8px 12px 10px;
    border: 1px solid var(--linea-suave);
    border-radius: 10px;
    background: var(--superficie);
  }
  .restaurar {
    justify-self: start;
    align-self: end;
    margin-bottom: 4px;
  }
  .supuestos {
    color: var(--tinta-suave);
    font-size: 13px;
  }
  .supuestos summary {
    cursor: pointer;
    min-height: 28px;
    line-height: 28px;
  }
  .supuestos ul {
    margin: 2px 0 0;
    padding-left: 1.2em;
  }
  .motivo {
    margin: 0;
    padding: 8px 12px;
    border-left: 3px solid var(--c-importante);
    border-radius: 0 8px 8px 0;
    background: color-mix(in srgb, var(--c-importante) 8%, transparent);
    color: var(--tinta-suave);
    font-size: 13.5px;
  }
  .motivo strong {
    color: var(--tinta);
  }
  @media (pointer: coarse) {
    .b,
    .segmentos button {
      min-height: 44px;
    }
    .b.icono {
      width: 44px;
    }
    .tiempo input {
      height: 44px;
    }
    .supuestos summary {
      min-height: 44px;
      line-height: 44px;
    }
  }
</style>
