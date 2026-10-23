<script lang="ts">
  // Oscilloscope view of the test points (and of the audio output and the 12 V rail), with the settings the
  // book recommends for each one (section 15.9 and 15.11.8: ×10 probe on TP2, AC coupling and FFT on TP3,
  // automatic frequency measurement on TP4, AC coupling at 20 mV/div on the rail). The DC levels come from the
  // DC operating point; the AC signals are synthesised from the book's description, and the FNIRSI traces of
  // figure 15.16 are drawn dashed as the book's reference.
  import { Grafica, type Series } from '../grafica';
  import type { EstadoKit } from './estado.svelte';
  import { mpx, senalFI, senalVCO, senalAudio, espectro, trazasLibro, type TrazasLibro } from './ondas';
  import { khz, mhz, voltios, fx, conUnidad } from './formato';
  import Cita from './ui/Cita.svelte';
  import Modelado from './ui/Modelado.svelte';

  let { k }: { k: EstadoKit } = $props();

  type Canal = 'TP1' | 'TP2' | 'TP3' | 'TP4' | 'audio' | 'rizado';
  const CANALES: [Canal, string][] = [
    ['TP1', 'TP1'],
    ['TP2', 'TP2'],
    ['TP3', 'TP3'],
    ['TP4', 'TP4'],
    ['audio', 'Altavoces'],
    ['rizado', 'Raíl 12 V'],
  ];
  const canal = $derived((CANALES.some(([c]) => c === k.tp) ? k.tp : 'TP3') as Canal);
  let acoplo = $state<'ac' | 'dc'>('ac');
  let libro = $state<TrazasLibro | null>(null);
  $effect(() => {
    void trazasLibro().then((t) => (libro = t));
  });

  const r = $derived(k.radio);
  const info = $derived(k.kit.tps.find((t) => t.id === canal));

  const datos = $derived.by((): { series: Series[]; xu: string; yu: string; titulo: string; fft?: Series[] } => {
    if (canal === 'TP1') {
      const v = k.tensionRed('tp1') ?? r.vTP1;
      const x = Float64Array.from([0, 1e-3]);
      return { series: [{ name: 'TP1 (continua)', unit: 'V', x, y: Float64Array.from([v, v]) }], xu: 's', yu: 'V', titulo: 'TP1 en acoplo DC: una línea plana' };
    }
    if (canal === 'TP2') {
      const s = senalFI(r, 1200, 1e-9);
      return { series: [{ name: 'TP2 (sonda ×10)', unit: 'V', x: s.t, y: s.v }], xu: 's', yu: 'V', titulo: 'Entrada de FI de IC3' };
    }
    if (canal === 'TP3') {
      const s = mpx(r, 600, 1e-6, acoplo);
      const largo = mpx(r, 4096, 4e-6, 'ac');
      const e = espectro(largo.v, 4e-6);
      let n = 0;
      while (n < e.f.length && e.f[n]! <= 60e3) n++;
      const fft: Series[] = [{ name: 'FFT de TP3 (sintetizada)', unit: 'dB', x: e.f.slice(0, n), y: e.db.slice(0, n) }];
      if (libro?.fft) fft.push(libro.fft);
      const series: Series[] = [{ name: `TP3 (acoplo ${acoplo.toUpperCase()})`, unit: 'V', x: s.t, y: s.v }];
      if (libro?.mpx && acoplo === 'ac') series.push(libro.mpx);
      return { series, xu: 's', yu: 'V', titulo: 'Salida del detector (Det Out)', fft };
    }
    if (canal === 'TP4') {
      const s = senalVCO(r.fTP4, 800, 0.25e-6);
      return { series: [{ name: 'TP4 (VCO)', unit: 'V', x: s.t, y: s.v }], xu: 's', yu: 'V', titulo: 'VCO del decodificador' };
    }
    if (canal === 'audio') {
      const a = senalAudio(r, 'L', 1000, 5e-6);
      const b = senalAudio(r, 'R', 1000, 5e-6);
      const series: Series[] = [
        { name: 'Altavoz izquierdo', unit: 'V', x: a.t, y: a.v },
        { name: 'Altavoz derecho', unit: 'V', x: b.t, y: b.v },
      ];
      if (libro?.audio) series.push(libro.audio);
      return { series, xu: 's', yu: 'V', titulo: 'Audio en los altavoces' };
    }
    return { series: libro?.rizado ? [libro.rizado] : [], xu: 's', yu: 'V', titulo: 'Rizado del raíl de 12 V (acoplo AC)' };
  });

  /** Automatic measurements (the FNIRSI's PRM): peak to peak, mean, frequency. */
  const medidas = $derived.by(() => {
    const s = datos.series[0];
    if (!s || !s.y.length) return null;
    let mn = Infinity;
    let mx = -Infinity;
    let suma = 0;
    for (const v of s.y) {
      mn = Math.min(mn, v);
      mx = Math.max(mx, v);
      suma += v;
    }
    let f: number | null = null;
    if (canal === 'TP4') f = r.fTP4;
    else if (canal === 'TP2') f = r.emisora && r.fOL != null ? r.fIF : null;
    return { vpp: mx - mn, media: suma / s.y.length, f };
  });

  const yRango = $derived.by((): [number, number] | null => {
    if (canal === 'TP1') return [0, 6];
    if (canal === 'TP3') return acoplo === 'dc' ? [3.6, 5.6] : [-0.4, 0.4];
    if (canal === 'TP4') return [-1, 1];
    if (canal === 'rizado') return [-0.01, 0.01];
    if (canal === 'TP2') return [-0.15, 0.15];
    return null;
  });
</script>

<div class="osc" data-osciloscopio={canal}>
  <div class="canales" role="tablist" aria-label="Punto de medida">
    {#each CANALES as [c, nombre] (c)}
      <button type="button" role="tab" aria-selected={canal === c} onclick={() => k.verTP(c)}>{nombre}</button>
    {/each}
  </div>

  {#if info}
    <p class="esperado"><b>{info.id}</b> · {info.que}. <span class="libro">Libro: «{info.esperado}»</span> <Cita cita={k.kit.citas[info.cita]} /></p>
    <ul class="ajustes">
      {#each info.ajustes as [texto, cita] (texto)}
        <li>{texto} <Cita cita={k.kit.citas[cita]} corto /></li>
      {/each}
    </ul>
  {:else if canal === 'rizado'}
    <p class="esperado">Raíl de 12 V en acoplo AC y 20 mV/div: debe haber pocos milivoltios de rizado. <Cita cita={k.kit.citas['rizado']} /></p>
  {:else}
    <p class="esperado">Audio en los altavoces; el trazo discontinuo es el de la figura del libro. <Cita cita={k.kit.citas['fig_fnirsi']} /></p>
  {/if}

  {#if canal === 'TP3'}
    <div class="acoplo">
      <button type="button" aria-pressed={acoplo === 'ac'} onclick={() => (acoplo = 'ac')}>Acoplo AC</button>
      <button type="button" aria-pressed={acoplo === 'dc'} onclick={() => (acoplo = 'dc')}>Acoplo DC</button>
    </div>
  {/if}

  {#if datos.series.length}
    <div class="pantalla">
      <Grafica
        series={datos.series}
        xAxis={{ label: 'Tiempo', unit: 's', scale: 'linear' }}
        yAxis={{ label: canal === 'TP2' ? 'Tensión en la punta' : 'Tensión', unit: 'V', scale: 'linear', ...(yRango ? { min: yRango[0], max: yRango[1] } : {}) }}
        height={200}
        animate={false}
        help={false}
        title={datos.titulo}
        ariaLabel={`Osciloscopio en ${canal}`}
      />
    </div>
  {/if}
  {#if datos.fft}
    <div class="pantalla">
      <Grafica
        series={datos.fft}
        xAxis={{ label: 'Frecuencia', unit: 'Hz', scale: 'linear', min: 0, max: 60e3 }}
        yAxis={{ label: 'Nivel relativo', unit: 'dB', scale: 'linear', min: -90, max: 5 }}
        height={180}
        animate={false}
        help={false}
        title="TP3 con FFT: piloto en 19 kHz, L−R entre 23 y 53 kHz"
        ariaLabel="Espectro de TP3"
      />
    </div>
    <p class="nota"><Cita cita={k.kit.citas['fnirsi_fft']} /> El trazo discontinuo es la FFT de la figura 15.16.</p>
  {/if}

  {#if medidas}
    <div class="prm" data-prm={medidas.f == null ? '' : medidas.f.toFixed(1)}>
      <span>Frec.: <b>{medidas.f == null ? '—' : canal === 'TP2' ? mhz(medidas.f, 3) : khz(medidas.f, 3)}</b></span>
      <span>Vpp: <b>{conUnidad(medidas.vpp * (medidas.vpp < 1 ? 1000 : 1), medidas.vpp < 1 ? 0 : 2, medidas.vpp < 1 ? 'mV' : 'V')}</b></span>
      <span>Media: <b>{voltios(medidas.media, 2)}</b></span>
    </div>
  {/if}
  {#if canal === 'TP4' && r.fTP4 == null}
    <p class="aviso">Sin señal en TP4: {!k.c.monitor ? 'el puente «Monitor» está abierto.' : k.c.k3 ? 'K3 está en mono (el VCO está parado).' : 'el decodificador no tiene alimentación.'}</p>
  {/if}
  <p class="origen">
    {#if canal === 'TP1'}Nivel de continua del punto de trabajo simulado (ngspice).
    {:else if canal === 'rizado'}Trazo de la figura 15.16 del libro: la aplicación no modela el rizado.
    {:else}Forma de onda <Modelado texto="sintetizada" nota="Generada a partir de la descripción del libro; amplitudes ilustrativas" /> a partir de lo que describe el libro{#if canal === 'TP3'}; su nivel de continua ({fx(r.vTP3, 2)} V) es el del modelo{/if}.{/if}
  </p>
</div>

<style>
  .osc {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .canales,
  .acoplo {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .canales button,
  .acoplo button {
    min-height: 40px;
    padding: 0 12px;
    border: 1px solid var(--linea);
    border-radius: 999px;
    background: var(--superficie);
    color: var(--tinta);
    font: 600 13px var(--sans);
    cursor: pointer;
  }
  .canales button[aria-selected='true'],
  .acoplo button[aria-pressed='true'] {
    border-color: var(--acento);
    background: var(--acento-tinte);
    color: var(--acento);
  }
  @media (pointer: coarse) {
    .canales button,
    .acoplo button {
      min-height: 44px;
    }
  }
  .esperado,
  .nota,
  .origen,
  .aviso {
    margin: 0;
    font-size: 13px;
    line-height: 1.45;
  }
  .libro {
    color: var(--tinta-suave);
  }
  .ajustes {
    margin: 0;
    padding-left: 18px;
    font-size: 13px;
    line-height: 1.5;
  }
  .pantalla {
    border-radius: 10px;
    overflow: hidden;
  }
  .prm {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 14px;
    padding: 6px 10px;
    border-radius: 8px;
    background: #10161c;
    color: #f5d76e;
    font: 600 13px 'Source Code Pro', ui-monospace, monospace;
    font-variant-numeric: tabular-nums;
  }
  .prm b {
    color: #fff3c4;
  }
  .aviso {
    color: #b03a2e;
  }
  .origen,
  .nota {
    color: var(--tinta-suave);
    font-size: 12.5px;
  }
</style>
