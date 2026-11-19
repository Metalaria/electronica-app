<script lang="ts">
  // 1.3: the real Brymen BM869s on the bench: «Conectar el Brymen real» (only where this platform can read its
  // BU-86X cable: the app on Windows, macOS and Android, or a desktop browser with WebHID), the connection's state,
  // and its reading next to the simulated meter's. Everything else on the page works the same without the cable.
  import { brymenReal } from '../../../lib/brymen-real/conexion.svelte';
  import { textoPantalla } from '../../../lib/brymen-real/lectura';

  let { simulado = null }: { simulado?: string | null } = $props();

  const c = brymenReal;
  const activo = $derived(c.estado === 'conectando' || c.estado === 'conectado' || c.estado === 'sin-respuesta');
  const l = $derived(c.estado === 'conectado' ? c.lectura : null);
  const estadoTexto = $derived(
    c.estado === 'conectado' ? `Conectado (${c.nombre}).` : c.estado === 'desconectado' ? 'Sin conectar: la práctica usa el Brymen simulado.' : c.mensaje,
  );
  const avisos = $derived(
    l ? [l.hold ? 'HOLD: la pantalla está congelada' : '', l.rel ? 'Δ (REL): muestra la diferencia con una referencia' : '', l.bateriaBaja ? 'pila baja: cámbiela, las lecturas pueden fallar' : ''].filter(Boolean) : [],
  );
</script>

{#if c.disponible}
  <section class="br-real" aria-label="Brymen real" data-brymen-real data-conexion-real={c.estado}>
    <div class="br-cab">
      <strong>Brymen real</strong>
      {#if activo}
        <button type="button" class="boton pequeno" onclick={() => void c.desconectar()} data-desconectar-real>Desconectar</button>
      {:else}
        <button type="button" class="boton primario pequeno" onclick={() => void c.conectar()} data-conectar-real>Conectar el Brymen real</button>
      {/if}
    </div>
    <p class="br-estado" class:error={c.estado === 'error'} role="status" aria-live="polite" data-estado-real>{estadoTexto}</p>
    {#if l}
      <div class="br-lecturas">
        <div>
          <span class="br-rotulo">Su Brymen</span>
          <output class="br-valor" data-lectura-real>{textoPantalla(l.principal)}</output>
          {#if l.secundaria}<output class="br-sec" data-lectura-real-secundaria>{textoPantalla(l.secundaria)}</output>{/if}
        </div>
        {#if simulado}
          <div>
            <span class="br-rotulo">Simulado</span>
            <output class="br-valor" data-lectura-simulada>{simulado}</output>
          </div>
        {/if}
      </div>
      {#if avisos.length}<p class="br-aviso">{avisos.join(' · ')}.</p>{/if}
    {/if}
    {#if c.estado !== 'desconectado'}
      <details class="br-diag">
        <summary>Diagnóstico</summary>
        <p>Vía: {c.tipo === 'nativo' ? 'la aplicación (USB)' : c.tipo === 'webhid' ? 'WebHID del navegador' : 'prueba'} · paquetes recibidos: {c.paquetes}</p>
        {#if c.crudo}<p class="br-crudo">Último paquete: <code data-crudo-real>{c.crudo}</code></p>{/if}
      </details>
    {/if}
  </section>
{/if}

<style>
  .br-real {
    margin: 12px 0;
    padding: 10px 12px;
    border: 1px solid var(--linea);
    border-radius: 10px;
    background: var(--superficie);
    font-family: var(--sans);
    font-size: 14px;
  }
  .br-cab {
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
  .br-estado {
    margin: 6px 0 0;
    color: var(--tinta-suave);
  }
  .br-estado.error {
    color: var(--c-precaucion);
  }
  .br-lecturas {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 24px;
    margin-top: 8px;
  }
  .br-lecturas > div {
    display: flex;
    flex-direction: column;
  }
  .br-rotulo {
    color: var(--tinta-tenue);
    font-size: 12px;
  }
  .br-valor {
    font-family: var(--mono);
    font-size: 18px;
    font-weight: 700;
  }
  .br-sec {
    font-family: var(--mono);
    font-size: 13px;
    color: var(--tinta-suave);
  }
  .br-aviso {
    margin: 6px 0 0;
    color: var(--c-importante);
    font-size: 13px;
  }
  .br-diag {
    margin-top: 6px;
    color: var(--tinta-tenue);
    font-size: 12.5px;
  }
  .br-diag summary {
    min-height: 32px;
    display: flex;
    align-items: center;
    cursor: pointer;
  }
  .br-diag p {
    margin: 2px 0;
  }
  .br-crudo code {
    word-break: break-all;
  }
</style>
