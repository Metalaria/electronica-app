<script lang="ts">
  // «Sincronización y actualizaciones» (#/sincronizacion): the GitHub token, the data repository and file,
  // «Sincronizar ahora», what is synchronised, and the update check of the app.
  import { onMount } from 'svelte';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  import KeyRound from '@lucide/svelte/icons/key-round';
  import Unplug from '@lucide/svelte/icons/unplug';
  import CloudCheck from '@lucide/svelte/icons/cloud-check';
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
  import Download from '@lucide/svelte/icons/download';
  import {
    sinc,
    cargarSinc,
    sincronizar,
    ponerAjustesSinc,
    olvidarHistoria,
    REPOSITORIO_DEFECTO,
    RUTA_DEFECTO,
    INTERVALO,
  } from '../../lib/sincronizacion/sincronizar.svelte';
  import { sincronizables } from '../../lib/sincronizacion/registro.svelte';
  import { leerToken, guardarToken, olvidarToken, finalDelToken, pareceToken, dondeSeGuarda } from '../../lib/sincronizacion/credenciales';
  import { leerRepositorio, leerRutaFichero } from '../../lib/sincronizacion/github';
  import {
    actualizacion,
    buscarActualizaciones,
    versionNueva,
    resumenNotas,
    abrirEnNavegador,
    REPO_APP,
  } from '../../lib/sincronizacion/actualizaciones.svelte';
  import { cuando } from './tiempo';

  let token = $state('');
  let nuevoToken = $state('');
  let cambiando = $state(false);
  let errorToken = $state('');
  let donde = $state<'tauri' | 'navegador' | 'memoria'>('navegador');
  let repositorio = $state(REPOSITORIO_DEFECTO);
  let ruta = $state(RUTA_DEFECTO);
  let guardado = $state('');
  let ahora = $state(Date.now());

  const repoValido = $derived(!!leerRepositorio(repositorio));
  const rutaValida = $derived(!!leerRutaFichero(ruta) && /\.json$/i.test(ruta.trim()));
  const nueva = $derived(versionNueva());
  const NOMBRES: Record<string, string> = Object.fromEntries(sincronizables().map((s) => [s.clave, s.nombre]));

  onMount(() => {
    void (async () => {
      await cargarSinc();
      token = await leerToken();
      donde = await dondeSeGuarda();
      repositorio = sinc.ajustes.repositorio;
      ruta = sinc.ajustes.ruta;
      cambiando = !token;
    })();
    const reloj = setInterval(() => (ahora = Date.now()), 20_000);
    return () => clearInterval(reloj);
  });

  async function guardarYConectar(ev: SubmitEvent) {
    ev.preventDefault();
    errorToken = '';
    const t = nuevoToken.trim();
    if (!pareceToken(t)) {
      errorToken = 'Eso no parece un token de GitHub: debe empezar por «github_pat_» (o «ghp_») y no llevar espacios.';
      return;
    }
    await guardarAjustes();
    await guardarToken(t);
    token = t;
    nuevoToken = '';
    cambiando = false;
    sinc.hayToken = true;
    sinc.error = '';
    await sincronizar(true);
    void buscarActualizaciones(true);
  }

  async function guardarAjustes() {
    if (!repoValido || !rutaValida) return;
    const r = repositorio.trim();
    const p = ruta.trim().replace(/^\/+/, '');
    if (r === sinc.ajustes.repositorio && p === sinc.ajustes.ruta) return;
    await ponerAjustesSinc({ repositorio: r, ruta: p });
    guardado = 'Guardado. La próxima sincronización fusionará todo con ese fichero.';
    setTimeout(() => (guardado = ''), 4000);
  }

  async function desconectar() {
    await olvidarToken();
    await olvidarHistoria();
    token = '';
    sinc.hayToken = false;
    sinc.error = '';
    cambiando = true;
    actualizacion.sinToken = true;
  }

  function nombreAlmacen(clave: string): string {
    return NOMBRES[clave] ?? clave;
  }
</script>

<div class="pagina" data-pagina="sincronizacion" data-ejecuciones={sinc.ejecuciones} data-ocupado={sinc.ocupado}>
  <header>
    <h1>Sincronización y actualizaciones</h1>
    <p>
      Marcadores, notas, progreso y repaso viajan entre sus dispositivos a través de un fichero JSON en un
      repositorio privado de GitHub suyo. Cada dispositivo fusiona sus cambios con los de los demás, elemento a
      elemento: no se pisa nada.
    </p>
  </header>

  <section class="tarjeta" aria-labelledby="t-cuenta">
    <h2 id="t-cuenta"><KeyRound size={20} aria-hidden="true" /> Token de GitHub</h2>
    {#if token && !cambiando}
      <p class="fila">
        <span>Token guardado en este dispositivo: <code class="token" data-token-final>{finalDelToken(token)}</code></span>
        <span class="botones">
          <button class="boton" onclick={() => (cambiando = true)}>Cambiar token</button>
          <button class="boton peligro" onclick={desconectar}><Unplug size={16} aria-hidden="true" /> Desconectar</button>
        </span>
      </p>
    {:else}
      <form onsubmit={guardarYConectar} class="formulario">
        <label for="token">Token de acceso personal (fine-grained)</label>
        <input
          id="token"
          name="token"
          type="password"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          placeholder="github_pat_…"
          bind:value={nuevoToken}
          aria-describedby="ayuda-token"
          aria-invalid={!!errorToken}
        />
        <p id="ayuda-token" class="ayuda">
          Necesita acceso a <b>{REPO_APP.owner}/{REPO_APP.repo}</b> (Contents: lectura, para las actualizaciones) y a
          <b>{repositorio || REPOSITORIO_DEFECTO}</b> (Contents: lectura y escritura). Abajo, «Cómo crear el token».
        </p>
        {#if errorToken}<p class="error" role="alert">{errorToken}</p>{/if}
        <span class="botones">
          <button class="boton primario" type="submit" disabled={!nuevoToken.trim() || !repoValido || !rutaValida}>
            Guardar y sincronizar
          </button>
          {#if token}<button class="boton" type="button" onclick={() => ((cambiando = false), (nuevoToken = ''))}>Cancelar</button>{/if}
        </span>
      </form>
    {/if}
    <p class="nota">
      {#if donde === 'tauri'}
        El token se guarda solo en este dispositivo, en un fichero propio de la aplicación (<code>credenciales.json</code>),
        aparte de sus datos de lectura; nunca se escribe en el repositorio ni en el fichero sincronizado.
      {:else}
        En el navegador (versión de desarrollo) el token se guarda en el <code>localStorage</code> de este navegador:
        cualquiera con acceso a este perfil podría leerlo. En la aplicación instalada va en un fichero propio.
      {/if}
    </p>
  </section>

  <section class="tarjeta" aria-labelledby="t-fichero">
    <h2 id="t-fichero">Repositorio y fichero de datos</h2>
    <div class="campos">
      <div class="campo">
        <label for="repo">Repositorio (propietario/nombre)</label>
        <input id="repo" bind:value={repositorio} onchange={guardarAjustes} spellcheck="false" autocapitalize="off" aria-invalid={!repoValido} />
        {#if !repoValido}<p class="error">Escriba propietario/nombre, por ejemplo {REPOSITORIO_DEFECTO}.</p>{/if}
      </div>
      <div class="campo">
        <label for="ruta">Ruta del fichero en el repositorio</label>
        <input id="ruta" bind:value={ruta} onchange={guardarAjustes} spellcheck="false" autocapitalize="off" aria-invalid={!rutaValida} />
        {#if !rutaValida}<p class="error">Una ruta de fichero .json, por ejemplo {RUTA_DEFECTO}.</p>{/if}
      </div>
    </div>
    {#if guardado}<p class="ok" role="status">{guardado}</p>{/if}
    <label class="casilla">
      <input type="checkbox" checked={sinc.ajustes.auto} onchange={(e) => ponerAjustesSinc({ auto: e.currentTarget.checked })} />
      Sincronizar automáticamente: al abrir la aplicación, cada {Math.round(INTERVALO / 60_000)} minutos mientras está abierta y al
      pasar a segundo plano.
    </label>
  </section>

  <section class="tarjeta estado" aria-labelledby="t-estado">
    <h2 id="t-estado"><CloudCheck size={20} aria-hidden="true" /> Estado</h2>
    <div class="fila">
      <p class="ultima" data-ultima>
        {#if !sinc.hayToken}
          Sin configurar: falta el token.
        {:else if sinc.ocupado}
          Sincronizando…
        {:else if sinc.ultima}
          Última sincronización: {cuando(sinc.ultima, ahora)}.
        {:else}
          Todavía no se ha sincronizado este dispositivo.
        {/if}
      </p>
      <button class="boton primario" onclick={() => sincronizar(true)} disabled={!sinc.hayToken || sinc.ocupado} data-sincronizar>
        <span class:gira={sinc.ocupado}><RefreshCw size={16} aria-hidden="true" /></span> Sincronizar ahora
      </button>
    </div>
    {#if sinc.error}
      <p class="error caja" class:pasajero={sinc.pasajero} role="alert" data-error-sinc>
        <TriangleAlert size={18} aria-hidden="true" />
        <span>{sinc.error}</span>
      </p>
    {/if}
    {#if sinc.resumen && sinc.ultima}
      <p class="resumen" data-resumen>
        {#if sinc.resumen.creado}Se creó el fichero en el repositorio.{:else if sinc.resumen.escrito}Se enviaron los cambios de este dispositivo.{:else}No había cambios que enviar.{/if}
        {#if sinc.resumen.recibidos}
          Recibidos de otros dispositivos: {sinc.resumen.recibidos}
          ({Object.entries(sinc.resumen.porAlmacen).map(([k, n]) => `${nombreAlmacen(k).toLowerCase()}: ${n}`).join('; ')}).
        {/if}
      </p>
      {#if sinc.resumen.dispositivos.length}
        <ul class="dispositivos" aria-label="Dispositivos sincronizados">
          {#each sinc.resumen.dispositivos as d, i (i)}
            <li>
              <b>{d.nombre}</b>{d.este ? ' (este)' : ''} · versión {d.version} · {cuando(d.ultima, ahora)}
            </li>
          {/each}
        </ul>
      {/if}
    {/if}
  </section>

  <section class="tarjeta" aria-labelledby="t-que">
    <h2 id="t-que">Qué se sincroniza</h2>
    <ul class="lista">
      {#each sincronizables() as s (s.clave)}<li>{s.nombre}</li>{/each}
    </ul>
    <p class="nota">
      No se sincroniza (es propio de cada dispositivo): tema y tamaño de letra, el índice abierto o cerrado en cada
      vista, la elección 2D/3D de los componentes, el circuito libre del simulador y estos ajustes. Las eliminaciones
      viajan como «lápidas» que se borran a los 90 días: un dispositivo que pase más tiempo sin sincronizar podría
      recuperar algo borrado.
    </p>
  </section>

  <section class="tarjeta" aria-labelledby="t-version">
    <h2 id="t-version"><Download size={20} aria-hidden="true" /> Actualizaciones</h2>
    <div class="fila">
      <p>Versión instalada: <b data-version-app>{actualizacion.version}</b></p>
      <button class="boton" onclick={() => buscarActualizaciones(true)} disabled={!sinc.hayToken || actualizacion.buscando}>
        <span class:gira={actualizacion.buscando}><RefreshCw size={16} aria-hidden="true" /></span> Buscar actualizaciones
      </button>
    </div>
    {#if !sinc.hayToken}
      <p class="nota" data-sin-token>
        El repositorio de la aplicación ({REPO_APP.owner}/{REPO_APP.repo}) es privado: sin token no se puede
        consultar, así que no se comprueba nada. Con el token, se mira al abrir la aplicación, como mucho cada 12 horas.
      </p>
    {:else if actualizacion.error}
      <p class="error" role="alert">{actualizacion.error}</p>
    {:else if nueva}
      <div class="nueva">
        <p><b>Versión {nueva.version} disponible.</b> {resumenNotas(nueva.notas)}</p>
        <button class="boton primario" onclick={() => abrirEnNavegador(nueva.url)}>Ver la publicación</button>
      </div>
    {:else if actualizacion.alDia}
      <p class="ok" role="status">Tiene la última versión publicada.</p>
    {:else if actualizacion.comprobada}
      <p class="nota">Comprobado {cuando(actualizacion.comprobada, ahora)}.</p>
    {/if}
  </section>

  <section class="tarjeta" aria-labelledby="t-como">
    <details>
      <summary><h2 id="t-como">Cómo crear el repositorio y el token</h2></summary>
      <ol class="pasos">
        <li>
          En GitHub, <b>New repository</b>: Owner <b>{REPOSITORIO_DEFECTO.split('/')[0]}</b>, Repository name
          <b>{REPOSITORIO_DEFECTO.split('/')[1]}</b>, visibilidad <b>Private</b>, marque <b>Add a README file</b> y
          pulse <b>Create repository</b>. El fichero de datos lo crea la aplicación en la primera sincronización.
        </li>
        <li>
          <b>Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token</b>.
        </li>
        <li>
          Token name <b>Electrónica — sincronización</b>; Expiration <b>Custom</b>, una fecha de dentro de un año (al
          caducar, la aplicación lo dirá y bastará con crear otro); Resource owner <b>{REPO_APP.owner}</b>.
        </li>
        <li>
          Repository access: <b>Only select repositories</b> → <b>{REPO_APP.owner}/{REPO_APP.repo}</b> y
          <b>{REPOSITORIO_DEFECTO}</b>.
        </li>
        <li>
          Permissions → Repository permissions: <b>Contents: Read and write</b> (lo único que hace falta;
          <b>Metadata: Read-only</b> se añade solo). Nada en Account permissions.
        </li>
        <li><b>Generate token</b>, cópielo (solo se muestra una vez) y péguelo arriba en cada dispositivo.</li>
      </ol>
      <p class="nota">
        Un token fine-grained da el mismo permiso en todos los repositorios elegidos: con Contents: Read and write la
        aplicación solo lee las publicaciones de {REPO_APP.repo} y solo escribe el fichero de datos.
      </p>
    </details>
  </section>
</div>

<style>
  .pagina {
    max-width: 820px;
    margin: 0 auto;
    padding: 0 clamp(16px, 4vw, 40px) 64px;
    font-family: var(--sans);
    color: var(--tinta);
  }
  header {
    padding: clamp(24px, 5vw, 44px) 0 14px;
  }
  h1 {
    margin: 0;
    color: var(--titulos);
    font-family: var(--serif);
    font-size: clamp(28px, 5vw, 40px);
    font-weight: 700;
    letter-spacing: -0.015em;
  }
  header p {
    margin: 10px 0 0;
    max-width: 44em;
    color: var(--tinta-suave);
    font-size: 16px;
    line-height: 1.5;
  }
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
  summary {
    cursor: pointer;
    list-style-position: outside;
  }
  summary h2 {
    display: inline-flex;
    margin: 0;
  }
  p {
    margin: 8px 0;
    line-height: 1.45;
  }
  .fila {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px 16px;
  }
  .fila p {
    margin: 0;
  }
  .botones {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .formulario,
  .campo {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .campos {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px 16px;
  }
  @media (max-width: 640px) {
    .campos {
      grid-template-columns: 1fr;
    }
  }
  label {
    font-size: 14px;
    font-weight: 600;
    color: var(--tinta-suave);
  }
  input:not([type='checkbox']) {
    min-height: 40px;
    padding: 0 12px;
    border: 1px solid var(--linea);
    border-radius: 10px;
    background: var(--fondo);
    font-family: var(--mono);
    font-size: 15px;
    min-width: 0;
  }
  input[aria-invalid='true'] {
    border-color: var(--c-precaucion);
  }
  .casilla {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin-top: 14px;
    color: var(--tinta);
    font-weight: 400;
    line-height: 1.4;
  }
  .casilla input {
    width: 18px;
    height: 18px;
    margin-top: 2px;
    accent-color: var(--acento);
    flex: none;
  }
  .ayuda,
  .nota {
    color: var(--tinta-suave);
    font-size: 14px;
  }
  .nota {
    margin-bottom: 0;
  }
  code {
    font-family: var(--mono);
    font-size: 0.92em;
  }
  .token {
    padding: 1px 6px;
    border-radius: 6px;
    background: var(--superficie-2);
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
  .error.caja.pasajero {
    background: color-mix(in srgb, var(--c-importante) 10%, transparent);
  }
  .error.caja.pasajero :global(svg) {
    color: var(--c-importante);
  }
  .ok {
    color: var(--c-ejemplo);
    font-size: 14px;
    font-weight: 600;
  }
  .peligro {
    color: var(--c-precaucion);
  }
  .boton:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .gira {
    display: inline-grid;
    animation: girar 0.9s linear infinite;
  }
  @keyframes girar {
    to {
      transform: rotate(360deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .gira {
      animation: none;
    }
  }
  .resumen {
    color: var(--tinta-suave);
    font-size: 14.5px;
  }
  .dispositivos,
  .lista {
    margin: 6px 0 0;
    padding-left: 20px;
    font-size: 14.5px;
    line-height: 1.6;
  }
  .lista {
    columns: 2 260px;
  }
  .nueva {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 16px;
    margin-top: 8px;
    padding: 10px 12px;
    border-radius: 10px;
    background: var(--acento-tinte);
  }
  .nueva p {
    flex: 1 1 280px;
    margin: 0;
  }
  .pasos {
    margin: 12px 0 0;
    padding-left: 22px;
    line-height: 1.55;
  }
  .pasos li + li {
    margin-top: 6px;
  }
</style>
