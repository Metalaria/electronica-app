<script lang="ts">
  // «Exportar a PDF» of an own exam (the exam or its solutions, a variant, the date and the room to answer) or course
  // (its outline). The PDF is made in the app, offline, the same on every device (lib/docente/exportar.ts), and saved
  // with the system's dialog (Windows, macOS, Android) or downloaded (browser).
  import FileDown from '@lucide/svelte/icons/file-down';
  import { CANCELADO, generar, guardarPdf, type TipoPdf } from '../../lib/docente/exportar';
  import { letraVariante } from '../../lib/docente/examen';
  import type { EspacioRespuesta, Propio } from '../../lib/docente/tipos';

  let { propio }: { propio: Propio } = $props();

  const esExamen = $derived(propio.tipo === 'examen');
  const ex = $derived(propio.tipo === 'examen' ? propio.examen : undefined);
  const hayVariantes = $derived(!!ex && (ex.variantes || ex.barajar));

  let tipo = $state<TipoPdf>('examen');
  let variante = $state(0);
  let fecha = $state(new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }));
  let espacio = $state<EspacioRespuesta | null>(null);
  let trabajando = $state(false);
  let mensaje = $state('');
  /** Characters of the last PDF that no font of the app has (drawn as «?»): said, not only logged (review 10c). */
  let sinGlifo = $state<string[]>([]);
  let fallo = $state(false);

  async function exportar() {
    if (trabajando) return;
    trabajando = true;
    fallo = false;
    mensaje = 'Preparando el PDF…';
    sinGlifo = [];
    try {
      const r = await generar(propio, { tipo: esExamen ? tipo : 'curso', variante, fecha: fecha.trim(), espacio: espacio ?? ex?.espacio ?? 'corto' });
      if (r.faltan.length) console.warn('caracteres sin fuente en el PDF', r.faltan);
      sinGlifo = r.faltan;
      const como = await guardarPdf(r.nombre, r.bytes);
      const pags = `${r.paginas} ${r.paginas === 1 ? 'página' : 'páginas'}`;
      mensaje = como === CANCELADO ? 'No se ha guardado: canceló el diálogo.' : como === 'guardado' ? `PDF guardado (${pags}).` : `PDF descargado (${pags}): «${r.nombre}».`;
    } catch (e) {
      fallo = true;
      // (review 10h: a failed load in the app's words, never the browser's «Failed to fetch»)
      mensaje = `No se pudo hacer el PDF: ${e instanceof TypeError ? 'no se ha podido cargar el contenido del libro (¿sin conexión?)' : e instanceof Error ? e.message : String(e)}. Vuelva a intentarlo.`;
    } finally {
      trabajando = false;
    }
  }
</script>

<section class="t09-tarjeta exportar" aria-labelledby={`h-pdf-${propio.id}`} data-exportar>
  <h2 id={`h-pdf-${propio.id}`}>Exportar a PDF</h2>
  {#if esExamen}
    <p>Para imprimirlo: el examen con sus datos, la puntuación y un encabezado con el título, la fecha y una línea para el nombre; o las soluciones con el desarrollo del libro. Cada variante sale siempre igual.</p>
    <div class="opciones">
      <fieldset class="tipo">
        <legend>Documento</legend>
        <label class="casilla"><input type="radio" name={`tipo-${propio.id}`} value="examen" bind:group={tipo} data-pdf-tipo="examen" /> Examen</label>
        <label class="casilla"><input type="radio" name={`tipo-${propio.id}`} value="soluciones" bind:group={tipo} data-pdf-tipo="soluciones" /> Soluciones</label>
      </fieldset>
      {#if hayVariantes}
        <label class="campo">
          <span>Variante</span>
          <select class="dc-entrada" value={String(variante)} onchange={(ev) => (variante = Number((ev.currentTarget as HTMLSelectElement).value))} data-pdf-variante>
            {#each Array.from({ length: 10 }, (_, k) => k) as k (k)}<option value={String(k)}>{letraVariante(k)}</option>{/each}
          </select>
        </label>
      {/if}
      <label class="campo">
        <span>Fecha que se imprime (vacía: una línea para escribirla)</span>
        <input class="dc-entrada" bind:value={fecha} maxlength="60" data-pdf-fecha />
      </label>
      {#if tipo === 'examen'}
        <label class="campo">
          <span>Espacio para responder</span>
          <select class="dc-entrada" value={espacio ?? ex?.espacio ?? 'corto'} onchange={(ev) => (espacio = (ev.currentTarget as HTMLSelectElement).value as EspacioRespuesta)} data-pdf-espacio>
            <option value="no">Sin espacio</option>
            <option value="corto">Unas líneas</option>
            <option value="largo">Media página</option>
          </select>
        </label>
      {/if}
    </div>
  {:else}
    <p>El índice del curso: sus notas y, en orden, las secciones, los ejercicios y las preguntas.</p>
  {/if}
  <button type="button" class="t09-boton" disabled={trabajando} onclick={() => void exportar()} data-pdf-generar>
    <FileDown size={18} aria-hidden="true" />
    {trabajando ? 'Preparando…' : esExamen ? (tipo === 'soluciones' ? 'Exportar las soluciones' : 'Exportar el examen') : 'Exportar el índice'}
  </button>
  <p class="estado" class:fallo role={fallo ? 'alert' : 'status'} data-pdf-estado>{mensaje}</p>
  {#if sinGlifo.length}
    <p class="estado fallo" role="alert" data-pdf-sin-glifo>
      Atención: {sinGlifo.length === 1 ? 'un carácter' : `${sinGlifo.length} caracteres`} del texto ({sinGlifo.map((c) => `«${c}» U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`).join(', ')}) no {sinGlifo.length === 1 ? 'está' : 'están'} en las fuentes de la aplicación y en el PDF {sinGlifo.length === 1 ? 'sale' : 'salen'} como «?». Revise el título y las notas.
    </p>
  {/if}
</section>

<style>
  .exportar {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    font-family: var(--sans);
  }
  h2 {
    margin: 0;
    color: var(--titulos);
    font-size: 18px;
  }
  p {
    margin: 0;
    color: var(--tinta-suave);
    font-size: 14.5px;
    line-height: 1.5;
  }
  .opciones {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 10px 16px;
    width: 100%;
  }
  .tipo {
    display: flex;
    gap: 14px;
    margin: 0;
    padding: 0;
    border: 0;
  }
  .tipo legend {
    margin-bottom: 4px;
    color: var(--tinta-suave);
    font-size: 13.5px;
    font-weight: 600;
  }
  .casilla {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    color: var(--tinta);
  }
  .casilla input {
    width: 20px;
    height: 20px;
    accent-color: var(--acento);
  }
  .campo {
    display: flex;
    flex: 1 1 200px;
    flex-direction: column;
    gap: 4px;
    color: var(--tinta-suave);
    font-size: 13.5px;
    font-weight: 600;
  }
  .campo input,
  .campo select {
    min-height: 44px;
  }
  .t09-boton {
    min-height: 44px;
  }
  .estado {
    min-height: 1.4em;
    color: var(--tinta);
  }
  .estado.fallo {
    padding-left: 8px;
    border-left: 3px solid var(--c-importante);
    font-weight: 700;
  }
</style>
