<script lang="ts">
  // The real FNIRSI's oscilloscope, beyond what its own screen shows: for each trace on the panel, more measurements
  // (mean, RMS, duty cycle, edge times), its spectrum with the harmonics and their distortion, and the trace saved
  // as a CSV file. All of it is computed here from the record the instrument sends (lib/fnirsi-real/analisis.ts):
  // nothing is asked of the instrument, which the link only reads.
  // Closed by default, and it does nothing while closed. Open, it takes the traces twice a second: figures that
  // changed with every acquisition (some thirty a second) could not be read.
  import { ARMONICOS, PUNTOS_ESPECTRO, csvTraza, espectro, medirAmpliado, type Analizable, type Espectro } from '../../../lib/fnirsi-real/analisis';
  import type { Traza } from '../../../lib/fnirsi-real/osciloscopio';
  import type { TrazaPromediada } from '../../../lib/fnirsi-real/promedio';
  import { CANCELADO, guardarFichero } from '../../../lib/sincronizacion/fichero';
  import { formatoSI } from '../../grafica/formato';

  let {
    trazas,
    promedios = [null, null],
  }: {
    trazas: Traza[];
    /** By channel: the average of its last acquisitions when the panel is averaging (it is then what is analysed). */
    promedios?: (TrazaPromediada | null)[];
  } = $props();

  const REFRESCO_MS = 500;
  const ANCHO = 300;
  const ALTO = 90;
  /** Bottom of the spectrum's drawing, dB under its highest point. */
  const SUELO = -60;
  const COLOR = ['#d99a1c', '#3b8fd9'] as const;
  /** Under this the harmonics are the converter's steps, not the wave's (8 bits). */
  const DISTORSION_MINIMA = 1.5;

  let abierto = $state(false);
  let foto = $state.raw<{ t: Traza; p: TrazaPromediada | null }[]>([]);
  let aviso = $state('');
  let avisoError = $state(false);

  // (the newest traces, kept outside the reactive graph so that the timer below does not restart with each one)
  let ultimas: { t: Traza; p: TrazaPromediada | null }[] = [];
  $effect(() => {
    ultimas = trazas.map((t) => ({ t, p: promedios[t.canal] ?? null }));
  });
  $effect(() => {
    if (!abierto) return;
    foto = ultimas;
    const id = setInterval(() => (foto = ultimas), REFRESCO_MS);
    return () => clearInterval(id);
  });

  const analisis = $derived(
    foto.map(({ t, p }) => {
      const fuente: Analizable = p ?? t;
      return { t, p, fuente, m: medirAmpliado(fuente), e: espectro(fuente) };
    }),
  );

  const numero = (v: number, decimales: number) => v.toLocaleString('es-ES', { minimumFractionDigits: decimales, maximumFractionDigits: decimales }).replace('-', '−');
  const tiempo = (v: number | null, limitado: boolean) => (v === null ? '—' : `${limitado ? '≤ ' : ''}${formatoSI(v, 's', 3)}`);
  /** dB of a tone against the fundamental. */
  const relativo = (x: number, base: number) => (x > 0 && base > 0 ? `${numero(20 * Math.log10(x / base), 1)} dB` : '—');

  /** Points of the spectrum that are drawn: up to a little past the last harmonic, or all of them without a wave. */
  function puntosDibujados(e: Espectro): number {
    const ultimo = e.tonos[e.tonos.length - 1];
    if (!ultimo) return PUNTOS_ESPECTRO;
    return Math.min(PUNTOS_ESPECTRO, Math.max(16, Math.ceil(((ARMONICOS + 1) * e.tonos[0]!.frecuencia) / e.resolucion)));
  }

  function linea(e: Espectro): string {
    const n = puntosDibujados(e);
    let mayor = 0;
    for (let k = 1; k < n; k++) mayor = Math.max(mayor, e.amplitudes[k]!);
    if (!(mayor > 0)) return '';
    let s = '';
    for (let k = 1; k < n; k++) {
      const db = Math.max(SUELO, 20 * Math.log10(Math.max(e.amplitudes[k]!, 1e-12) / mayor));
      s += `${((k / (n - 1)) * ANCHO).toFixed(1)},${((db / SUELO) * ALTO).toFixed(1)} `;
    }
    return s;
  }

  function textoTonos(e: Espectro): string {
    const f = e.tonos[0];
    if (!f) return 'Sin dos periodos enteros de una onda en el registro no hay armónicos que dar.';
    let s = `Fundamental: ${formatoSI(f.frecuencia, 'Hz', 4)}, ${formatoSI(f.eficaz, 'V', 3)} eficaces.`;
    const arm = e.tonos.slice(1, 5);
    if (arm.length) s += ` Armónicos respecto a él: ${arm.map((x) => `${x.orden}.º ${relativo(x.eficaz, f.eficaz)}`).join(' · ')}.`;
    if (e.distorsion !== null) {
      const hasta = e.tonos[e.tonos.length - 1]!.orden;
      s +=
        e.distorsion < DISTORSION_MINIMA
          ? ` Distorsión armónica: menos del ${numero(DISTORSION_MINIMA, 1)} %, que es lo que dejan distinguir los 8 bits del aparato.`
          : ` Distorsión armónica (hasta el ${hasta}.º armónico): ${numero(e.distorsion, 1)} %.`;
    }
    return s;
  }

  function nombreFichero(base: string): string {
    const d = new Date();
    const dos = (x: number) => String(x).padStart(2, '0');
    return `${base}-${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}-${dos(d.getHours())}${dos(d.getMinutes())}${dos(d.getSeconds())}.csv`;
  }

  async function guardar(t: Analizable, promedio: boolean) {
    aviso = '';
    avisoError = false;
    try {
      const hecho = await guardarFichero(nombreFichero(`${promedio ? 'promedio' : 'traza'}-fnirsi-ch${t.canal + 1}`), csvTraza(t), 'text/csv;charset=utf-8', ['Datos (CSV)', ['csv']]);
      if (hecho !== CANCELADO) aviso = hecho === 'guardado' ? 'Fichero guardado.' : 'Fichero descargado: está en las descargas del navegador.';
    } catch (e) {
      avisoError = true;
      aviso = `No se pudo guardar el fichero: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
</script>

<details class="an" bind:open={abierto} data-analisis-fnirsi>
  <summary>Más medidas y espectro</summary>
  <p class="an-nota">Calculado en la aplicación a partir del registro que envía el FNIRSI; al aparato no se le pide ni se le cambia nada.</p>
  {#each analisis as { t, p, fuente, m, e } (t.canal)}
    {@const ch = `CH${t.canal + 1}`}
    <section class="an-canal" aria-label={`Análisis de ${ch}`} data-analisis-canal={t.canal + 1}>
      <p class="an-titulo"><span class="an-marca" style:background={COLOR[t.canal]}></span><strong>{ch}</strong></p>
      {#if p}<p class="an-nota" data-analisis-promedio>Sobre el promedio de {p.adquisiciones} {p.adquisiciones === 1 ? 'adquisición' : 'adquisiciones'}: 24 divisiones alrededor del disparo.</p>{/if}
      <dl data-medidas-ampliadas>
        <div><dt>Media</dt><dd>{formatoSI(m.media, 'V', 3)}</dd></div>
        <div><dt>Valor eficaz</dt><dd>{formatoSI(m.eficaz, 'V', 3)}</dd></div>
        <div><dt>Valor eficaz sin la continua</dt><dd>{formatoSI(m.eficazAlterna, 'V', 3)}</dd></div>
        <div><dt>Periodo</dt><dd>{m.periodo === null ? '—' : formatoSI(m.periodo, 's', 4)}</dd></div>
        <div><dt>Ciclo de trabajo</dt><dd>{m.ciclo === null ? '—' : `${numero(m.ciclo, 1)} %`}</dd></div>
        <div><dt>Subida (10 % a 90 %)</dt><dd>{tiempo(m.subida, m.flancoLimitado)}</dd></div>
        <div><dt>Bajada (90 % a 10 %)</dt><dd>{tiempo(m.bajada, m.flancoLimitado)}</dd></div>
      </dl>
      <p class="an-nota">
        {m.periodos ? `Media y valor eficaz sobre ${m.periodos} ${m.periodos === 1 ? 'periodo entero' : 'periodos enteros'}.` : 'Media y valor eficaz sobre todas las muestras: no hay un periodo entero en ellas.'}
        {#if m.flancoLimitado}Los flancos son más rápidos de lo que resuelve esta base de tiempos: el tiempo que se da es un máximo.{/if}
      </p>
      {#if t.ajustes.canales[t.canal].acoplamiento === 'CA'}<p class="an-nota" data-acoplamiento-fnirsi>{ch} está en CA: la media y los valores máximo y mínimo no incluyen la componente continua de la señal.</p>{/if}
      {#if t.saturada}<p class="an-aviso">La señal se sale de la escala: estas medidas y el espectro son los de la onda recortada.</p>{/if}
      {#if !t.ajustes.tiempoComprobado}<p class="an-aviso">Esta base de tiempos no está comprobada: tome los tiempos y las frecuencias con reserva.</p>{/if}
      <svg class="an-espectro" viewBox="0 0 {ANCHO} {ALTO}" role="img" aria-label={`Espectro de ${ch}`} data-espectro-fnirsi>
        {#each [20, 40] as db (db)}<line x1="0" y1={(db / -SUELO) * ALTO} x2={ANCHO} y2={(db / -SUELO) * ALTO} class="an-rejilla" />{/each}
        <polyline points={linea(e)} fill="none" stroke={COLOR[t.canal]} stroke-width="1.2" vector-effect="non-scaling-stroke" />
      </svg>
      <p class="an-nota">Espectro de 0 a {formatoSI((puntosDibujados(e) - 1) * e.resolucion, 'Hz', 3)}; de arriba abajo, 60 dB bajo su punto más alto (una línea cada 20 dB).</p>
      <p data-tonos-fnirsi>{textoTonos(e)}</p>
      <button type="button" class="boton pequeno" onclick={() => void guardar(fuente, !!p)} data-guardar-traza={t.canal + 1}>Guardar {p ? 'el promedio' : 'la traza'} de {ch} (CSV)</button>
    </section>
  {/each}
  {#if aviso}<p class={avisoError ? 'an-aviso' : 'an-nota'} role="status" data-aviso-traza>{aviso}</p>{/if}
</details>

<style>
  .an {
    margin-top: 6px;
    font-size: 12.5px;
  }
  .an summary {
    min-height: 32px;
    display: flex;
    align-items: center;
    cursor: pointer;
    color: var(--tinta-suave);
  }
  .an-canal {
    margin-top: 6px;
    padding-top: 6px;
    border-top: 1px solid var(--linea);
  }
  .an .an-titulo {
    margin: 0 0 4px;
    font-size: 13px;
  }
  .an-marca {
    display: inline-block;
    width: 10px;
    height: 10px;
    margin-right: 6px;
    border-radius: 2px;
    vertical-align: baseline;
  }
  .an dl {
    margin: 0;
  }
  .an dl div {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 1px 0;
  }
  .an dt {
    color: var(--tinta-suave);
  }
  .an dd {
    margin: 0;
    font-family: var(--mono);
    text-align: right;
  }
  .an p {
    margin: 4px 0;
  }
  .an-nota {
    color: var(--tinta-tenue);
  }
  .an-aviso {
    color: var(--c-importante);
  }
  .an-espectro {
    display: block;
    width: 100%;
    max-width: 420px;
    margin-top: 6px;
    border: 1px solid var(--linea);
    border-radius: 6px;
    background: var(--fondo);
  }
  .an-rejilla {
    stroke: var(--linea);
    stroke-width: 0.5;
    vector-effect: non-scaling-stroke;
  }
  .boton.pequeno {
    min-height: 36px;
    padding: 0 12px;
    font-size: 13.5px;
  }
  /* (a finger's size on a touch screen) */
  @media (pointer: coarse) {
    .boton.pequeno {
      min-height: 44px;
    }
    .an summary {
      min-height: 44px;
    }
  }
</style>
