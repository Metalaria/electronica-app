<script lang="ts">
  // «Señal»: the path from the antenna to the speakers (sections 15.3 and 15.20), stage by stage, with the signal
  // at each one: the band and the RF tank, the IF passband, the discriminator's S-curve, the MPX and its FFT,
  // the de-emphasis response (simulated with the chapter's netlist), the audio; and the oscilloscope on TP1–TP4.
  import { Grafica, type Series } from '../grafica';
  import { url } from '../../lib/datos';
  import type { EstadoKit } from './estado.svelte';
  import { tp3 } from './fisica';
  import { bandaRF, bandaFI, curvaS, senalAudio } from './ondas';
  import { mhz, voltios } from './formato';
  import Osciloscopio from './Osciloscopio.svelte';
  import Frontal from './Frontal.svelte';
  import Cita from './ui/Cita.svelte';
  import Modelado from './ui/Modelado.svelte';

  let { k }: { k: EstadoKit } = $props();

  const r = $derived(k.radio);
  const etapa = $derived(k.kit.etapas.find((e) => e.id === k.etapa) ?? null);

  function elegir(id: string) {
    k.elegirEtapa(k.etapa === id ? null : id);
  }

  // De-emphasis: AC response of the chapter's netlist fig-16.25_desenfasis.cir (source of 1 kΩ).
  let bode = $state<Series[] | null>(null);
  let bodeEstado = $state<'' | 'simulando' | 'error'>('');
  async function simularBode() {
    if (bode || bodeEstado === 'simulando') return;
    bodeEstado = 'simulando';
    try {
      const texto = await fetch(url('spice/cap16/fig-16.25_desenfasis.cir')).then((x) => x.text());
      const sinControl = texto.replace(/\.control[\s\S]*?\.endc/i, '').replace(/^\.param\s+rs\s*=.*$/im, '.param rs=1000').replace(/^\.end\s*$/im, '');
      const neta = `${sinControl}\n.control\nac dec 100 200 60k\n.endc\n.end\n`;
      const { simularTexto } = await import('../../simulador/cliente.svelte');
      const sim = await simularTexto(neta);
      const g = sim.ejecucion.graficas.find((x) => /ac/i.test(x.analisis));
      const f = g?.vectores[0];
      const e = g?.vectores.find((v) => v.nombre.toLowerCase() === 'v(e)');
      if (!f || !e || !e.im) throw new Error('sin resultado');
      const db = new Float64Array(f.re.length);
      let ref = 0;
      for (let i = 0; i < f.re.length; i++) {
        db[i] = 20 * Math.log10(Math.hypot(e.re[i]!, e.im[i]!) + 1e-30);
        if (f.re[i]! <= 1000) ref = db[i]!;
      }
      for (let i = 0; i < db.length; i++) db[i] = db[i]! - ref;
      bode = [{ name: 'Salida hacia CZ3 (relativa a 1 kHz)', unit: 'dB', x: f.re, y: db }];
      bodeEstado = '';
    } catch {
      bodeEstado = 'error';
    }
  }
  $effect(() => {
    if (k.etapa === 'desenfasis') void simularBode();
  });

  const audio = $derived.by((): Series[] => {
    const a = senalAudio({ ...r, audioL: r.emisora ? 0.45 : 0, audioR: r.emisora ? 0.45 : 0, siseo: r.siseo }, 'L', 600, 5e-6);
    const b = senalAudio({ ...r, audioL: r.emisora ? 0.45 : 0, audioR: r.emisora ? 0.45 : 0, siseo: r.siseo }, 'R', 600, 5e-6);
    return [
      { name: 'Canal L', unit: 'V', x: a.t, y: a.v },
      { name: 'Canal R', unit: 'V', x: b.t, y: b.v },
    ];
  });
</script>

<div class="panel-senal">
  <Frontal {k} compacto />
  <ol class="etapas">
    {#each k.kit.etapas as e, i (e.id)}
      {@const b = k.kit.bloques[String(e.bloque)]}
      <li>
        <button type="button" class="etapa" class:activa={k.etapa === e.id} style:--c={b?.color} onclick={() => elegir(e.id)} data-etapa={e.id}>
          <span class="n">{i + 1}</span>
          <span class="txt"><b>{e.nombre}</b><span>{e.senal}</span></span>
        </button>
      </li>
    {/each}
  </ol>

  {#if etapa}
    <section class="detalle">
      <h3>{etapa.nombre} <Cita cita={k.kit.citas[etapa.cita]} /></h3>
      {#if etapa.id === 'antena' || etapa.id === 'rf' || etapa.id === 'ol'}
        <p>
          Sintonizado: <b>{mhz(r.fRx, 2)}</b>; oscilador local: <b>{mhz(r.fOL, 2)}</b> (siempre 10,7 MHz por encima <Cita cita={k.kit.citas['fi']} corto />);
          circuito de entrada en {mhz(r.fRF, 2)}.
        </p>
        <Grafica series={bandaRF(r, k.kit.emisoras)} xAxis={{ label: 'Frecuencia', unit: 'Hz', scale: 'linear', min: 86e6, max: 110e6 }}
          yAxis={{ label: 'Nivel', unit: 'dB', scale: 'linear', min: 0, max: 90 }} height={200} animate={false} help={false} title="La banda de FM en la antena" />
        <p class="nota">Emisoras <Modelado texto="simuladas" nota="Emisoras ficticias de la aplicación" />; respuesta del circuito de entrada con Q = 25 <Modelado />.</p>
      {:else if etapa.id === 'mezclador' || etapa.id === 'fi'}
        <p>FI de la emisora: <b>{mhz(r.fIF, 3)}</b>; B1 resuena en {mhz(r.fB1, 3)}. Nivel en la FI: {Math.round(r.nivel)} dBµV <Modelado />.</p>
        <Grafica series={bandaFI(r)} xAxis={{ label: 'Frecuencia', unit: 'Hz', scale: 'linear' }} yAxis={{ label: 'Respuesta', unit: 'dB', scale: 'linear', min: -60, max: 5 }}
          height={200} animate={false} help={false} title="Frecuencia intermedia: CF1 + CF2 y B1" />
        <p class="nota">Ancho de unos 280 kHz a −3 dB <Cita cita={k.kit.citas['cf_ancho']} corto />; forma del filtro <Modelado />.</p>
      {:else if etapa.id === 'detector'}
        <p>TP3 = <b>{voltios(r.vTP3)}</b>; el centro del discriminador (B2) está en {mhz(r.fB2, 3)}. Con B2 centrado, TP3 marca 4,6 V <Cita cita={k.kit.citas['paso_3']} corto />.</p>
        <Grafica series={curvaS(r, tp3)} xAxis={{ label: 'Frecuencia intermedia', unit: 'Hz', scale: 'linear' }} yAxis={{ label: 'TP3', unit: 'V', scale: 'linear', min: 3.8, max: 5.4 }}
          height={200} animate={false} help={false} title="Curva en S del discriminador" />
        <p class="nota">Forma de la curva en S <Modelado /> (±0,6 V; el esquema original indica «4.6V±0.5V» en K1).</p>
      {:else if etapa.id === 'estereo'}
        <p>{r.estereo ? 'El PLL está enganchado al piloto: los canales salen separados.' : r.piloto ? 'Hay piloto, pero el VCO no engancha: sale mono.' : 'Sin piloto (o K3 en mono): sale mono, L = R.'}</p>
        <Grafica series={audio} xAxis={{ label: 'Tiempo', unit: 's', scale: 'linear' }} yAxis={{ label: 'Audio', unit: 'V', scale: 'linear' }} height={180} animate={false} help={false} title="Salidas L y R del decodificador" />
        <p class="nota">(L+R) + (L−R) = 2L y (L+R) − (L−R) = 2R <Cita cita={k.kit.citas['matriz']} corto />. Programa <Modelado texto="sintetizado" />.</p>
      {:else if etapa.id === 'desenfasis'}
        {#if bode}
          <Grafica series={bode} xAxis={{ label: 'Frecuencia', unit: 'Hz', scale: 'log' }} yAxis={{ label: 'Respuesta', unit: 'dB', scale: 'linear', min: -80, max: 10 }}
            height={200} animate={false} help={false} title="Desénfasis y trampa de 25 kHz (L4, C43)" />
          <p class="nota">Simulado con ngspice a partir de la netlist del libro <code>fig-16.25_desenfasis.cir</code> (fuente de 1 kΩ). <Cita cita={k.kit.citas['trampa']} /></p>
        {:else if bodeEstado === 'error'}
          <p class="nota">No se pudo simular la red de desénfasis.</p>
        {:else}
          <p class="nota">Simulando la red de desénfasis con ngspice…</p>
        {/if}
      {:else}
        <p>{r.descripcion}</p>
      {/if}
    </section>
  {:else}
    <p class="nota">Elija una etapa: el esquema resalta su recorrido y aquí aparece la señal en ese punto.</p>
  {/if}

  <section>
    <h3>Osciloscopio en los puntos de prueba</h3>
    <Osciloscopio {k} />
  </section>
</div>

<style>
  .panel-senal {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .etapas {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .etapa {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-height: 48px;
    padding: 6px 10px;
    border: 1px solid var(--linea);
    border-left: 4px solid var(--c);
    border-radius: 10px;
    background: var(--superficie);
    color: var(--tinta);
    font-family: var(--sans);
    text-align: left;
    cursor: pointer;
  }
  .etapa.activa {
    background: color-mix(in srgb, var(--c) 12%, var(--superficie));
    border-color: var(--c);
  }
  .n {
    display: grid;
    place-items: center;
    flex: none;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--c);
    color: #fff;
    font-size: 12px;
    font-weight: 700;
  }
  .txt {
    display: flex;
    flex-direction: column;
    font-size: 13.5px;
  }
  .txt span {
    font-size: 12.5px;
    color: var(--tinta-suave);
  }
  section h3 {
    margin: 0 0 8px;
    font-size: 15px;
    color: var(--titulos);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }
  .detalle p,
  .nota {
    margin: 0 0 8px;
    font-size: 13.5px;
    line-height: 1.45;
  }
  .nota {
    color: var(--tinta-suave);
    font-size: 12.5px;
  }
</style>
