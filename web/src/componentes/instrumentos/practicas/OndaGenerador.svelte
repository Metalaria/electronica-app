<script lang="ts">
  // «Onda a medida»: one period of a waveform sent to the FNIRSI's own signal generator (link with patch 4).
  // It is the only place where the application writes in the instrument, and it says so: what is written (the table
  // of 100 samples its generator plays, nothing else), how long it lasts and what the instrument's screen will go on
  // showing. The shapes and the scaling are in lib/fnirsi-real/ondas.ts; the send, with its read-back, in
  // conexion.svelte.ts. Closed by default: nothing is computed or sent until the reader opens it and presses the button.
  // In the installed app the USB plugin does not let this order through yet: the section says so and offers nothing.
  // The card keeps it mounted while the link is away for a change of mode, so that what was sent is still told afterwards.
  import { ONDA_SOLO_NAVEGADOR, fnirsiReal } from '../../../lib/fnirsi-real/conexion.svelte';
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

  const voltios = (v: number) => v.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const textoEnviada = $derived.by(() => {
    if (!enviada) return '';
    const entrada = `la entrada n.º ${enviada.entrada + 1} de la lista de formas del aparato`;
    if (!enviada.sonando)
      return elegidaDespues
        ? `Guardada a las ${enviada.hora} (${enviada.que}) y elegida ahora en el FNIRSI: es ${entrada}, y sonará hasta que lo apague o envíe otra.`
        : `Guardada a las ${enviada.hora}: ${enviada.que}, en ${entrada}, hasta que lo apague. No está sonando: el FNIRSI sigue con ${nombreForma(enviada.forma)}, que no se ha tocado. Elija esa entrada en el aparato para oírla.`;
    if (deshecha) return `El FNIRSI ha vuelto a su propia onda (${nombreForma(c.generador!.forma)}): se cambió un ajuste de su generador después de enviar la suya.`;
    const comun = `Enviada y comprobada a las ${enviada.hora}: ${enviada.que}, ${PUNTOS_ONDA} muestras con una amplitud de ${voltios(enviada.amplitud)} V.`;
    if (enviada.entrada && enviada.forma === enviada.entrada) return `${comun} Es ${entrada}, la que está elegida: dura hasta que lo apague o envíe otra, aunque cambie la amplitud.`;
    return `${comun} El aparato sigue mostrando ${nombreForma(enviada.forma)}.${enviada.entrada ? ` Queda además en ${entrada} hasta que lo apague.` : ''}`;
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

<details class="og" bind:open={abierto} data-onda-fnirsi>
  <summary>Onda a medida en el generador</summary>
  {#if c.tipo === 'nativo'}
    <p class="og-nota" data-onda-solo-navegador>{ONDA_SOLO_NAVEGADOR}</p>
  {:else}
  <p class="og-nota">
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
      <button type="button" class="boton pequeno" onclick={() => (fichero = null)} data-onda-quitar-fichero>Quitar el fichero</button>
    {:else}
      <label class="og-ancho">O un periodo desde un fichero de texto o CSV (un número por línea)
        <input type="file" accept=".csv,.txt,text/csv,text/plain" onchange={elegirFichero} data-onda-elegir-fichero />
      </label>
    {/if}
  </div>
  {#if errorFichero}<p class="og-aviso" role="alert" data-onda-error-fichero>{errorFichero}</p>{/if}
  {#if preparada.error}<p class="og-aviso" role="alert" data-onda-error-forma>{preparada.error}</p>{/if}
  {#if trazo}
    <svg class="og-vista" viewBox="0 0 {VISTA_ANCHO} {VISTA_ALTO}" preserveAspectRatio="none" role="img" aria-label="Vista previa de un periodo de la onda" data-onda-vista>
      <polyline points={trazo} fill="none" stroke="currentColor" stroke-width="1.5" vector-effect="non-scaling-stroke" />
    </svg>
  {/if}
  <p class="og-nota">De abajo arriba ocupa toda la amplitud del generador ({amplitudAparato}): ajústela en el aparato antes de enviar.</p>
  <div class="og-fila">
    <button type="button" class="boton pequeno" disabled={!preparada.muestras || c.enviandoOnda || c.estado !== 'conectado'} onclick={enviar} data-onda-enviar>
      {c.enviandoOnda ? 'Enviando…' : 'Enviar al generador del FNIRSI'}
    </button>
  </div>
  {#if error}<p class="og-aviso" role="alert" data-onda-error>{error}</p>{/if}
  {#if enviada}
    <p role="status" data-onda-estado={!enviada.sonando ? 'guardada' : deshecha ? 'deshecha' : 'enviada'}>
      {textoEnviada}
    </p>
  {/if}
  {/if}
</details>

<style>
  .og {
    margin-top: 6px;
    font-size: 12.5px;
  }
  .og summary {
    min-height: 32px;
    display: flex;
    align-items: center;
    cursor: pointer;
    color: var(--tinta-suave);
  }
  .og p {
    margin: 4px 0;
  }
  .og-nota {
    color: var(--tinta-tenue);
  }
  .og-aviso {
    color: var(--c-importante);
    font-weight: 600;
  }
  .og-fila {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 6px 12px;
    margin: 6px 0;
  }
  .og-fila label {
    display: flex;
    flex-direction: column;
    color: var(--tinta-suave);
  }
  .og-fila label.og-casilla {
    flex-direction: row;
    align-items: center;
    gap: 6px;
    min-height: 36px;
  }
  .og-ancho {
    flex: 1 1 16em;
  }
  .og-fila select,
  .og-fila input[type='number'],
  .og-fila input[type='text'] {
    min-height: 36px;
    padding: 0 8px;
    border: 1px solid var(--linea);
    border-radius: 6px;
    background: var(--superficie);
    color: inherit;
    font: inherit;
    font-size: 16px;
  }
  .og-fila input[type='number'] {
    width: 6em;
  }
  .og-fila input[type='file'] {
    min-height: 36px;
    font: inherit;
    color: inherit;
  }
  .og-vista {
    display: block;
    width: 100%;
    max-width: 320px;
    height: 72px;
    margin: 6px 0;
    border: 1px solid var(--linea);
    border-radius: 6px;
    color: var(--tinta);
  }
  .boton.pequeno {
    min-height: 36px;
    padding: 0 12px;
    font-size: 13.5px;
  }
  @media (pointer: coarse) {
    .boton.pequeno,
    .og summary,
    .og-fila select,
    .og-fila input[type='number'],
    .og-fila input[type='text'],
    .og-fila label.og-casilla {
      min-height: 44px;
    }
  }
</style>
