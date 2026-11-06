<script lang="ts">
  // «Copia de seguridad» of the Sincronización page (0.12): export all the progress to one file, and import one back —
  // checked, previewed store by store, then merged with the synchronisation's rules («Unir», the default) or, behind
  // an explicit confirmation and after an automatic backup, «Sustituir todo» (lib/sincronizacion/copia.ts).
  import { onMount, tick } from 'svelte';
  import Archive from '@lucide/svelte/icons/archive';
  import FileUp from '@lucide/svelte/icons/file-up';
  import FileDown from '@lucide/svelte/icons/file-down';
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
  import {
    ErrorCopia,
    convieneSincronizarAntes,
    deshacerSustitucion,
    importar,
    leerCopiaAutomatica,
    leerFicheroCopia,
    previsualizar,
    type CopiaLeida,
    type ModoImportacion,
    type PlanAlmacen,
    type ResultadoImportacion,
  } from '../../lib/sincronizacion/copia';
  import { abrirFicheroTauri, guardarFichero } from '../../lib/sincronizacion/fichero';
  import { sincronizables } from '../../lib/sincronizacion/registro.svelte';
  import { confirmar } from '../../lib/confirmar';
  import { exportarCopia } from './exportar';

  let { enfocar = false }: { enfocar?: boolean } = $props();

  let seccion: HTMLElement | undefined = $state();
  let entrada: HTMLInputElement | undefined = $state();
  let ocupado = $state(false);
  let aviso = $state('');
  let error = $state('');
  let fichero = $state('');
  let leida = $state.raw<CopiaLeida | null>(null);
  let modo = $state<ModoImportacion>('unir');
  let plan = $state.raw<PlanAlmacen[] | null>(null);
  let confirmado = $state(false);
  // «unir»: the copy's items older than the prune horizon and unknown here, left out unless the reader includes them
  let incluirAntiguos = $state(false);
  let antiguos = $state(0);
  let sincronizarAntes = $state(false);
  let resultado = $state.raw<ResultadoImportacion | null>(null);
  let automatica = $state.raw<{ nombre: string; texto: string; t: number } | null>(null);

  const NOMBRES: Record<string, string> = Object.fromEntries(sincronizables().map((s) => [s.clave, s.nombre]));
  const conCambios = $derived((plan ?? []).filter((p) => p.nuevos || p.cambiados || p.borrados));
  const totalCambios = $derived(conCambios.reduce((n, p) => n + p.nuevos + p.cambiados + p.borrados, 0));
  const fecha = (t: number) =>
    t ? new Date(t).toLocaleString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'fecha desconocida';

  onMount(() => {
    void leerCopiaAutomatica().then((c) => (automatica = c));
  });
  // «Importar…» in «Aa» leads here (#/sincronizacion/copia), also when the page is already open
  $effect(() => {
    if (!enfocar) return;
    void tick().then(() => {
      seccion?.scrollIntoView({ block: 'start' });
      seccion?.querySelector<HTMLElement>('#t-copia')?.focus({ preventScroll: true });
    });
  });

  function limpiar(): void {
    leida = null;
    plan = null;
    confirmado = false;
    incluirAntiguos = false;
    antiguos = 0;
    modo = 'unir';
    fichero = '';
  }

  // 1.0 accessibility pass: a button disabled while it has the focus (`ocupado`) drops the focus to <body>; after the
  // work the focus goes to what it produced (the preview, the result) or back to the button
  let botonExportar: HTMLButtonElement | undefined = $state();
  let tituloVista: HTMLElement | undefined = $state();
  let cajaResultado: HTMLElement | undefined = $state();
  const focoPerdido = () => !document.activeElement || document.activeElement === document.body;
  async function enfocarTras(el: () => HTMLElement | undefined, siempre = false): Promise<void> {
    await tick();
    if (siempre || focoPerdido()) el()?.focus();
  }

  async function exportar(): Promise<void> {
    ocupado = true;
    error = '';
    aviso = '';
    try {
      aviso = await exportarCopia();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      ocupado = false;
      void enfocarTras(() => botonExportar);
    }
  }

  async function elegir(): Promise<void> {
    // (0.12: busy while the system's picker is open, so a second click cannot open another one)
    if (ocupado) return;
    error = '';
    aviso = '';
    resultado = null;
    let t: Awaited<ReturnType<typeof abrirFicheroTauri>>;
    ocupado = true;
    try {
      t = await abrirFicheroTauri();
    } catch (e) {
      error = `No se ha podido leer el fichero: ${e instanceof Error ? e.message : String(e)}`;
      return;
    } finally {
      ocupado = false;
    }
    if (t === undefined) {
      entrada?.click();
      return;
    }
    try {
      if (t) await cargar(t.nombre, t.texto);
    } catch (e) {
      error = `No se ha podido leer el fichero: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  async function alElegir(ev: Event): Promise<void> {
    const f = (ev.currentTarget as HTMLInputElement).files?.[0];
    (ev.currentTarget as HTMLInputElement).value = '';
    if (!f) return;
    try {
      await cargar(f.name, await f.text());
    } catch (e) {
      error = `No se ha podido leer el fichero: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  async function cargar(nombre: string, texto: string): Promise<void> {
    limpiar();
    try {
      leida = leerFicheroCopia(texto);
    } catch (e) {
      error = e instanceof ErrorCopia ? e.message : `El fichero no se puede usar: ${e instanceof Error ? e.message : String(e)}`;
      return;
    }
    fichero = nombre;
    // an automatic backup (made before «Sustituir todo»): restoring it means replacing — with «Unir» the replacement's
    // newer versions would win and nothing would come back (review 0.12c, finding 4)
    if (leida.copia.automatica) modo = 'sustituir';
    sincronizarAntes = await convieneSincronizarAntes();
    await calcular();
    if (leida && plan) await enfocarTras(() => tituloVista, true);
  }

  async function calcular(): Promise<void> {
    if (!leida) return;
    ocupado = true;
    try {
      plan = await previsualizar(leida, modo, incluirAntiguos);
      if (!incluirAntiguos) antiguos = plan.reduce((n, p) => n + p.antiguos, 0);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      plan = null;
    } finally {
      ocupado = false;
    }
  }

  async function cambiarModo(m: ModoImportacion): Promise<void> {
    modo = m;
    confirmado = false;
    incluirAntiguos = false;
    await calcular();
  }

  async function aplicar(): Promise<void> {
    if (!leida || (modo === 'sustituir' && !confirmado)) return;
    ocupado = true;
    error = '';
    try {
      resultado = await importar(leida, modo, incluirAntiguos);
      limpiar();
      if (resultado.copiaAutomatica) automatica = await leerCopiaAutomatica();
      void enfocarTras(() => cajaResultado, true);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      ocupado = false;
    }
  }

  /** «Deshacer la sustitución»: the automatic backup back, with «Sustituir» (after the app's own confirmation). */
  async function deshacer(): Promise<void> {
    if (!automatica || ocupado) return;
    const si = await confirmar({
      titulo: '¿Deshacer la sustitución?',
      mensaje: `Se recuperarán los datos que había antes de «Sustituir todo» (${fecha(automatica.t)}). Lo que haya hecho desde entonces en este dispositivo se perderá y, al sincronizar, también en los demás. Antes se guardará una copia automática de sus datos actuales.`,
      aceptar: 'Deshacer la sustitución',
    });
    if (!si) return;
    ocupado = true;
    error = '';
    aviso = '';
    try {
      limpiar();
      resultado = await deshacerSustitucion();
      automatica = await leerCopiaAutomatica();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      ocupado = false;
    }
  }

  async function descargarAutomatica(): Promise<void> {
    if (!automatica) return;
    error = '';
    try {
      await guardarFichero(automatica.nombre, automatica.texto);
    } catch (e) {
      error = `No se ha podido guardar el fichero: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  const hechos = (r: ResultadoImportacion) => r.planes.reduce((n, p) => n + p.nuevos + p.cambiados + p.borrados, 0);
</script>

<section class="tarjeta copia" aria-labelledby="t-copia" bind:this={seccion} data-copia aria-busy={ocupado}>
  <h2 id="t-copia" tabindex="-1"><Archive size={20} aria-hidden="true" /> Copia de seguridad</h2>
  <p>
    Guarde todo su progreso (marcadores, notas, lecturas, ejercicios, repaso, lecciones, XP, circuitos…) en un fichero, y
    recupérelo cuando quiera en este u otro dispositivo, también sin GitHub. El token de GitHub y los ajustes propios de
    cada dispositivo no se guardan en la copia.
  </p>
  <div class="botones">
    <button class="boton primario" bind:this={botonExportar} onclick={exportar} disabled={ocupado} data-copia-exportar>
      <FileDown size={16} aria-hidden="true" /> Exportar copia
    </button>
    <button class="boton" onclick={elegir} disabled={ocupado} data-copia-importar>
      <FileUp size={16} aria-hidden="true" /> Importar una copia…
    </button>
    <input bind:this={entrada} class="oculto" type="file" accept=".json,application/json" onchange={alElegir} tabindex="-1" aria-hidden="true" data-copia-fichero />
  </div>
  {#if aviso}<p class="ok" role="status" data-copia-aviso>{aviso}</p>{/if}
  {#if error}
    <p class="error caja" role="alert" data-copia-error><TriangleAlert size={18} aria-hidden="true" /> <span>{error}</span></p>
  {/if}

  {#if leida && plan}
    <div class="vista" data-copia-vista data-cambios={totalCambios}>
      <!-- (Android gives no file name: a content:// URI, see src-tauri lib.rs) -->
      <h3 tabindex="-1" bind:this={tituloVista}>{#if fichero}Importar «{fichero}»{:else}Importar la copia elegida{/if}</h3>
      <p class="origen">
        {#if leida.deSincronizacion}
          Es el fichero de sincronización de GitHub ({fecha(leida.copia.exportado)}).
        {:else}
          Copia de <b>{leida.copia.dispositivo || 'otro dispositivo'}</b>, {fecha(leida.copia.exportado)}, versión {leida.copia.app}.
        {/if}
      </p>
      {#if leida.copia.automatica}
        <p class="nota" data-copia-es-automatica>
          Es la copia automática que se guardó antes de «Sustituir todo». Para recuperar esos datos hay que
          <b>sustituir</b>: al unir, las versiones de la sustitución son más recientes y se quedarían.
        </p>
      {/if}
      {#if Object.keys(leida.descartados).length}
        <p class="nota" data-copia-descartados>
          Se dejan fuera {Object.values(leida.descartados).reduce((a, b) => a + b, 0)} elementos dañados o mal formados
          ({Object.entries(leida.descartados).map(([k, n]) => `${(NOMBRES[k] ?? k).toLowerCase()}: ${n}`).join('; ')}).
        </p>
      {/if}
      {#if leida.desconocidos.length}
        <p class="nota" data-copia-desconocidos>
          La copia tiene datos que esta versión no conoce ({leida.desconocidos.join(', ')}); no se importan.
        </p>
      {/if}

      <fieldset class="modos">
        <legend>Cómo importarla</legend>
        <label class="modo">
          <input type="radio" name="modo-copia" value="unir" checked={modo === 'unir'} onchange={() => cambiarModo('unir')} data-copia-modo="unir" />
          <span><b>Unir con los datos de este dispositivo</b> (recomendado). De cada elemento queda la versión más reciente;
            no se pierde nada de lo que hay aquí y lo que borró después de hacer la copia sigue borrado.</span>
        </label>
        <label class="modo">
          <input type="radio" name="modo-copia" value="sustituir" checked={modo === 'sustituir'} onchange={() => cambiarModo('sustituir')} data-copia-modo="sustituir" />
          <span><b>Sustituir todo</b> por el contenido de la copia.</span>
        </label>
      </fieldset>

      {#if modo === 'unir' && antiguos > 0}
        <div class="antiguos" data-copia-antiguos={antiguos}>
          <p class="nota">
            Se dejan fuera {antiguos} {antiguos === 1 ? 'elemento' : 'elementos'} de hace más de 90 días que este dispositivo ya
            no tiene: pueden haberse borrado después de hacer la copia, y al importarlos volverían a todos sus dispositivos.
          </p>
          <label class="casilla">
            <input type="checkbox" bind:checked={incluirAntiguos} onchange={() => calcular()} data-copia-incluir-antiguos />
            Incluirlos también
          </label>
        </div>
      {/if}
      {#if sincronizarAntes}
        <p class="nota" data-copia-sincronizar-antes>
          Este dispositivo todavía no se ha sincronizado: conviene sincronizar antes de importar, para que no vuelva lo
          que se borró en los demás dispositivos.
        </p>
      {/if}

      {#if conCambios.length}
        <table class="cambios">
          <caption>Qué cambiará en este dispositivo</caption>
          <thead><tr><th scope="col">Datos</th><th scope="col">Nuevos</th><th scope="col">Cambian</th><th scope="col">Se borran</th></tr></thead>
          <tbody>
            {#each conCambios as p (p.clave)}
              <tr data-almacen={p.clave}>
                <th scope="row">{p.nombre}</th>
                <td data-nuevos>{p.nuevos}</td>
                <td data-cambiados>{p.cambiados}</td>
                <td data-borrados class:hay={p.borrados > 0}>{p.borrados}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {:else}
        <p class="ok" data-copia-nada>La copia no cambia nada: este dispositivo ya tiene todo lo que contiene.</p>
      {/if}

      {#if modo === 'sustituir'}
        <div class="peligro-caja" role="note">
          <p>
            <b>Atención:</b> lo que no esté en la copia se borrará de este dispositivo y, al sincronizar, también de los demás.
            Antes de sustituir se guardará automáticamente una copia de sus datos actuales: podrá descargarla aquí y volver a
            ellos con «Deshacer la sustitución».
          </p>
          <label class="casilla">
            <input type="checkbox" bind:checked={confirmado} data-copia-confirmar />
            Entiendo que se sustituirán mis datos por los de la copia.
          </label>
        </div>
      {/if}

      <div class="botones">
        <button
          class="boton primario"
          class:peligro={modo === 'sustituir'}
          onclick={aplicar}
          disabled={ocupado || !conCambios.length || (modo === 'sustituir' && !confirmado)}
          data-copia-aplicar
        >
          {modo === 'sustituir' ? 'Sustituir todo' : 'Importar y unir'}
        </button>
        <button class="boton" onclick={limpiar} disabled={ocupado}>Cancelar</button>
      </div>
    </div>
  {/if}

  {#if resultado}
    <div class="resultado" role="status" tabindex="-1" bind:this={cajaResultado} data-copia-resultado data-fallidos={resultado.fallidos.length}>
      <p class="ok">
        Importado: {hechos(resultado)} {hechos(resultado) === 1 ? 'cambio' : 'cambios'}. Si sincroniza, la próxima sincronización
        los llevará a sus demás dispositivos.
      </p>
      {#if resultado.fallidos.length}
        <p class="error">
          No se ha podido guardar (se ha dejado como estaba): {resultado.fallidos.map((f) => f.nombre).join(', ')}. Libere espacio y
          vuelva a importar la copia: lo ya importado no se duplica.
        </p>
      {/if}
      {#if resultado.copiaAutomatica}
        <p class="nota">Antes se guardó una copia automática de sus datos anteriores ({resultado.copiaAutomatica}).</p>
      {/if}
    </div>
  {/if}

  {#if automatica}
    <div class="automatica">
      <p class="nota">
        Última copia automática (antes de «Sustituir todo»): {fecha(automatica.t)}. Para volver a los datos de entonces,
        use «Deshacer la sustitución» (importar ese fichero con «Unir» no los recupera).
      </p>
      <div class="botones">
        <button class="boton" onclick={deshacer} disabled={ocupado} data-copia-deshacer>Deshacer la sustitución</button>
        <button class="boton enlace" onclick={descargarAutomatica} disabled={ocupado} data-copia-automatica>Guardarla en un fichero</button>
      </div>
    </div>
  {/if}
</section>

<style>
  .tarjeta {
    margin-top: 16px;
    padding: 16px 18px;
    border: 1px solid var(--linea);
    border-radius: 14px;
    background: var(--superficie);
  }
  h2 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 10px;
    color: var(--titulos);
    font-size: 18px;
    font-weight: 700;
  }
  h2:focus {
    outline: none;
  }
  h3 {
    margin: 0 0 6px;
    color: var(--titulos);
    font-size: 16px;
    overflow-wrap: anywhere;
  }
  p {
    margin: 8px 0;
    line-height: 1.45;
  }
  .botones {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 10px;
  }
  .botones .boton {
    min-height: 44px;
  }
  .oculto {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
  }
  .vista,
  .resultado {
    margin-top: 14px;
    padding: 12px 14px;
    border: 1px solid var(--linea);
    border-radius: 12px;
    background: var(--fondo);
  }
  .origen {
    color: var(--tinta-suave);
    font-size: 14.5px;
  }
  .modos {
    margin: 12px 0 4px;
    padding: 0;
    border: 0;
  }
  legend {
    margin-bottom: 6px;
    color: var(--tinta-suave);
    font-size: 14px;
    font-weight: 600;
  }
  .modo {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    min-height: 44px;
    padding: 6px 0;
    line-height: 1.4;
    cursor: pointer;
  }
  .modo input,
  .casilla input {
    flex: none;
    width: 20px;
    height: 20px;
    margin-top: 1px;
    accent-color: var(--acento);
  }
  .cambios {
    width: 100%;
    margin-top: 10px;
    border-collapse: collapse;
    font-size: 14.5px;
  }
  caption {
    margin-bottom: 4px;
    color: var(--tinta-suave);
    font-size: 14px;
    font-weight: 600;
    text-align: left;
  }
  .cambios th,
  .cambios td {
    padding: 6px 4px;
    border-bottom: 1px solid var(--linea);
    text-align: right;
    vertical-align: top;
  }
  .cambios th[scope='row'],
  .cambios thead th:first-child {
    text-align: left;
    font-weight: 500;
    overflow-wrap: anywhere;
  }
  .cambios thead th {
    color: var(--tinta-suave);
    font-size: 13px;
    font-weight: 600;
  }
  .cambios td {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .cambios td.hay {
    color: var(--c-precaucion);
    font-weight: 700;
  }
  .peligro-caja {
    margin-top: 12px;
    padding: 10px 12px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--c-precaucion) 9%, transparent);
  }
  .casilla {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    min-height: 44px;
    padding-top: 4px;
    line-height: 1.4;
    cursor: pointer;
  }
  /* (the warning colour as text on the card, as the page's errors: readable in every theme) */
  .boton.primario.peligro {
    border: 2px solid var(--c-precaucion);
    background: var(--superficie);
    color: var(--c-precaucion);
    font-weight: 700;
  }
  .boton:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .boton.enlace {
    min-height: 44px;
    margin-left: 4px;
  }
  .automatica {
    margin-top: 14px;
  }
  .nota {
    color: var(--tinta-suave);
    font-size: 14px;
  }
  .ok {
    color: var(--c-ejemplo);
    font-size: 14px;
    font-weight: 600;
  }
  .error {
    color: var(--c-precaucion);
    font-size: 14px;
  }
  .error.caja {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    margin-top: 12px;
    padding: 10px 12px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--c-precaucion) 9%, transparent);
    color: var(--tinta);
  }
  .error.caja :global(svg) {
    flex: none;
    margin-top: 1px;
    color: var(--c-precaucion);
  }
  @media (max-width: 420px) {
    .cambios {
      font-size: 13.5px;
    }
    .cambios th,
    .cambios td {
      padding: 6px 2px 6px 8px;
    }
    .cambios th[scope='row'],
    .cambios thead th:first-child {
      padding-left: 0;
    }
    .cambios thead th {
      font-size: 12.5px;
    }
  }
</style>
