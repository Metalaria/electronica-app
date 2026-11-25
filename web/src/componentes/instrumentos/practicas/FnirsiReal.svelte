<script lang="ts">
  // The real FNIRSI 2C53T on the bench: «Conectar el FNIRSI real» (only where this platform can read its USB link:
  // the app on Windows, macOS and Android, or a desktop browser with WebHID), the connection's state, and what the
  // instrument is measuring right now: its multimeter's display, or its oscilloscope's traces with the same
  // measurements its own screen shows. It needs the instrument's firmware with the «stock-link» patch; everything
  // else on the page works the same without it.
  // 1.4: next to the simulated FNIRSI's values at the same point (`simulado`: its multimeter's display, its channels'
  // Vpp and frequency), with the difference in words (lib/fnirsi-real/comparar.ts: only what the decoder backs).
  // 1.4.2: when a probe moves, the instrument changes range and for one or two frames (0.17 s each) its reading is not
  // reliable (a blank display, or the display and the firmware not yet naming the same unit). Those frames are right,
  // but their warning flickered too fast to read: a warning now shows once it has lasted AVISO_MS, and in the meantime
  // the comparison with the simulated one stays as it was instead of vanishing for a frame.
  import { untrack } from 'svelte';
  import { fnirsiReal } from '../../../lib/fnirsi-real/conexion.svelte';
  import { textoPantalla } from '../../../lib/brymen-real/lectura';
  import { CUENTAS_POR_DIVISION, DIVISIONES_X, DIVISIONES_Y, MUESTRAS_POR_DIVISION, medirTraza, ventana, type Traza } from '../../../lib/fnirsi-real/osciloscopio';
  import { formatoSI } from '../../grafica/formato';
  import { compararTraza, explicarDiferenciaFnirsi, type SimuladoFnirsi } from '../../../lib/fnirsi-real/comparar';
  import AnalisisTraza from './AnalisisTraza.svelte';
  import CursoresTraza from './CursoresTraza.svelte';
  import ExtrasMultimetro from './ExtrasMultimetro.svelte';
  import OndaGenerador from './OndaGenerador.svelte';
  import type { Cursores } from '../../../lib/fnirsi-real/cursores';
  import { ANCHO_PROMEDIO, Promediador, type TrazaPromediada } from '../../../lib/fnirsi-real/promedio';

  let {
    compacto = false,
    sinConectar = 'Sin conectar: necesita el FNIRSI 2C53T con el firmware del enlace USB.',
    simulado = null,
  }: {
    /** Small, as in the free bench's side column. */
    compacto?: boolean;
    /** What the state line says before connecting. */
    sinConectar?: string;
    /** 1.4: the simulated FNIRSI's values at the same point (null: nothing to compare with). */
    simulado?: SimuladoFnirsi | null;
  } = $props();

  const c = fnirsiReal;
  const ANCHO = DIVISIONES_X * MUESTRAS_POR_DIVISION;
  const ALTO = DIVISIONES_Y * CUENTAS_POR_DIVISION;
  /** Sample value at the bottom edge of the screen (the middle, 128, is the screen's centre line). */
  const BASE = 128 - ALTO / 2;
  const COLOR = ['#d99a1c', '#3b8fd9'] as const;
  const FUNCIONES: Record<string, string> = {
    auto: 'Auto', vdc: 'Tensión continua', vac: 'Tensión alterna', ohm: 'Resistencia', diodo: 'Diodo', continuidad: 'Continuidad',
    temperatura: 'Temperatura', madc: 'Corriente continua (mA)', maac: 'Corriente alterna (mA)', adc: 'Corriente continua (A)',
    aac: 'Corriente alterna (A)', capacidad: 'Capacidad', desconocida: 'Función desconocida',
  };

  const activo = $derived(c.estado === 'conectando' || c.estado === 'conectado' || c.estado === 'reconectando');
  const estadoTexto = $derived(c.estado === 'desconectado' ? sinConectar : c.mensaje || (c.estado === 'conectado' ? `Conectado (${c.nombre}).` : ''));
  const lectura = $derived(c.estado === 'conectado' && c.modo === 'multimetro' ? c.multimetro : null);
  const trazas = $derived(c.estado === 'conectado' ? c.trazas.filter((t): t is Traza => t !== null) : []);
  /** Alternating voltage: the frequency the instrument shows above the reading. */
  const frecuencia = $derived(lectura && lectura.frecuencia !== null ? ` · ${lectura.frecuencia} Hz` : '');
  /** What the stream does not carry and the connection asks for (lib/fnirsi-real/estado.ts). */
  const generador = $derived.by(() => {
    const g = c.estado === 'conectado' && (c.modo === 'generador' || c.modo === 'osciloscopio') ? c.generador : null;
    if (!g) return '';
    const forma = g.nombre ? `${g.nombre} (${g.rotulo})` : `forma n.º ${g.forma + 1} de su menú`;
    const amplitud = g.amplitud.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    return `Generador del FNIRSI: ${forma} · ${formatoSI(g.frecuencia, 'Hz', 4)} · ciclo ${g.ciclo} % · ${amplitud} V`;
  });
  const enOsciloscopio = $derived(c.estado === 'conectado' && c.modo === 'osciloscopio');
  // 2.1 (owner, 25-11): the instrument's own measurements of the channels that are ON (the last trace's header says
  // which), each with its channel. 2.0 always showed CH1's, which with CH1 off was the noise of a channel that is off
  // («0 Hz · … · Vpp 4,000 mV»). CH2's come only with the status stream (patch 3).
  const canalesOn = $derived.by((): [boolean, boolean] | null => {
    const t = c.trazas.find((x) => x !== null);
    return t ? [t.ajustes.canales[0].activo, t.ajustes.canales[1].activo] : null;
  });
  const medidas = $derived.by((): { canal: string; texto: string }[] => {
    if (!enOsciloscopio || !canalesOn) return [];
    if (!canalesOn[0] && !canalesOn[1]) return [{ canal: 'ninguno', texto: 'Los dos canales del FNIRSI están apagados: no da medidas.' }];
    const res: { canal: string; texto: string }[] = [];
    ([0, 1] as const).forEach((k) => {
      if (!canalesOn[k]) return;
      const m = k === 0 ? c.medidas : c.medidasCh2;
      if (!m) {
        if (k === 1 && c.info && !c.info.estadoEnFlujo) res.push({ canal: 'CH2', texto: 'Las medidas propias de CH2 solo llegan con el flujo de estado del enlace (parche 3).' });
        return;
      }
      const ciclo = m.ciclo.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      // (with the probe setting at X10 the instrument gives these ten times larger, as its screen does: checked on
      // the unit on 2026-11-25 for both channels, X1 and X10)
      res.push({
        canal: `CH${k + 1}`,
        texto: `Medidas del propio FNIRSI en CH${k + 1}: ${formatoSI(m.frecuencia, 'Hz', 4)} · ciclo ${ciclo} % · Vpp ${formatoSI(m.vpp, 'V', 4)} · Vmáx ${formatoSI(m.vmax, 'V', 4)} · Vmín ${formatoSI(m.vmin, 'V', 4)}`,
      });
    });
    return res;
  });
  /** The simulated multimeter's display, and the difference when both measure the same unit (SI base). */
  const simMultimetro = $derived(lectura ? (simulado?.multimetro ?? null) : null);
  const comparacion = $derived.by(() => {
    const l = lectura;
    const sm = simMultimetro;
    if (!l || !sm || !l.fiable || l.esperando || l.pantalla.valor === null || l.pantalla.ol || sm.valor === null) return '';
    if (!l.pantalla.unidad || !sm.unidad.endsWith(l.pantalla.unidad)) return '';
    return explicarDiferenciaFnirsi(l.pantalla, sm.valor, 'el simulado', l.pantalla.unidad, l);
  });

  /** How long a reading must stay unreliable before its warning shows (three frames and a half). */
  const AVISO_MS = 600;
  /** The reading is unreliable right now (a boolean, so the timer below is not restarted by every frame). */
  // 1.4.3: the simulated oscilloscope sweeps about eight times a second and its measurements move a little with every
  // sweep (a sample or two of its converter); written straight into the comparison, the line was rewritten eight
  // times a second, which showed most with the real one in STOP, whose side does not move. The comparison of each
  // channel is now refreshed once a second, and at once when a channel's comparison appears or goes.
  const REFRESCO_TRAZA_MS = 1000;
  const comparacionesTrazaAhora = $derived(
    ([0, 1] as const).map((k) => {
      const t = trazas.find((x) => x.canal === k);
      const s = simulado?.canales[k];
      return t && s ? compararTraza(t, s) : '';
    }),
  );
  let comparacionesTraza = $state(['', '']);
  $effect(() => {
    const nuevas = comparacionesTrazaAhora;
    untrack(() => {
      if (nuevas.some((x, i) => !x !== !comparacionesTraza[i])) comparacionesTraza = nuevas;
    });
  });
  $effect(() => {
    const t = setInterval(() => {
      const nuevas = comparacionesTrazaAhora;
      if (nuevas.some((x, i) => x !== comparacionesTraza[i])) comparacionesTraza = nuevas;
    }, REFRESCO_TRAZA_MS);
    return () => clearInterval(t);
  });

  const noFiable = $derived(!!lectura && !lectura.fiable && !lectura.esperando);
  let avisoListo = $state(false);
  $effect(() => {
    if (!noFiable) {
      avisoListo = false;
      return;
    }
    if (avisoListo) return;
    const t = setTimeout(() => (avisoListo = true), AVISO_MS);
    return () => clearTimeout(t);
  });
  /** The comparison as shown: the last one is kept while a range change has not lasted long enough to warn. */
  let comparacionMostrada = $state('');
  $effect(() => {
    if (comparacion) comparacionMostrada = comparacion;
    else if (!(noFiable && !avisoListo)) comparacionMostrada = '';
  });

  // The average of the last N acquisitions of each channel (lib/fnirsi-real/promedio.ts), the application's own:
  // «no» draws and analyses each record as it arrives.
  const OPCIONES_PROMEDIO = [1, 4, 16, 64];
  let nPromedio = $state(1);
  const promediadores = [new Promediador(1), new Promediador(1)];
  let promedios = $state.raw<(TrazaPromediada | null)[]>([null, null]);
  /** A channel whose record has a wave but no crossing to align it on: it is shown as it arrives. */
  let sinAlinear = $state.raw<boolean[]>([false, false]);
  // (what the effect below last published, kept outside the reactive graph: it must not depend on what it writes)
  const vistas: (Traza | null)[] = [null, null];
  const publicados: (TrazaPromediada | null)[] = [null, null];
  const fallidos: boolean[] = [false, false];
  $effect(() => {
    const n = nPromedio;
    const ts = c.estado === 'conectado' ? c.trazas : [null, null];
    let cambio = false;
    for (const k of [0, 1]) {
      const t = ts[k] ?? null;
      const p = promediadores[k]!;
      if (n === 1 || !t) {
        p.vaciar();
        vistas[k] = null;
        if (publicados[k] || fallidos[k]) cambio = true;
        publicados[k] = null;
        fallidos[k] = false;
        continue;
      }
      p.fijar(n);
      if (vistas[k] === t) continue;
      vistas[k] = t;
      const entra = p.anadir(t);
      if (!entra) p.vaciar();
      publicados[k] = entra ? p.resultado() : null;
      fallidos[k] = !entra;
      cambio = true;
    }
    if (cambio) {
      promedios = [...publicados];
      sinAlinear = [...fallidos];
    }
  });

  /** The samples that are drawn for a trace: the middle of its average when there is one, else its own window. */
  function dibujada(t: Traza): ArrayLike<number> {
    const p = promedios[t.canal];
    if (p) return p.muestras.subarray((ANCHO_PROMEDIO - ANCHO) / 2, (ANCHO_PROMEDIO + ANCHO) / 2);
    return ventana(t, ANCHO).muestras;
  }

  /** The application's cursors on the drawing (lib/fnirsi-real/cursores.ts): time in samples, voltage in sample values. */
  let cursores = $state<Cursores>({ activo: false, t1: 100, t2: 200, v1: 103, v2: 153 });
  const ventanas = $derived(trazas.map((t) => ({ canal: t.canal, ajustes: t.ajustes, muestras: dibujada(t) })));

  /** The trace as the instrument draws it: 300 samples around the trigger, in screen units. */
  function puntos(t: Traza): string {
    const v = dibujada(t);
    let s = '';
    for (let k = 0; k < v.length; k++) s += `${k},${Math.max(0, Math.min(ALTO, ALTO - (v[k]! - BASE)))} `;
    return s;
  }

  function resumen(t: Traza): string {
    const m = medirTraza(t);
    const a = t.ajustes.canales[t.canal];
    const partes = [`${formatoSI(a.voltiosDiv, 'V', 3)}/div`, `X${a.sonda}`, `Vpp ${formatoSI(m.picoPico, 'V', 3)}`];
    if (m.frecuencia !== null) partes.push(`${formatoSI(m.frecuencia, 'Hz', 3)}`);
    return partes.join(' · ');
  }

  const rejilla = { x: Array.from({ length: DIVISIONES_X - 1 }, (_, k) => (k + 1) * MUESTRAS_POR_DIVISION), y: Array.from({ length: DIVISIONES_Y - 1 }, (_, k) => (k + 1) * CUENTAS_POR_DIVISION) };
</script>

{#if c.disponible}
  <section class="fr-real" class:compacto aria-label="FNIRSI real" data-fnirsi-real data-conexion-fnirsi={c.estado}>
    <div class="fr-cab">
      <strong>FNIRSI real</strong>
      {#if activo}
        <button type="button" class="boton pequeno" onclick={() => void c.desconectar()} data-desconectar-fnirsi>Desconectar</button>
      {:else}
        <button type="button" class="boton primario pequeno" onclick={() => void c.conectar()} data-conectar-fnirsi>Conectar el FNIRSI real</button>
      {/if}
    </div>
    <p class="fr-estado" class:error={c.estado === 'error'} role="status" aria-live="polite" data-estado-fnirsi>{estadoTexto}</p>
    {#if lectura}
      <div class="fr-lecturas">
        <div class="fr-lectura">
          <span class="fr-rotulo" data-funcion-fnirsi>Multímetro · {FUNCIONES[lectura.funcion]}{frecuencia}</span>
          <output class="fr-valor" data-lectura-fnirsi>{lectura.esperando ? 'Auto' : textoPantalla(lectura.pantalla)}</output>
        </div>
        {#if simMultimetro}
          <div class="fr-lectura">
            <span class="fr-rotulo">Simulado</span>
            <output class="fr-valor" data-lectura-fnirsi-simulada>{simMultimetro.texto}</output>
          </div>
        {/if}
      </div>
      {#if noFiable && avisoListo}<p class="fr-aviso" data-aviso-fnirsi>{lectura.motivo}</p>{/if}
      {#if lectura.hold && lectura.fiable}<p class="fr-tenue" data-hold-fnirsi>HOLD: la pantalla del FNIRSI está congelada, y esta lectura con ella.</p>{/if}
      {#if comparacionMostrada}<p class="fr-comparacion" data-comparacion-fnirsi>{comparacionMostrada}</p>{/if}
      <ExtrasMultimetro {lectura} />
    {/if}
    {#if trazas.length}
      <svg class="fr-pantalla" viewBox="0 0 {ANCHO} {ALTO}" role="img" aria-label="Trazas del osciloscopio del FNIRSI" data-trazas-fnirsi={trazas.length}>
        {#each rejilla.x as x (x)}<line x1={x} y1="0" x2={x} y2={ALTO} class="fr-rejilla" />{/each}
        {#each rejilla.y as y (y)}<line x1="0" y1={y} x2={ANCHO} y2={y} class="fr-rejilla" />{/each}
        {#each trazas as t (t.canal)}<polyline points={puntos(t)} fill="none" stroke={COLOR[t.canal]} stroke-width="1.2" vector-effect="non-scaling-stroke" />{/each}
        {#if cursores.activo}
          {#each [['T1', cursores.t1], ['T2', cursores.t2]] as const as [nombre, x] (nombre)}
            <line x1={x} y1="0" x2={x} y2={ALTO} class="fr-cursor" data-linea-cursor={nombre} />
            <text x={Math.min(ANCHO - 14, x + 2)} y="9" class="fr-cursor-texto">{nombre}</text>
          {/each}
          {#each [['V1', cursores.v1], ['V2', cursores.v2]] as const as [nombre, v] (nombre)}
            <line x1="0" y1={ALTO - (v - BASE)} x2={ANCHO} y2={ALTO - (v - BASE)} class="fr-cursor" data-linea-cursor={nombre} />
            <text x="2" y={Math.max(9, ALTO - (v - BASE) - 2)} class="fr-cursor-texto">{nombre}</text>
          {/each}
        {/if}
      </svg>
      <ul class="fr-canales">
        {#each trazas as t (t.canal)}
          <li data-canal-fnirsi={t.canal + 1}>
            <span class="fr-marca" style:background={COLOR[t.canal]}></span>CH{t.canal + 1}: {resumen(t)}{#if t.saturada} · <span class="fr-aviso">la señal se sale de la escala: suba los V/div</span>{/if}{#if !t.ajustes.canales[t.canal].comprobado} · <span class="fr-tenue">escala de CH2 sin comprobar</span>{/if}
          </li>
          {#if comparacionesTraza[t.canal]}<li class="fr-comparacion" data-comparacion-traza={t.canal + 1}>{comparacionesTraza[t.canal]}</li>{/if}
        {/each}
        <li class="fr-tenue">
          Base de tiempos: {formatoSI(trazas[0]!.ajustes.tiempoDiv, 's', 3)}/div{#if !trazas[0]!.ajustes.tiempoComprobado} (escala de tiempo sin comprobar en esta base){/if}
        </li>
      </ul>
      <p class="fr-promedio">
        <label>Promediar <select bind:value={nPromedio} data-promedio-fnirsi>{#each OPCIONES_PROMEDIO as n (n)}<option value={n}>{n === 1 ? 'no' : `${n} adquisiciones`}</option>{/each}</select></label>
        {#if nPromedio > 1}
          <span class="fr-tenue" data-promedio-estado>
            {#each trazas as t (t.canal)}
              {@const p = promedios[t.canal]}
              CH{t.canal + 1}: {p ? `promedio de ${p.adquisiciones} ${p.adquisiciones === 1 ? 'adquisición' : 'adquisiciones'}` : sinAlinear[t.canal] ? 'sin promediar: en el registro no hay un flanco con sitio a los dos lados para alinear las adquisiciones' : 'esperando'}.{' '}
            {/each}
            Lo hace la aplicación; la línea de cada canal sigue siendo la de la última adquisición.
          </span>
        {/if}
      </p>
      <CursoresTraza bind:cursores {ventanas} ancho={ANCHO} minimo={BASE} maximo={BASE + ALTO} />
      <AnalisisTraza {trazas} {promedios} />
    {/if}
    {#if enOsciloscopio && c.enMarcha === false}<p class="fr-tenue" data-marcha-fnirsi>Osciloscopio en STOP: la traza y las medidas son las de la última adquisición.</p>{/if}
    {#each medidas as m (m.canal)}<p class="fr-tenue" data-medidas-fnirsi={m.canal}>{m.texto}</p>{/each}
    <!-- 2.1 (owner, 25-11): the arrows have a mode that SELECT changes; the link does not carry it, so a fixed hint -->
    {#if enOsciloscopio}<p class="fr-tenue" data-ayuda-select-real>Si las flechas no cambian la base de tiempos, pulse SELECT.</p>{/if}
    {#if generador}<p class="fr-tenue" data-generador-fnirsi>{generador}</p>{/if}
    {#if (c.estado === 'conectado' || c.estado === 'reconectando') && c.info?.ondasAMedida}<OndaGenerador />{/if}
    {#if c.estado !== 'desconectado'}
      <details class="fr-diag">
        <summary>Diagnóstico</summary>
        <p>
          Vía: {c.tipo === 'nativo' ? 'la aplicación (USB)' : c.tipo === 'webhid' ? 'WebHID del navegador' : 'prueba'} · modo del FNIRSI: {c.modo} · informes recibidos: {c.informes}{#if c.perdidos} · perdidos: {c.perdidos}{/if}
        </p>
        {#if c.info}<p data-enlace-fnirsi>Enlace: protocolo {c.info.protocolo}, parche {c.info.parche} · {c.info.estadoEnFlujo ? 'envía por sí mismo el generador, las medidas del osciloscopio y RUN/STOP' : c.sinLectura ? 'el generador, las medidas del osciloscopio y RUN/STOP no llegan por esta vía: hace falta el parche 3 del enlace' : 'el generador, las medidas del osciloscopio y RUN/STOP se le preguntan'}{c.info.ondasAMedida ? ' · admite ondas a medida en el generador' : ''}</p>{/if}
        {#if c.multimetro}<p class="fr-crudo">Última trama del multímetro: <code data-crudo-fnirsi>{c.multimetro.crudo}</code></p>{/if}
      </details>
    {/if}
  </section>
{/if}

<style>
  .fr-real {
    margin: 12px 0;
    padding: 10px 12px;
    border: 1px solid var(--linea);
    border-radius: 10px;
    background: var(--superficie);
    font-family: var(--sans);
    font-size: 14px;
  }
  .fr-real.compacto {
    margin: 4px 0;
    padding: 8px 10px;
    font-size: 13px;
  }
  .fr-cab {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
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
  }
  .fr-estado {
    margin: 6px 0 0;
    color: var(--tinta-suave);
  }
  .compacto .fr-estado {
    margin-top: 4px;
  }
  .fr-estado.error {
    color: var(--c-precaucion);
  }
  .fr-lecturas {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 24px;
    margin-top: 8px;
  }
  .fr-lectura {
    display: flex;
    flex-direction: column;
  }
  p.fr-aviso {
    margin: 6px 0 0;
  }
  .fr-comparacion {
    margin: 6px 0 0;
    font-size: 13px;
  }
  .fr-rotulo,
  .fr-tenue {
    color: var(--tinta-tenue);
    font-size: 12px;
  }
  .fr-valor {
    font-family: var(--mono);
    font-size: 18px;
    font-weight: 700;
  }
  .compacto .fr-valor {
    font-size: 16px;
  }
  .fr-aviso {
    color: var(--c-importante);
    font-size: 12.5px;
  }
  .fr-pantalla {
    display: block;
    width: 100%;
    max-width: 420px;
    margin-top: 8px;
    border: 1px solid var(--linea);
    border-radius: 6px;
    background: var(--fondo);
  }
  .fr-rejilla {
    stroke: var(--linea);
    stroke-width: 0.5;
    vector-effect: non-scaling-stroke;
  }
  .fr-cursor {
    stroke: var(--tinta-suave);
    stroke-width: 1;
    stroke-dasharray: 4 3;
    vector-effect: non-scaling-stroke;
  }
  .fr-cursor-texto {
    fill: var(--tinta-suave);
    font-size: 8px;
    font-family: var(--sans);
  }
  .fr-promedio {
    margin: 6px 0 0;
    font-size: 12.5px;
  }
  .fr-promedio select {
    min-height: 32px;
    margin: 0 6px;
    padding: 0 6px;
    border: 1px solid var(--linea);
    border-radius: 6px;
    /* (the card's own colours: a native select keeps a light background in the dark themes) */
    background: var(--superficie);
    color: inherit;
    font: inherit;
  }
  @media (pointer: coarse) {
    .fr-promedio select {
      min-height: 44px;
    }
  }
  .fr-canales {
    margin: 6px 0 0;
    padding: 0;
    list-style: none;
    font-size: 12.5px;
  }
  .fr-canales li {
    margin: 2px 0;
  }
  .fr-marca {
    display: inline-block;
    width: 10px;
    height: 10px;
    margin-right: 6px;
    border-radius: 2px;
    vertical-align: baseline;
  }
  .fr-diag {
    margin-top: 6px;
    color: var(--tinta-tenue);
    font-size: 12.5px;
  }
  .fr-diag summary {
    min-height: 32px;
    display: flex;
    align-items: center;
    cursor: pointer;
  }
  .fr-diag p {
    margin: 2px 0;
  }
  .fr-crudo code {
    word-break: break-all;
  }
</style>
