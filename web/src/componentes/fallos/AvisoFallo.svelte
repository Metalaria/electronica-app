<script lang="ts">
  // 1.0, mounted once by App.svelte: the gentle notice after a failure («Ver el informe», non-blocking, at most once a
  // minute, never on «Diagnóstico» itself) and what feeds the «Informe de fallos» from outside the components: a schema
  // migration that failed at this start, the synchronisation's errors (not the transient ones: no network, GitHub
  // down) and, in Tauri, the native side's panics recorded since the last start. Under automation (navigator.webdriver)
  // the notice stays hidden unless the page sets `window.__epaInformeAviso` (the QA screenshots must not change).
  import { onMount, untrack } from 'svelte';
  import { alNuevoFallo, informarFallo, informarNativos, ocultarEnInforme, type EntradaFallo } from '../../lib/informe-fallos';
  import { puedeSalir } from '../../lib/salida';
  import { enTauri, obtenerAlmacen } from '../../lib/almacen';
  import { resultadoMigracion } from '../../lib/migrar';
  import { app } from '../../lib/estado.svelte';
  import { usuario } from '../../lib/usuario.svelte';

  let aviso = $state<EntradaFallo | null>(null);
  let ultimo = 0;
  let ocultar: ReturnType<typeof setTimeout> | undefined;

  function permitido(): boolean {
    const w = window as unknown as { __epaInformeAviso?: boolean };
    return !navigator.webdriver || !!w.__epaInformeAviso;
  }

  function mostrar(e: EntradaFallo): void {
    if (!permitido() || location.hash.startsWith('#/diagnostico')) return;
    const ahora = Date.now();
    if (aviso === null && ahora - ultimo < 60_000) return;
    ultimo = ahora;
    aviso = e;
    clearTimeout(ocultar);
    ocultar = setTimeout(() => (aviso = null), 20_000);
  }

  function cerrar(): void {
    clearTimeout(ocultar);
    aviso = null;
  }

  async function verInforme(): Promise<void> {
    // (review 10c: a page with unsaved changes — the teacher-mode editor — asks first)
    if (!(await puedeSalir())) return;
    cerrar();
    location.hash = '#/diagnostico/informe';
  }

  async function recargar(): Promise<void> {
    if (await puedeSalir()) location.reload();
  }

  // the synchronisation's state, once its module is loaded (by Avisos.svelte after the start; imported here later)
  let sinc = $state.raw<{ ejecuciones: number; error: string; pasajero: boolean; ajustes: { repositorio: string; ruta: string } } | null>(null);
  let errorVisto = '';
  // review 10c: the data repository («owner/name»), its owner and the file's path never reach the report
  $effect(() => {
    if (!sinc) return;
    const { repositorio, ruta } = sinc.ajustes;
    untrack(() => {
      ocultarEnInforme(repositorio, '[repositorio]');
      ocultarEnInforme(repositorio.split('/')[0] ?? '', '[propietario]');
      ocultarEnInforme(ruta, '[fichero de sincronización]');
    });
  });
  $effect(() => {
    if (!sinc) return;
    const n = sinc.ejecuciones;
    const error = sinc.error;
    const pasajero = sinc.pasajero;
    untrack(() => {
      if (!n || !error || pasajero) {
        if (!error) errorVisto = '';
        return;
      }
      if (error === errorVisto) return;
      errorVisto = error;
      informarFallo('sincronizacion', error);
    });
  });

  let pedido = false;
  $effect(() => {
    if (pedido || !app.cargado || !usuario.listo) return;
    pedido = true;
    const ir = () =>
      void import('../../lib/sincronizacion/sincronizar.svelte')
        .then((m) => (sinc = m.sinc))
        .catch(() => {});
    if ('requestIdleCallback' in window) window.requestIdleCallback(ir, { timeout: 8000 });
    else setTimeout(ir, 3000);
  });

  onMount(() => {
    const quitar = alNuevoFallo(mostrar);
    // what the schema migration of this start could not do (lib/migrar.ts; its own notice explains it)
    void obtenerAlmacen()
      .then(() => {
        for (const f of resultadoMigracion().fallidas) if (f.tipo === 'fallo') informarFallo('migracion', `${f.clave}: ${f.error}`, { zona: f.descripcion });
      })
      .catch((e: unknown) => informarFallo('almacenamiento', e));
    // Tauri: panics of the native side since the last start (src-tauri/src/lib.rs, module `fallos`)
    if (enTauri())
      void import('@tauri-apps/api/core')
        .then(({ invoke }) => invoke<string>('fallos_nativos'))
        .then((texto) => void informarNativos(String(texto ?? '')))
        .catch(() => {});
    return () => {
      quitar();
      clearTimeout(ocultar);
    };
  });

  const texto = $derived(
    !aviso
      ? ''
      : aviso.k === 'cierre'
        ? 'La aplicación se cerró de golpe la última vez que la usó. Se ha guardado un informe en este dispositivo.'
        : aviso.k === 'carga'
          ? 'No ha llegado una parte de la aplicación (puede que se haya actualizado). Vuelva a cargar la página.'
          : aviso.k === 'nativo'
            ? 'La parte nativa de la aplicación falló la última vez. Se ha guardado un informe en este dispositivo.'
            : 'Se ha producido un error. Se ha anotado en el informe de fallos de este dispositivo.',
  );
</script>

{#if aviso}
  <div class="aviso-fallo" role="status" aria-live="polite" data-aviso-fallo={aviso.k}>
    <p>{texto}</p>
    <div class="botones">
      {#if aviso.k === 'carga'}
        <button type="button" class="boton primario" onclick={() => void recargar()} data-recargar>Recargar la página</button>
      {/if}
      <button type="button" class="boton" onclick={() => void verInforme()} data-ver-informe>Ver el informe</button>
      <button type="button" class="boton" onclick={cerrar} aria-label="Cerrar el aviso">Cerrar</button>
    </div>
  </div>
{/if}

<style>
  .aviso-fallo {
    position: fixed;
    z-index: 60;
    left: calc(var(--ancho-lateral, 0px) + 16px);
    right: 16px;
    bottom: calc(var(--alto-pestanas, 0px) + env(safe-area-inset-bottom, 0px) + 16px);
    max-width: 34em;
    margin: 0 auto;
    padding: 14px 16px;
    border: 1px solid var(--linea);
    border-radius: var(--radio-tarjeta-p);
    background: var(--superficie);
    color: var(--tinta);
    font-family: var(--sans);
    font-size: 15px;
    box-shadow: var(--sombra-alta);
  }
  p {
    margin: 0 0 10px;
  }
  .botones {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
</style>
