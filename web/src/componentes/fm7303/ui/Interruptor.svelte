<script lang="ts">
  // A switch of the kit (K1–K4, the antenna, the «Monitor» bridge): a 44 px toggle button with its state.
  let {
    etiqueta,
    activo = $bindable(),
    si = 'ON',
    no = 'OFF',
    titulo = '',
    id,
    deshabilitado = false,
  }: { etiqueta: string; activo: boolean; si?: string; no?: string; titulo?: string; id: string; deshabilitado?: boolean } = $props();
</script>

<button
  type="button"
  class="interruptor"
  class:on={activo}
  aria-pressed={activo}
  title={titulo || undefined}
  data-mando={id}
  disabled={deshabilitado}
  onclick={() => (activo = !activo)}
>
  <span class="nombre">{etiqueta}</span>
  <span class="estado">{activo ? si : no}</span>
</button>

<style>
  .interruptor {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-width: 64px;
    min-height: 44px;
    padding: 3px 10px;
    border: 1px solid var(--linea);
    border-radius: 10px;
    background: var(--superficie);
    color: var(--tinta);
    font-family: var(--sans);
    cursor: pointer;
    line-height: 1.15;
  }
  .interruptor:hover {
    background: var(--superficie-2);
  }
  .interruptor.on {
    border-color: var(--acento);
    background: var(--acento-tinte);
    color: var(--acento);
  }
  .interruptor:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .nombre {
    font-size: 13px;
    font-weight: 700;
  }
  .estado {
    font-size: 11.5px;
    color: var(--tinta-suave);
  }
  .on .estado {
    color: var(--acento);
  }
</style>
