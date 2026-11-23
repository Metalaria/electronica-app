<script lang="ts">
  // The real FNIRSI 2C53T on the bench: «Conectar el FNIRSI real» (only where this platform can read its USB link:
  // the app on Windows, macOS and Android, or a desktop browser with WebHID), the connection's state, and what the
  // instrument is measuring right now: its multimeter's display, or its oscilloscope's traces with the same
  // measurements its own screen shows. It needs the instrument's firmware with the «stock-link» patch; everything
  // else on the page works the same without it.
  // 1.4: next to the simulated FNIRSI's values at the same point (`simulado`: its multimeter's display, its channels'
  // Vpp and frequency), with the difference in words (lib/fnirsi-real/comparar.ts: only what the decoder backs).
  import { fnirsiReal } from '../../../lib/fnirsi-real/conexion.svelte';
  import { textoPantalla } from '../../../lib/brymen-real/lectura';
  import { CUENTAS_POR_DIVISION, DIVISIONES_X, DIVISIONES_Y, MUESTRAS_POR_DIVISION, medirTraza, ventana, type Traza } from '../../../lib/fnirsi-real/osciloscopio';
  import { formatoSI } from '../../grafica/formato';
  import { compararTraza, explicarDiferenciaFnirsi, type SimuladoFnirsi } from '../../../lib/fnirsi-real/comparar';

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
  /** The simulated multimeter's display, and the difference when both measure the same unit (SI base). */
  const simMultimetro = $derived(lectura ? (simulado?.multimetro ?? null) : null);
  const comparacion = $derived.by(() => {
    const l = lectura;
    const sm = simMultimetro;
    if (!l || !sm || !l.fiable || l.esperando || l.pantalla.valor === null || l.pantalla.ol || sm.valor === null) return '';
    if (!l.pantalla.unidad || !sm.unidad.endsWith(l.pantalla.unidad)) return '';
    return explicarDiferenciaFnirsi(l.pantalla, sm.valor, 'el simulado', l.pantalla.unidad);
  });

  /** The trace as the instrument draws it: 300 samples around the trigger, in screen units. */
  function puntos(t: Traza): string {
    const v = ventana(t, ANCHO).muestras;
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
          <span class="fr-rotulo">Multímetro · {FUNCIONES[lectura.funcion]}</span>
          <output class="fr-valor" data-lectura-fnirsi>{lectura.esperando ? 'Auto' : textoPantalla(lectura.pantalla)}</output>
        </div>
        {#if simMultimetro}
          <div class="fr-lectura">
            <span class="fr-rotulo">Simulado</span>
            <output class="fr-valor" data-lectura-fnirsi-simulada>{simMultimetro.texto}</output>
          </div>
        {/if}
      </div>
      {#if !lectura.fiable && !lectura.esperando}<p class="fr-aviso" data-aviso-fnirsi>{lectura.motivo}</p>{/if}
      {#if comparacion}<p class="fr-comparacion" data-comparacion-fnirsi>{comparacion}</p>{/if}
    {/if}
    {#if trazas.length}
      <svg class="fr-pantalla" viewBox="0 0 {ANCHO} {ALTO}" role="img" aria-label="Trazas del osciloscopio del FNIRSI" data-trazas-fnirsi={trazas.length}>
        {#each rejilla.x as x (x)}<line x1={x} y1="0" x2={x} y2={ALTO} class="fr-rejilla" />{/each}
        {#each rejilla.y as y (y)}<line x1="0" y1={y} x2={ANCHO} y2={y} class="fr-rejilla" />{/each}
        {#each trazas as t (t.canal)}<polyline points={puntos(t)} fill="none" stroke={COLOR[t.canal]} stroke-width="1.2" vector-effect="non-scaling-stroke" />{/each}
      </svg>
      <ul class="fr-canales">
        {#each trazas as t (t.canal)}
          <li data-canal-fnirsi={t.canal + 1}>
            <span class="fr-marca" style:background={COLOR[t.canal]}></span>CH{t.canal + 1}: {resumen(t)}{#if t.saturada} · <span class="fr-aviso">la señal se sale de la escala: suba los V/div</span>{/if}{#if !t.ajustes.canales[t.canal].comprobado} · <span class="fr-tenue">escala de CH2 sin comprobar</span>{/if}
          </li>
          {#if simulado?.canales[t.canal]}<li class="fr-comparacion" data-comparacion-traza={t.canal + 1}>{compararTraza(t, simulado.canales[t.canal]!)}</li>{/if}
        {/each}
        <li class="fr-tenue">
          Base de tiempos: {formatoSI(trazas[0]!.ajustes.tiempoDiv, 's', 3)}/div{#if !trazas[0]!.ajustes.tiempoComprobado} (escala de tiempo sin comprobar en esta base){/if}
        </li>
      </ul>
    {/if}
    {#if c.estado !== 'desconectado'}
      <details class="fr-diag">
        <summary>Diagnóstico</summary>
        <p>
          Vía: {c.tipo === 'nativo' ? 'la aplicación (USB)' : c.tipo === 'webhid' ? 'WebHID del navegador' : 'prueba'} · modo del FNIRSI: {c.modo} · informes recibidos: {c.informes}{#if c.perdidos} · perdidos: {c.perdidos}{/if}
        </p>
        {#if c.info}<p>Enlace: protocolo {c.info.protocolo}, parche {c.info.parche}</p>{/if}
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
