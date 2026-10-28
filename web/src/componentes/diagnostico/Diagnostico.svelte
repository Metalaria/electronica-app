<script lang="ts">
  // «Diagnóstico de rendimiento» (#/diagnostico, reached from «Ajustes»): measures, on the reader's own device,
  // WebGL 2, the 3D component viewer while it turns, the SDR board (load and turning), the live layout of a few
  // big automatic schematics and a short ngspice simulation, and shows the results in a table with «Copiar
  // resultados» (plain text to paste in a conversation). Nothing heavy runs until «Empezar». 0.9: the Neo Geo
  // board in 3D, and breadcrumbs of every test in localStorage: a test that froze or closed the app is reported
  // the next time this page opens («La última prueba se quedó en: … tras N s»).
  import { onDestroy } from 'svelte';
  import Gauge from '@lucide/svelte/icons/gauge';
  import Copy from '@lucide/svelte/icons/copy';
  import Check from '@lucide/svelte/icons/check';
  import { VERSION_APP } from '../../lib/sincronizacion/version-app';
  import ScrollText from '@lucide/svelte/icons/scroll-text';
  import Download from '@lucide/svelte/icons/download';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import { lineasRegistro, textoRegistro, borrarRegistro, erroresRegistro } from '../../lib/registro';
  import {
    infoDispositivo,
    infoWebGL,
    visor3d,
    placaSdr,
    carasSdr,
    placaConsola,
    esquemaVivo,
    simulacion,
    textoResultados,
    migasDe,
    migasPendientes,
    filaMigas,
    type Resultado,
    type ContextoPrueba,
  } from './pruebas';

  const PRUEBAS = [
    { id: 'webgl', nombre: 'WebGL 2: GPU, textura máxima, profundidad', duracion: 'al momento' },
    { id: 'visor', nombre: 'Visor 3D de componentes: primer cuadro, segunda vista y giro (QFP de 64 patillas)', duracion: 'unos segundos' },
    { id: 'placa', nombre: 'Placa SDR en 3D: carga, caras, giro y resolución', duracion: 'de 5 a 40 s' },
    { id: 'caras', nombre: 'Caras de la placa SDR: modos de pintarlas (los tres solo en WebKit; si no, el de este dispositivo)', duracion: 'de 5 a 60 s' },
    { id: 'consola', nombre: 'Placa de consola en 3D (Neo Geo): 320 componentes, con migas por si se cuelga', duracion: 'de 5 a 60 s' },
    { id: 'esquema', nombre: 'Esquema automático en vivo de cuatro circuitos grandes', duracion: 'unos segundos' },
    { id: 'spice', nombre: 'Simulación corta con ngspice (descarga el motor, 6 MB)', duracion: 'unos segundos' },
  ] as const;
  type IdPrueba = (typeof PRUEBAS)[number]['id'];

  let elegidas = $state<Record<IdPrueba, boolean>>({ webgl: true, visor: true, placa: true, caras: true, consola: true, esquema: true, spice: true });
  let segundos = $state(5);
  let estado = $state<'listo' | 'midiendo' | 'hecho'>('listo');
  let aviso = $state('');
  // A test of an earlier visit that never ended (the app froze or closed): shown at once and kept on top of
  // the next run's results, so «Copiar resultados» carries it too.
  const pendiente = migasPendientes();
  const filaPendiente: Resultado[] = pendiente ? [filaMigas(pendiente)] : [];
  let resultados = $state<Resultado[]>(filaPendiente);
  let copiado = $state(false);
  let zona: HTMLDivElement | undefined = $state();
  let cancelar = false;

  const texto = $derived(textoResultados(resultados, VERSION_APP));

  async function empezar(): Promise<void> {
    if (!zona) return;
    estado = 'midiendo';
    cancelar = false;
    copiado = false;
    resultados = [...filaPendiente, ...infoDispositivo()];
    const ctx: ContextoPrueba = { zona, segundos, avisar: (t) => (aviso = t), cancelada: () => cancelar };
    const pasos: [IdPrueba, () => Promise<Resultado[]> | Resultado[]][] = [
      ['webgl', () => infoWebGL()],
      ['visor', () => visor3d(ctx)],
      ['placa', () => placaSdr(ctx)],
      ['caras', () => carasSdr(ctx)],
      ['consola', () => placaConsola(ctx)],
      ['esquema', () => esquemaVivo(ctx)],
      ['spice', () => simulacion(ctx)],
    ];
    for (const [id, f] of pasos) {
      if (cancelar) break;
      if (!elegidas[id]) continue;
      const nombre = PRUEBAS.find((p) => p.id === id)!.nombre;
      const migas = migasDe(nombre);
      ctx.miga = migas.fase;
      migas.fase('empezando');
      try {
        const r = await f();
        resultados = [...resultados, ...r];
      } catch (e) {
        resultados = [...resultados, { grupo: nombre, prueba: 'Error', valor: e instanceof Error ? e.message : String(e), estado: 'error' }];
      } finally {
        migas.terminar();
        ctx.miga = undefined;
      }
      // Leave the page a moment between tests (the next one starts with the main thread free).
      await new Promise((r) => setTimeout(r, 300));
    }
    aviso = cancelar ? 'Detenido.' : '';
    estado = 'hecho';
  }

  async function copiar(): Promise<void> {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      // Without clipboard permission (some WebViews): select the text so the reader can copy it.
      const t = document.querySelector<HTMLTextAreaElement>('.diagnostico textarea:not(.registro)');
      t?.select();
      document.execCommand?.('copy');
    }
    copiado = true;
    setTimeout(() => (copiado = false), 2500);
  }

  // «Registro de la aplicación» (0.9.2): the log kept across runs (lib/registro.ts), to copy or save.
  let nRegistro = $state(lineasRegistro().length);
  let registroCopiado = $state(false);
  let textoReg = $state('');

  let nErrores = $state(0);
  let erroresCopiados = $state(false);

  function refrescarRegistro(): void {
    nRegistro = lineasRegistro().length;
    nErrores = erroresRegistro();
    textoReg = textoRegistro(VERSION_APP);
  }

  async function copiarTexto(t: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(t);
    } catch {
      // Without clipboard permission: put the text in the box and select it so the reader can copy it.
      const a = document.querySelector<HTMLTextAreaElement>('.diagnostico textarea.registro');
      if (a) {
        a.value = t;
        a.closest('details')?.setAttribute('open', '');
        a.select();
        document.execCommand?.('copy');
      }
    }
  }

  async function copiarRegistro(): Promise<void> {
    refrescarRegistro();
    await copiarTexto(textoReg);
    registroCopiado = true;
    setTimeout(() => (registroCopiado = false), 2500);
  }

  /** 0.10: only the errors and warnings, each with the lines just before it (the most useful part to send). */
  async function copiarErrores(): Promise<void> {
    refrescarRegistro();
    await copiarTexto(textoRegistro(VERSION_APP, true));
    erroresCopiados = true;
    setTimeout(() => (erroresCopiados = false), 2500);
  }

  function descargarRegistro(): void {
    refrescarRegistro();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([textoReg], { type: 'text/plain;charset=utf-8' }));
    a.download = `registro-electronica-${VERSION_APP}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.txt`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  }

  function vaciarRegistro(): void {
    borrarRegistro();
    refrescarRegistro();
  }

  refrescarRegistro();
  $effect(() => {
    // the tests add lines while they run
    if (estado !== 'midiendo') refrescarRegistro();
  });

  onDestroy(() => {
    cancelar = true;
  });
</script>

<div class="diagnostico" data-estado={estado}>
  <header>
    <h1><Gauge size={26} aria-hidden="true" /> Diagnóstico de rendimiento</h1>
    <p class="intro">
      Mide en este dispositivo las vistas más pesadas de la aplicación: la GPU (WebGL 2), el visor 3D de componentes al girar, la placa SDR y la de la
      Neo Geo en 3D, el trazado en vivo de esquemas automáticos grandes y una simulación con ngspice. Al terminar, «Copiar resultados» deja el informe
      como texto para pegarlo en la conversación. Si una prueba cuelga o cierra la aplicación, al volver aquí se dice en qué fase se quedó.
    </p>
  </header>

  <section class="tarjeta" aria-labelledby="t-pruebas">
    <h2 id="t-pruebas">Pruebas</h2>
    <ul class="pruebas">
      {#each PRUEBAS as p (p.id)}
        <li>
          <label>
            <input type="checkbox" bind:checked={elegidas[p.id]} disabled={estado === 'midiendo'} />
            <span>{p.nombre}</span>
            <small>{p.duracion}</small>
          </label>
        </li>
      {/each}
    </ul>
    <label class="segundos">
      <span>Segundos girando cada vista 3D</span>
      <input type="number" min="2" max="30" step="1" bind:value={segundos} disabled={estado === 'midiendo'} />
    </label>
    <p class="nota">Durante las medidas conviene no tocar la pantalla y tener la aplicación en primer plano; la placa SDR puede tardar en un móvil.</p>
    <div class="botones">
      {#if estado === 'midiendo'}
        <button class="boton" onclick={() => (cancelar = true)} data-accion="detener">Detener</button>
      {:else}
        <button class="boton primario" onclick={empezar} data-accion="empezar" disabled={!Object.values(elegidas).some(Boolean)}>
          {estado === 'hecho' ? 'Repetir' : 'Empezar'}
        </button>
      {/if}
    </div>
    {#if aviso}<p class="aviso" aria-live="polite">{aviso}</p>{/if}
  </section>

  <!-- The views under test draw here (they must be on screen for the browser to draw them). -->
  <div class="zona" bind:this={zona} aria-hidden="true"></div>

  {#if resultados.length}
    <section class="tarjeta" aria-labelledby="t-resultados">
      <div class="cabecera">
        <h2 id="t-resultados">Resultados</h2>
        <button class="boton" onclick={copiar} disabled={estado === 'midiendo'} data-accion="copiar">
          {#if copiado}<Check size={16} aria-hidden="true" /> Copiado{:else}<Copy size={16} aria-hidden="true" /> Copiar resultados{/if}
        </button>
      </div>
      <div class="tabla-envoltorio">
        <table>
          <thead><tr><th scope="col">Prueba</th><th scope="col">Resultado</th><th scope="col">Detalle</th></tr></thead>
          <tbody>
            {#each resultados as r, i (i)}
              {#if i === 0 || resultados[i - 1]!.grupo !== r.grupo}
                <tr class="grupo"><th colspan="3" scope="rowgroup">{r.grupo}</th></tr>
              {/if}
              <tr class={r.estado}>
                <td>{r.prueba}</td>
                <td class="valor">{r.valor}</td>
                <td>{r.detalle ?? ''}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <details>
        <summary>Ver el texto que se copia</summary>
        <textarea readonly rows="10">{texto}</textarea>
      </details>
    </section>
  {/if}

  <section class="tarjeta registro-app" aria-labelledby="t-registro">
    <div class="cabecera">
      <h2 id="t-registro"><ScrollText size={18} aria-hidden="true" /> Registro de la aplicación</h2>
    </div>
    <p class="nota">
      La aplicación apunta aquí sus errores y los pasos de las vistas pesadas (placas en 3D, diagnóstico), y lo guarda aunque se cierre de golpe. Si algo
      falla, vuelve aquí y copia o descarga el registro para pasármelo; «Copiar errores» copia solo los errores y avisos con lo que pasaba justo
      antes. {nRegistro === 1 ? 'Tiene 1 línea' : `Tiene ${nRegistro} líneas`}, {nErrores === 1 ? '1 de error o aviso.' : `${nErrores} de error o aviso.`}
    </p>
    <div class="botones-registro">
      <button class="boton" onclick={copiarErrores} data-accion="copiar-errores">
        {#if erroresCopiados}<Check size={16} aria-hidden="true" /> Copiado{:else}<Copy size={16} aria-hidden="true" /> Copiar errores{/if}
      </button>
      <button class="boton" onclick={copiarRegistro} data-accion="copiar-registro">
        {#if registroCopiado}<Check size={16} aria-hidden="true" /> Copiado{:else}<Copy size={16} aria-hidden="true" /> Copiar registro{/if}
      </button>
      <button class="boton" onclick={descargarRegistro} data-accion="descargar-registro"><Download size={16} aria-hidden="true" /> Descargar</button>
      <button class="boton" onclick={vaciarRegistro} data-accion="borrar-registro"><Trash2 size={16} aria-hidden="true" /> Borrar</button>
    </div>
    <details>
      <summary>Ver el registro</summary>
      <textarea class="registro" readonly rows="12">{textoReg}</textarea>
    </details>
  </section>
</div>

<style>
  .registro-app h2 {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .botones-registro {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 10px 0;
  }
  .diagnostico {
    max-width: 880px;
    margin: 0 auto;
    padding: 24px 16px calc(var(--hueco-inferior, 0px) + 32px);
    font-family: var(--sans);
    color: var(--tinta);
  }
  h1 {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0 0 8px;
    font-size: 1.6rem;
  }
  .intro {
    margin: 0 0 18px;
    color: var(--tinta-suave);
    font-family: var(--serif);
    line-height: 1.5;
  }
  .tarjeta {
    margin-bottom: 18px;
    padding: 16px 18px;
    border: 1px solid var(--linea);
    border-radius: 14px;
    background: var(--superficie);
  }
  h2 {
    margin: 0 0 10px;
    font-size: 1.1rem;
  }
  .pruebas {
    margin: 0 0 12px;
    padding: 0;
    list-style: none;
  }
  .pruebas label {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6px 10px;
    padding: 6px 0;
  }
  .pruebas small {
    color: var(--tinta-tenue);
  }
  input[type='checkbox'] {
    accent-color: var(--acento);
  }
  .segundos {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--tinta-suave);
  }
  .segundos input {
    width: 4.5em;
    padding: 4px 6px;
    border: 1px solid var(--linea);
    border-radius: 8px;
    background: var(--fondo);
    color: var(--tinta);
    font: inherit;
  }
  .nota {
    margin: 10px 0;
    color: var(--tinta-tenue);
    font-size: 0.9rem;
  }
  .botones {
    display: flex;
    gap: 8px;
  }
  .boton {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 40px;
    padding: 6px 16px;
    border: 1px solid var(--linea);
    border-radius: 10px;
    background: var(--superficie);
    color: var(--tinta);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
  .boton.primario {
    border-color: var(--acento);
    background: var(--acento);
    color: var(--sobre-acento, #fff);
  }
  .boton:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .aviso {
    margin: 10px 0 0;
    color: var(--acento);
    font-weight: 600;
  }
  .zona:empty {
    display: none;
  }
  .zona {
    margin-bottom: 18px;
  }
  .zona :global(.lienzo-prueba) {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 10;
    max-height: 60vh;
    overflow: hidden;
    border-radius: 14px;
    box-shadow: 0 0 0 1px var(--linea);
    touch-action: none;
  }
  .zona :global(canvas) {
    display: block;
    width: 100%;
    height: 100%;
  }
  .zona :global(.capa-prueba) {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
  }
  .zona :global(.etiqueta3d),
  .zona :global(svg.lineas) {
    display: none;
  }
  .cabecera {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 10px;
  }
  .cabecera h2 {
    margin: 0;
  }
  .tabla-envoltorio {
    overflow-x: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.92rem;
  }
  th,
  td {
    padding: 6px 8px;
    border-bottom: 1px solid var(--linea-suave, var(--linea));
    text-align: left;
    vertical-align: top;
  }
  thead th {
    color: var(--tinta-tenue);
    font-size: 0.8rem;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  tr.grupo th {
    padding-top: 14px;
    color: var(--acento);
  }
  td.valor {
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    word-break: break-word;
  }
  tr.aviso td.valor {
    color: #b7791f;
  }
  tr.error td.valor {
    color: #c0392b;
  }
  details {
    margin-top: 12px;
  }
  textarea {
    width: 100%;
    margin-top: 8px;
    padding: 8px;
    border: 1px solid var(--linea);
    border-radius: 8px;
    background: var(--fondo);
    color: var(--tinta);
    font-family: var(--mono);
    font-size: 0.82rem;
  }
</style>
