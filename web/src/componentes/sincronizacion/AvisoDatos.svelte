<script lang="ts">
  // 1.0: what the schema migration at this start left undone (lib/migrar.ts), and the backup of the data as they were
  // before it. Mounted by Arranque.svelte (a notice, only when something was left undone) and by the Sincronización
  // page (`pagina`: also the backup's controls when there is one, «Datos anteriores a la actualización»).
  import { onMount, tick } from 'svelte';
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
  import { obtenerAlmacen, restaurarDatosAnteriores } from '../../lib/almacen';
  import { leerCopiaMigracion, resultadoMigracion } from '../../lib/migrar';
  import { guardarFichero, CANCELADO } from '../../lib/sincronizacion/fichero';
  import { confirmar } from '../../lib/confirmar';
  import { sincronizables } from '../../lib/sincronizacion/registro.svelte';

  let { pagina = false }: { pagina?: boolean } = $props();

  const r = resultadoMigracion();
  let copia = $state<{ nombre: string; texto: string; t: number } | null>(null);
  let ocupado = $state(false);
  let mensaje = $state('');
  let oculto = $state(false);

  const nombre = (clave: string) => sincronizables().find((s) => s.clave === clave)?.nombre ?? clave;
  const fallos = r.fallidas.filter((f) => f.tipo === 'fallo');
  const nuevas = r.fallidas.filter((f) => f.tipo === 'nueva');
  const retenidas = r.fallidas.filter((f) => f.tipo === 'retenida');

  onMount(async () => {
    try {
      copia = await leerCopiaMigracion(await obtenerAlmacen());
    } catch {
      copia = null;
    }
  });

  /**
   * The original data: the backup made before the migration and, for the keys whose migration failed (left untouched,
   * not in the backup when nothing else changed), their stored values as they are.
   */
  async function originales(): Promise<{ nombre: string; texto: string }> {
    const a = await obtenerAlmacen();
    const claves: Record<string, unknown> = {};
    let base: Record<string, unknown> = {};
    try {
      base = copia ? (JSON.parse(copia.texto) as Record<string, unknown>) : {};
    } catch {
      base = {};
    }
    Object.assign(claves, (base.claves as Record<string, unknown>) ?? {});
    // (a key left as it was — a migration that failed, data of a newer version, data restored — is what is stored NOW:
    // that is the original; the backup may hold an older one, of other data — review 10b)
    for (const f of [...fallos, ...nuevas, ...retenidas]) {
      const v = await a.leer<unknown>(f.clave).catch(() => undefined);
      if (v !== undefined) claves[f.clave] = v;
    }
    const t = Date.now();
    const texto = JSON.stringify({ ...base, formato: 'epa-copia-migracion', version: 1, t: base.t ?? t, claves }, null, 1) + '\n';
    return { nombre: copia?.nombre ?? `electronica-datos-originales-${new Date(t).toISOString().slice(0, 10)}.json`, texto };
  }

  // 1.0 accessibility pass: the button pressed is disabled while it works (`ocupado`), which dropped the focus to
  // <body>; it gets it back afterwards (the message beside it is a status line, read by itself)
  async function devolverFoco(el: Element | null): Promise<void> {
    await tick();
    const a = document.activeElement;
    if (el instanceof HTMLElement && el.isConnected && (!a || a === document.body)) el.focus();
  }

  async function guardar() {
    const antes = document.activeElement;
    ocupado = true;
    try {
      const o = await originales();
      const r = await guardarFichero(o.nombre, o.texto);
      mensaje = r === CANCELADO ? '' : 'Copia de los datos originales guardada.';
    } catch (e) {
      mensaje = `No se ha podido guardar el fichero: ${e instanceof Error ? e.message : String(e)}`;
    } finally {
      ocupado = false;
      void devolverFoco(antes);
    }
  }

  async function restaurar() {
    const si = await confirmar({
      titulo: '¿Restaurar los datos de antes de la actualización?',
      mensaje:
        'Los apartados que se actualizaron vuelven a como estaban antes de instalar esta versión, y lo que haya cambiado en ellos desde entonces se pierde. Esta versión dejará de guardar cambios en ellos (para poder volver a la versión anterior o esperar a una nueva). La aplicación se volverá a abrir.',
      aceptar: 'Restaurar',
    });
    if (!si) return;
    const antes = document.activeElement;
    ocupado = true;
    try {
      await restaurarDatosAnteriores();
      location.reload();
    } catch (e) {
      mensaje = `No se han podido restaurar: ${e instanceof Error ? e.message : String(e)}`;
      ocupado = false;
      void devolverFoco(antes);
    }
  }
</script>

{#if !pagina && r.fallidas.length && !oculto}
  <div class="aviso-datos" role="alert" data-aviso-datos>
    <p class="titulo"><TriangleAlert size={18} aria-hidden="true" /> Algunos datos no se han actualizado a esta versión</p>
    {#if fallos.length}
      <p>
        No se han podido convertir: {fallos.map((f) => `«${nombre(f.clave)}»`).join(', ')}. Sus datos siguen como estaban, sin
        tocar; mientras tanto esta versión no guarda cambios en ellos, ni los sincroniza, ni los incluye en las copias de
        seguridad. Guarde los datos originales en un fichero y conserve
        la copia: una versión corregida los convertirá.
      </p>
    {/if}
    {#if nuevas.length}
      <p>
        {nuevas.map((f) => `«${nombre(f.clave)}»`).join(', ')}: los guardó una versión más nueva de la aplicación. Esta no
        los modifica; actualice la aplicación.
      </p>
    {/if}
    {#if retenidas.length}
      <p>
        {retenidas.map((f) => `«${nombre(f.clave)}»`).join(', ')}: restaurados a como estaban antes de actualizar. Esta
        versión no guarda cambios en ellos, ni los sincroniza, ni los incluye en las copias de seguridad.
      </p>
    {/if}
    <div class="botones">
      <button class="boton primario" onclick={guardar} disabled={ocupado} data-aviso-datos-guardar>Guardar los datos originales</button>
      <button class="boton" onclick={() => (oculto = true)}>Cerrar</button>
    </div>
    {#if mensaje}<p role="status">{mensaje}</p>{/if}
  </div>
{:else if pagina && copia}
  <div class="anteriores" data-datos-anteriores>
    <h3>Datos anteriores a la actualización</h3>
    <p>
      Antes de convertir sus datos a esta versión se guardó una copia de cómo estaban ({new Date(copia.t).toLocaleDateString('es-ES')}).
      Sirve para volver a la versión anterior de la aplicación o si la conversión hubiera fallado.
    </p>
    <div class="botones">
      <button class="boton" onclick={guardar} disabled={ocupado} data-datos-anteriores-guardar>Guardarlos en un fichero</button>
      <button class="boton" onclick={restaurar} disabled={ocupado} data-datos-anteriores-restaurar>Restaurarlos…</button>
    </div>
    {#if mensaje}<p role="status">{mensaje}</p>{/if}
  </div>
{/if}

<style>
  .aviso-datos {
    position: fixed;
    left: 16px;
    right: 16px;
    bottom: calc(16px + var(--hueco-inferior, 0px));
    z-index: 60;
    max-width: 34em;
    margin: 0 auto;
    padding: 14px 16px;
    background: var(--superficie);
    color: var(--tinta);
    border: 2px solid var(--c-precaucion);
    border-radius: 10px;
    box-shadow: var(--sombra-alta);
  }
  .titulo {
    display: flex;
    gap: 8px;
    align-items: center;
    font-weight: 700;
    color: var(--c-precaucion);
    margin: 0 0 8px;
  }
  p {
    margin: 0 0 10px;
    line-height: 1.45;
  }
  .botones {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .botones .boton {
    min-height: 44px;
  }
  .anteriores {
    margin-top: 14px;
  }
  h3 {
    font-size: 1rem;
    margin: 0 0 6px;
  }
</style>
