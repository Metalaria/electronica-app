<script lang="ts">
  // «Onda a medida»: one period of a waveform sent to the FNIRSI's own signal generator (link with patch 4).
  // It is the only place where the application writes in the instrument, and it says so: what is written (the table
  // of 100 samples its generator plays, nothing else), how long it lasts and what the instrument's screen will go on
  // showing. The shapes and the scaling are in lib/fnirsi-real/ondas.ts; the send, with its read-back, in
  // conexion.svelte.ts. Closed by default: nothing is computed or sent until the reader opens it and presses the button.
  // 2.1: the installed app's USB plugin lets this order (and the read-back of the table) through as well, and nothing
  // more (src-tauri/plugins/fnirsi). Dressed as the system's folded row, buttons, fields and feedback.
  // The card keeps it mounted while the link is away for a change of mode, so that what was sent is still told afterwards.
  import { fnirsiReal } from '../../../lib/fnirsi-real/conexion.svelte';
  import { nombreForma } from '../../../lib/fnirsi-real/estado';
  import {
    FONDO_ONDA, FORMAS_ONDA, PUNTOS_ONDA, formaOnda, invertir, leerArmonicos, leerNumeros, normalizar, remuestrear, type FormaOnda,
  } from '../../../lib/fnirsi-real/ondas';

  const c = fnirsiReal;
  const VISTA_ANCHO = 200;
  const VISTA_ALTO = 60;

  let abierto = $state(false);
  let forma = $state<FormaOnda>('senoidal');
  let ciclo = $state(50);
  let textoArmonicos = $state('1:1; 3:0,33; 5:0,2');
  let invertida = $state(false);
  let fichero = $state<{ nombre: string; valores: number[] } | null>(null);
  let errorFichero = $state('');
  let error = $state('');
  /** The last waveform stored, with the generator's settings it was stored under. */
  let enviada = $state<{ que: string; hora: string; amplitud: number; forma: number; ciclo: number | null; sonando: boolean; entrada: number } | null>(null);

  const descripcion = $derived(FORMAS_ONDA.find((f) => f.id === forma)!);
  const preparada = $derived.by((): { muestras: number[] | null; error: string } => {
    if (!abierto) return { muestras: null, error: '' };
    try {
      let m = fichero ? normalizar(remuestrear(fichero.valores)) : formaOnda(forma, ciclo, descripcion.conArmonicos ? leerArmonicos(textoArmonicos) : []);
      if (invertida) m = invertir(m);
      return { muestras: m, error: '' };
    } catch (e) {
      return { muestras: null, error: e instanceof Error ? e.message : 'No se puede preparar esa onda.' };
    }
  });
  const trazo = $derived(
    preparada.muestras
      ? preparada.muestras.map((x, k) => `${((k / (PUNTOS_ONDA - 1)) * VISTA_ANCHO).toFixed(1)},${(VISTA_ALTO - 2 - (x / FONDO_ONDA) * (VISTA_ALTO - 4)).toFixed(1)}`).join(' ')
      : '',
  );
  const amplitudAparato = $derived(
    c.generador ? `${c.generador.amplitud.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} V, la que tiene puesta ahora` : 'la que tenga puesta',
  );
  /**
   * The instrument's generator no longer has the settings the waveform was stored under: it rebuilt its table.
   * A waveform that plays from its own entry of the menu survives a change of duty or amplitude (the instrument
   * rescales it), and one that was only kept for that entry was never in the table.
   */
  const deshecha = $derived.by(() => {
    if (!enviada || !enviada.sonando || !c.generador) return false;
    if (enviada.entrada && enviada.forma === enviada.entrada) return c.generador.forma !== enviada.entrada;
    return c.generador.forma !== enviada.forma || Math.round(c.generador.amplitud * 10) !== Math.round(enviada.amplitud * 10) || (enviada.ciclo !== null && c.generador.ciclo !== enviada.ciclo);
  });
  /** The waveform kept for its entry of the menu is the one selected now (it was sent under another one). */
  const elegidaDespues = $derived(!!enviada && !enviada.sonando && !!c.generador && c.generador.forma === enviada.entrada);

  /** The added entry of the menu that plays what is sent (0: none), so that it is named as such. */
  const usb = $derived(c.info?.entradaUsb ?? 0);
  /** 2.2: how many entries the link's identification says it added (nombreForma names only those). */
  const anadidas = $derived(c.info?.entradasMenu);
  const voltios = (v: number) => v.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const textoEnviada = $derived.by(() => {
    if (!enviada) return '';
    const entrada = `la entrada n.º ${enviada.entrada + 1} de la lista de formas del aparato`;
    if (!enviada.sonando)
      return elegidaDespues
        ? `Guardada a las ${enviada.hora} (${enviada.que}) y elegida ahora en el FNIRSI: es ${entrada}, y sonará hasta que lo apague o envíe otra.`
        : `Guardada a las ${enviada.hora}: ${enviada.que}, en ${entrada}, hasta que lo apague. No está sonando: el FNIRSI sigue con ${nombreForma(enviada.forma, usb, anadidas)}, que no se ha tocado. Elija esa entrada en el aparato para oírla.`;
    if (deshecha) return `El FNIRSI ha vuelto a su propia onda (${nombreForma(c.generador!.forma, usb, anadidas)}): se cambió un ajuste de su generador después de enviar la suya.`;
    const comun = `Enviada y comprobada a las ${enviada.hora}: ${enviada.que}, ${PUNTOS_ONDA} muestras con una amplitud de ${voltios(enviada.amplitud)} V.`;
    if (enviada.entrada && enviada.forma === enviada.entrada) return `${comun} Es ${entrada}, la que está elegida: dura hasta que lo apague o envíe otra, aunque cambie la amplitud.`;
    return `${comun} El aparato sigue mostrando ${nombreForma(enviada.forma, usb, anadidas)}.${enviada.entrada ? ` Queda además en ${entrada} hasta que lo apague.` : ''}`;
  });

  async function elegirFichero(e: Event) {
    const entrada = e.currentTarget as HTMLInputElement;
    const f = entrada.files?.[0];
    errorFichero = '';
    if (!f) return;
    try {
      const valores = leerNumeros(await f.text());
      if (valores.length < 2) throw new Error('En el fichero hacen falta al menos dos números (un periodo de la onda).');
      fichero = { nombre: f.name, valores };
    } catch (x) {
      fichero = null;
      errorFichero = x instanceof Error ? x.message : 'No se ha podido leer el fichero.';
    }
    entrada.value = '';
  }

  async function enviar() {
    if (!preparada.muestras || c.enviandoOnda) return;
    error = '';
    const que = fichero ? `«${fichero.nombre}»` : `${descripcion.nombre.toLowerCase()}${invertida ? ', invertida' : ''}`;
    try {
      const r = await c.enviarOnda(preparada.muestras);
      enviada = { que, hora: new Date().toLocaleTimeString('es-ES'), amplitud: r.amplitud, forma: r.forma, ciclo: c.generador?.ciclo ?? null, sonando: r.sonando, entrada: r.entrada };
    } catch (x) {
      enviada = null;
      error = x instanceof Error ? x.message : 'No se ha podido enviar la onda.';
    }
  }
</script>

<details class="og plegable21" bind:open={abierto} data-onda-fnirsi>
  <summary>Onda a medida en el generador</summary>
  <div class="plegable21-cuerpo og-cuerpo">
  <p class="og-nota og-escribe">
    Esto sí escribe en el FNIRSI: la tabla de 100 muestras que reproduce su generador, y nada más.
    {#if c.info?.entradaUsb}
      Este aparato tiene en su lista de formas una entrada para lo que se le envía (la n.º {c.info.entradaUsb + 1}): la onda queda ahí hasta que lo
      apague{c.info.parche >= 6 ? ', y solo suena mientras esa entrada esté elegida' : ''}.
    {:else}
      La onda dura hasta que cambie en el aparato la forma, el ciclo o la amplitud, o lo apague; cambiar la frecuencia la conserva. La pantalla del
      FNIRSI seguirá mostrando la forma elegida en su menú.
    {/if}
  </p>
  <div class="og-fila">
    <label>Forma
      <select bind:value={forma} disabled={!!fichero} data-onda-forma>
        {#each FORMAS_ONDA as f (f.id)}<option value={f.id}>{f.nombre}</option>{/each}
      </select>
    </label>
    {#if descripcion.conCiclo && !fichero}
      <label>{forma === 'pulso' ? 'Parte alta (%)' : 'Parte de subida (%)'}
        <input type="number" min="1" max="99" step="1" bind:value={ciclo} data-onda-ciclo />
      </label>
    {/if}
    {#if descripcion.conArmonicos && !fichero}
      <label class="og-ancho">Armónicos (orden:nivel, y fase en grados si hace falta)
        <input type="text" autocomplete="off" bind:value={textoArmonicos} data-onda-armonicos />
      </label>
    {/if}
    <label class="og-casilla"><input type="checkbox" bind:checked={invertida} data-onda-invertir /> Invertida</label>
  </div>
  <div class="og-fila">
    {#if fichero}
      <span data-onda-fichero>Un periodo tomado de «{fichero.nombre}» ({fichero.valores.length} puntos, llevados a {PUNTOS_ONDA}).</span>
      <button type="button" class="boton fantasma" onclick={() => (fichero = null)} data-onda-quitar-fichero>Quitar el fichero</button>
    {:else}
      <label class="og-ancho">O un periodo desde un fichero de texto o CSV (un número por línea)
        <input type="file" accept=".csv,.txt,text/csv,text/plain" onchange={elegirFichero} data-onda-elegir-fichero />
      </label>
    {/if}
  </div>
  {#if errorFichero}<p class="aviso21 mal" role="alert" data-onda-error-fichero>{errorFichero}</p>{/if}
  {#if preparada.error}<p class="aviso21 mal" role="alert" data-onda-error-forma>{preparada.error}</p>{/if}
  {#if trazo}
    <svg class="og-vista" viewBox="0 0 {VISTA_ANCHO} {VISTA_ALTO}" preserveAspectRatio="none" role="img" aria-label="Vista previa de un periodo de la onda" data-onda-vista>
      <polyline points={trazo} fill="none" stroke="currentColor" stroke-width="1.5" vector-effect="non-scaling-stroke" />
    </svg>
  {/if}
  <p class="og-nota">De abajo arriba ocupa toda la amplitud del generador ({amplitudAparato}): ajústela en el aparato antes de enviar.</p>
  <div class="og-fila">
    <button type="button" class="boton primario" disabled={!preparada.muestras || c.enviandoOnda || c.estado !== 'conectado'} onclick={enviar} data-onda-enviar>
      {c.enviandoOnda ? 'Enviando…' : 'Enviar al generador del FNIRSI'}
    </button>
  </div>
  {#if error}<p class="aviso21 mal" role="alert" data-onda-error>{error}</p>{/if}
  {#if enviada}
    <!-- (kept but not playing is neither good nor bad news: the neutral pill) -->
    <p class="aviso21 {!enviada.sonando ? '' : deshecha ? 'mal' : 'bien'}" role="status" data-onda-estado={!enviada.sonando ? 'guardada' : deshecha ? 'deshecha' : 'enviada'}>
      {textoEnviada}
    </p>
  {/if}
  </div>
</details>

<style>
  /* 2.1: the system's folded row holds it; inside, its 44 px fields with the tokens' line, its buttons (the send is
     the one primary: it writes in the instrument), the feedback pills, no boxes */
  .og {
    font-family: var(--sans);
    font-size: 15px;
    color: var(--v11-tinta);
  }
  .og-cuerpo {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .og p {
    margin: 0;
  }
  .og-nota {
    color: var(--v11-tinta-suave);
    font-size: 13px;
    line-height: 1.45;
  }
  /* (what it writes in the instrument is said first, at the reading size) */
  .og-escribe {
    color: var(--v11-tinta);
    font-size: 15px;
  }
  .og-fila {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 8px 16px;
  }
  .og-fila label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    color: var(--v11-tinta-suave);
    font-size: 13px;
  }
  .og-fila label.og-casilla {
    flex-direction: row;
    align-items: center;
    gap: 8px;
    min-height: 48px;
    font-size: 15px;
    color: var(--v11-tinta);
  }
  .og-casilla input {
    width: 20px;
    height: 20px;
    accent-color: var(--v11-azul);
  }
  .og-ancho {
    flex: 1 1 16em;
    min-width: 0;
  }
  .og-fila select,
  .og-fila input[type='number'],
  .og-fila input[type='text'] {
    min-width: 0;
    max-width: 100%;
    min-height: 48px;
    padding: 0 10px;
    border: 1px solid var(--v11-linea);
    border-radius: 12px;
    /* (the tokens' own colours: a native select keeps a light background in the dark themes) */
    background: var(--v11-fondo);
    color: var(--v11-tinta);
    font: inherit;
    font-size: 16px;
  }
  .og-fila input[type='number'] {
    width: 6em;
  }
  .og-fila input[type='file'] {
    max-width: 100%;
    min-height: 48px;
    font: inherit;
    font-size: 15px;
    color: var(--v11-tinta);
  }
  .og-vista {
    display: block;
    width: 100%;
    max-width: 360px;
    height: 72px;
    border-radius: 12px;
    background: var(--v11-panel);
    color: var(--v11-azul);
  }
</style>
