<script lang="ts">
  // The recorder of the real instruments on the bench, folded until the reader opens it: what the real Brymen and
  // the real FNIRSI show, kept over time (a trend of each, with its lowest, highest and mean) and saved as a CSV
  // file; and the FNIRSI next to the Brymen when both measure the same thing — how far apart they are and whether
  // that fits in what the two may be off by their makers' figures. Shown only where the platform can read at least
  // one of the two; the comparison, where it can read both.
  import { brymenReal } from '../../../lib/brymen-real/conexion.svelte';
  import { fnirsiReal } from '../../../lib/fnirsi-real/conexion.svelte';
  import { TEXTO_VEREDICTO, csvComparaciones, porcentaje, seFalseanJuntos, type Comparacion, type FilaComparacion } from '../../../lib/registro-real/comparar';
  import { registradorReal } from '../../../lib/registro-real/registrador.svelte';
  import { MAXIMO_MUESTRAS, NOMBRE_INSTRUMENTO, cifra, csvRegistro, duracion, type Estadisticas, type InstrumentoReal, type Punto } from '../../../lib/registro-real/registro';
  import { CANCELADO, guardarFichero } from '../../../lib/sincronizacion/fichero';
  import { formatoSI } from '../../grafica/formato';

  const r = registradorReal;
  const n = r.nucleo;
  const INSTRUMENTOS = ['brymen', 'fnirsi'] as const;
  const ANCHO = 300;
  const ALTO = 70;
  const MARGEN = 4;
  const ROTULO: Record<InstrumentoReal, string> = { brymen: 'Brymen (referencia)', fnirsi: 'FNIRSI' };

  const disponible = brymenReal.disponible || fnirsiReal.disponible;
  const conComparacion = brymenReal.disponible && fnirsiReal.disponible;

  let abierto = $state(false);
  let confirmando = $state(false);
  let aviso = $state('');
  let avisoError = $state(false);

  // the recorder is looked at while the panel is open (a record under way keeps itself going)
  $effect(() => {
    if (abierto) return r.mostrar();
  });

  interface VistaSerie {
    i: InstrumentoReal;
    lecturas: number;
    /** Numbers left out of the figures (readings «de paso»). */
    dePaso: number;
    e: Estadisticas | null;
    lineas: string[];
    puntos: Punto[];
  }

  function dibujar(trazos: Punto[][], e: Estadisticas): { lineas: string[]; puntos: Punto[] } {
    const dt = Math.max(1, e.hasta - e.desde);
    const dv = e.max - e.min;
    const x = (t: number) => MARGEN + ((t - e.desde) / dt) * (ANCHO - 2 * MARGEN);
    // (a flat record is drawn across the middle)
    const y = (v: number) => (dv > 0 ? ALTO - MARGEN - ((v - e.min) / dv) * (ALTO - 2 * MARGEN) : ALTO / 2);
    const lineas: string[] = [];
    const puntos: Punto[] = [];
    for (const t of trazos) {
      if (t.length === 1) puntos.push({ t: x(t[0]!.t), v: y(t[0]!.v) });
      else lineas.push(t.map((p) => `${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' '));
    }
    return { lineas, puntos };
  }

  const series = $derived.by((): VistaSerie[] => {
    void r.version;
    return INSTRUMENTOS.filter((i) => n.series[i].muestras.length > 0).map((i) => {
      const e = n.series[i].estadisticas();
      return { i, lecturas: n.series[i].muestras.length, dePaso: n.series[i].lecturasDePaso, e, ...(e ? dibujar(n.series[i].trazos(), e) : { lineas: [], puntos: [] }) };
    });
  });

  const estado = $derived.by(() => {
    void r.version;
    const lecturas = n.muestras;
    const ultimo = Math.max(n.series.brymen.muestras.at(-1)?.t ?? 0, n.series.fnirsi.muestras.at(-1)?.t ?? 0);
    return {
      grabando: n.grabando,
      lleno: n.lleno,
      lecturas,
      tiempo: lecturas ? duracion(ultimo - n.inicio) : '',
      hayInstrumento: n.conLectura('brymen') || n.conLectura('fnirsi'),
    };
  });

  const textoEstado = $derived(
    estado.lleno
      ? `El registro se ha detenido solo: un instrumento ha llegado a ${MAXIMO_MUESTRAS.toLocaleString('es-ES')} lecturas. Guárdelo y bórrelo para seguir.`
      : estado.grabando
        ? estado.hayInstrumento
          ? 'Registrando lo que marcan los instrumentos conectados.'
          : 'Registrando, pero no llega ninguna lectura: compruebe que el instrumento sigue conectado y, si es el FNIRSI, que está en multímetro.'
        : estado.lecturas
          ? 'Registro detenido.'
          : estado.hayInstrumento
            ? 'Listo para registrar.'
            : 'Conecte el Brymen real o el FNIRSI real (en multímetro) para registrar lo que marcan.',
  );

  interface Lado {
    i: InstrumentoReal;
    texto: string;
    retenida: boolean;
    enVivo: boolean;
    motivo: string;
  }

  const comparacion = $derived.by(() => {
    void r.version;
    const lados: Lado[] = INSTRUMENTOS.map((i) => {
      const m = n.medida(i);
      return { i, texto: m ? m.muestra.texto : n.ultima(i) || '—', retenida: !!m?.retenida, enVivo: !!n.enVivo(i), motivo: n.motivo(i) };
    });
    const c = n.comparacion();
    const juntos =
      n.conLectura('brymen') && n.conLectura('fnirsi') && !n.retenidas.brymen && !n.retenidas.fnirsi && seFalseanJuntos(n.unidadActual('brymen')) && seFalseanJuntos(n.unidadActual('fnirsi'));
    return { lados, resultado: c && typeof c !== 'string' ? (c as Comparacion) : null, noComparable: typeof c === 'string' ? c : '', juntos, filas: [...n.filas] };
  });

  /** «1 lectura», «1.234 lecturas». */
  function cuantas(k: number): string {
    return `${k.toLocaleString('es-ES')} ${k === 1 ? 'lectura' : 'lecturas'}`;
  }

  function rotuloSerie(s: VistaSerie): string {
    return [NOMBRE_INSTRUMENTO[s.i], s.e?.magnitud, cuantas(s.lecturas)].filter(Boolean).join(' · ');
  }

  /** A row of the table: the difference, its per cent and the margin it is judged against. */
  function diferenciaFila(f: FilaComparacion): string {
    let t = `${f.diferencia > 0 ? '+' : ''}${formatoSI(f.diferencia, f.unidad, 4)}`;
    if (f.relativa !== null) t += ` (${porcentaje(f.relativa)})`;
    if (f.margen !== null) t += ` · margen ± ${formatoSI(f.margen, f.unidad, 2)}`;
    return `${t} · `;
  }

  function nombreFichero(base: string): string {
    const d = new Date();
    const dos = (x: number) => String(x).padStart(2, '0');
    return `${base}-${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}-${dos(d.getHours())}${dos(d.getMinutes())}${dos(d.getSeconds())}.csv`;
  }

  async function guardar(base: string, texto: string) {
    aviso = '';
    avisoError = false;
    try {
      const hecho = await guardarFichero(nombreFichero(base), texto, 'text/csv;charset=utf-8', ['Datos (CSV)', ['csv']]);
      if (hecho !== CANCELADO) aviso = hecho === 'guardado' ? 'Fichero guardado.' : 'Fichero descargado: está en las descargas del navegador.';
    } catch (e) {
      avisoError = true;
      aviso = `No se pudo guardar el fichero: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  function iniciar() {
    aviso = '';
    confirmando = false;
    r.iniciar();
  }

  function borrar() {
    confirmando = false;
    aviso = '';
    r.borrar();
  }

  function reiniciarCifras() {
    r.reiniciarCifras();
    avisoError = false;
    aviso = 'Las cifras y las gráficas cuentan desde ahora. El registro conserva todas las lecturas.';
  }
</script>

{#if disponible}
  <details class="rr" bind:open={abierto} data-registro-real data-registrando={estado.grabando ? 'si' : 'no'}>
    <summary>
      <strong>Registrador{conComparacion ? ' y comparación' : ''}</strong>{#if estado.grabando}<span class="rr-vivo">{' · registrando'}</span>{/if}
    </summary>

    <div class="rr-botones">
      {#if estado.grabando}
        <button type="button" class="boton pequeno" onclick={() => r.detener()} data-detener-registro>Detener</button>
      {:else}
        <button type="button" class="boton primario pequeno" onclick={iniciar} disabled={estado.lleno || (!estado.hayInstrumento && !estado.lecturas)} data-iniciar-registro>
          {estado.lecturas ? 'Seguir registrando' : 'Iniciar registro'}
        </button>
      {/if}
      {#if estado.lecturas}
        <button type="button" class="boton pequeno" onclick={reiniciarCifras} data-reiniciar-cifras>Reiniciar cifras</button>
      {/if}
      {#if estado.lecturas && !estado.grabando}
        <button type="button" class="boton pequeno" onclick={() => void guardar('registro-instrumentos', csvRegistro({ brymen: n.series.brymen.muestras, fnirsi: n.series.fnirsi.muestras }, n.inicio))} data-guardar-registro>
          Guardar (CSV)
        </button>
        {#if confirmando}
          <span class="rr-confirmar">
            ¿Borrar el registro ({cuantas(estado.lecturas)})?
            <button type="button" class="boton pequeno" onclick={borrar} data-confirmar-borrar>Sí, borrar</button>
            <button type="button" class="boton pequeno" onclick={() => (confirmando = false)}>No</button>
          </span>
        {:else}
          <button type="button" class="boton pequeno" onclick={() => (confirmando = true)} data-borrar-registro>Borrar</button>
        {/if}
      {/if}
    </div>
    <p class="rr-estado" role="status" data-estado-registro>{textoEstado}</p>
    {#if estado.lecturas}
      <p class="rr-tenue" data-cuenta-registro>{cuantas(estado.lecturas)} en {estado.tiempo}</p>
    {/if}
    {#if aviso}<p class="rr-estado" class:error={avisoError} role="status" data-aviso-registro>{aviso}</p>{/if}

    {#each series as s (s.i)}
      <div class="rr-serie" data-serie-registro={s.i}>
        <span class="rr-rotulo">{rotuloSerie(s)}</span>
        {#if s.e}
          <svg
            class="rr-grafica"
            viewBox="0 0 {ANCHO} {ALTO}"
            role="img"
            aria-label="Tendencia del {NOMBRE_INSTRUMENTO[s.i]}: entre {cifra(s.e.min, s.e)} y {cifra(s.e.max, s.e)} en {duracion(s.e.hasta - s.e.desde)}"
          >
            <line x1="0" y1={ALTO / 2} x2={ANCHO} y2={ALTO / 2} class="rr-rejilla" />
            {#each s.lineas as l, k (k)}<polyline points={l} class="rr-linea rr-{s.i}" />{/each}
            {#each s.puntos as p, k (k)}<circle cx={p.t} cy={p.v} r="1.6" class="rr-punto rr-{s.i}" />{/each}
          </svg>
          <dl class="rr-cifras">
            <div><dt>Mín.</dt><dd data-minimo>{cifra(s.e.min, s.e)}</dd></div>
            <div><dt>Máx.</dt><dd data-maximo>{cifra(s.e.max, s.e)}</dd></div>
            <div><dt>Media</dt><dd data-media>{cifra(s.e.media, s.e, 1)}</dd></div>
            <div><dt>Desv. típica</dt><dd data-desviacion>{formatoSI(s.e.desviacion, s.e.unidad, 3)}</dd></div>
          </dl>
        {:else}
          <p class="rr-tenue">Todavía sin ninguna lectura con número.</p>
        {/if}
        {#if s.dePaso}
          <p class="rr-tenue" data-de-paso-registro={s.dePaso}>
            {s.dePaso === 1 ? 'No cuenta 1 lectura de paso' : `No cuentan ${s.dePaso} lecturas de paso`} (al poner o quitar las puntas, o mientras el instrumento busca escala).
            {s.dePaso === 1 ? 'Sigue' : 'Siguen'} en el fichero.
          </p>
        {/if}
      </div>
    {/each}

    {#if conComparacion}
      <div class="rr-comp" data-comparacion-real>
        <h3>El FNIRSI frente al Brymen</h3>
        <p class="rr-tenue">Ponga los dos a medir lo mismo, en la misma función. Se comparan cuando la lectura de cada uno se queda quieta.</p>
        <div class="rr-par">
          {#each comparacion.lados as l (l.i)}
            <div class="rr-lado" data-lado-comparacion={l.i}>
              <span class="rr-rotulo">{l.retenida ? `${ROTULO[l.i]} · retenida` : ROTULO[l.i]}</span>
              <output class="rr-valor" data-valor-comparacion>{l.texto}</output>
              {#if l.motivo}<span class="rr-tenue" data-motivo-comparacion>{l.motivo}</span>{/if}
              {#if l.retenida}
                <button type="button" class="boton pequeno" onclick={() => r.soltar(l.i)} data-soltar={l.i}>Soltar</button>
              {:else}
                <button type="button" class="boton pequeno" onclick={() => r.retener(l.i)} disabled={!l.enVivo} data-retener={l.i} aria-label="Retener la lectura del {l.i === 'brymen' ? 'Brymen' : 'FNIRSI'}">Retener</button>
              {/if}
            </div>
          {/each}
        </div>
        {#if comparacion.juntos}
          <p class="rr-aviso" data-aviso-juntos>
            Dos instrumentos no pueden medir resistencia o capacidad a la vez sobre la misma pieza: cada uno inyecta su propia corriente de prueba y falsea al otro. Mida con uno, pulse «Retener», retire
            sus puntas y mida con el otro.
          </p>
        {/if}
        {#if comparacion.noComparable}
          <p class="rr-resultado" data-resultado-comparacion="no-comparable">{comparacion.noComparable}</p>
        {:else if comparacion.resultado}
          <p class="rr-resultado" class:fuera={comparacion.resultado.veredicto === 'fuera'} data-resultado-comparacion={comparacion.resultado.veredicto}>{comparacion.resultado.texto}</p>
        {/if}
        <div class="rr-botones">
          <button type="button" class="boton pequeno" onclick={() => r.anotar()} disabled={!comparacion.resultado} data-anotar-comparacion>Anotar en la tabla</button>
        </div>
        {#if comparacion.filas.length}
          <ol class="rr-filas" aria-label="Comparaciones anotadas" data-filas-comparacion={comparacion.filas.length}>
            {#each comparacion.filas as f, k (k)}
              <li>
                <span class="rr-escala">{f.magnitud} · escala de {f.escala}</span>
                <span>FNIRSI {f.textoFnirsi} · Brymen {f.textoBrymen}</span>
                <span>{diferenciaFila(f)}<strong class:fuera={f.veredicto === 'fuera'}>{TEXTO_VEREDICTO[f.veredicto]}{f.veredicto === 'sin-exactitud' ? ' de exactitud' : ' del margen'}</strong></span>
              </li>
            {/each}
          </ol>
          <div class="rr-botones">
            <button type="button" class="boton pequeno" onclick={() => void guardar('comparacion-fnirsi-brymen', csvComparaciones(n.filas))} data-guardar-tabla>Guardar la tabla (CSV)</button>
            <button type="button" class="boton pequeno" onclick={() => r.vaciarTabla()} data-vaciar-tabla>Vaciar la tabla</button>
          </div>
        {/if}
      </div>
    {/if}
  </details>
{/if}

<style>
  .rr {
    margin: 4px 0;
    padding: 4px 10px 8px;
    border: 1px solid var(--linea);
    border-radius: 10px;
    background: var(--superficie);
    font-family: var(--sans);
    font-size: 13px;
  }
  .rr summary {
    min-height: 36px;
    display: flex;
    align-items: center;
    cursor: pointer;
  }
  .rr-vivo {
    color: var(--c-importante);
    font-weight: 400;
  }
  .rr-botones {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin-top: 4px;
  }
  .boton.pequeno {
    min-height: 36px;
    padding: 0 12px;
    font-size: 13.5px;
  }
  /* (a finger's size on a touch screen) */
  @media (pointer: coarse) {
    .boton.pequeno,
    .rr summary {
      min-height: 44px;
    }
  }
  .rr-confirmar {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }
  .rr-estado {
    margin: 6px 0 0;
    color: var(--tinta-suave);
  }
  .rr-estado.error {
    color: var(--c-precaucion);
  }
  .rr-rotulo,
  .rr-tenue {
    color: var(--tinta-tenue);
    font-size: 12px;
  }
  p.rr-tenue {
    margin: 2px 0 0;
  }
  .rr-serie {
    margin-top: 10px;
  }
  .rr-grafica {
    display: block;
    width: 100%;
    max-width: 420px;
    margin-top: 4px;
    border: 1px solid var(--linea);
    border-radius: 6px;
    background: var(--fondo);
  }
  .rr-rejilla {
    stroke: var(--linea);
    stroke-width: 0.5;
    vector-effect: non-scaling-stroke;
  }
  .rr-linea {
    fill: none;
    stroke-width: 1.3;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }
  .rr-linea.rr-brymen {
    stroke: #d99a1c;
  }
  .rr-linea.rr-fnirsi {
    stroke: #3b8fd9;
  }
  .rr-punto.rr-brymen {
    fill: #d99a1c;
  }
  .rr-punto.rr-fnirsi {
    fill: #3b8fd9;
  }
  .rr-cifras {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 2px 12px;
    margin: 4px 0 0;
  }
  .rr-cifras div {
    display: flex;
    justify-content: space-between;
    gap: 6px;
  }
  .rr-cifras dt {
    color: var(--tinta-tenue);
  }
  .rr-cifras dd {
    margin: 0;
    font-family: var(--mono);
  }
  .rr-comp {
    margin-top: 12px;
    padding-top: 8px;
    border-top: 1px solid var(--linea);
  }
  .rr-comp h3 {
    margin: 0;
    font-size: 14px;
    color: var(--titulos);
  }
  .rr-par {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin-top: 6px;
  }
  .rr-lado {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
  }
  .rr-valor {
    font-family: var(--mono);
    font-size: 15px;
    font-weight: 700;
  }
  .rr-aviso {
    margin: 6px 0 0;
    color: var(--c-importante);
  }
  .rr-resultado {
    margin: 6px 0 0;
  }
  .rr-resultado.fuera,
  strong.fuera {
    color: var(--c-precaucion);
  }
  .rr-filas {
    margin: 8px 0 0;
    padding-left: 22px;
  }
  .rr-filas li {
    margin: 4px 0;
  }
  .rr-filas li span {
    display: block;
  }
  .rr-escala {
    color: var(--tinta-tenue);
    font-size: 12px;
  }
</style>
