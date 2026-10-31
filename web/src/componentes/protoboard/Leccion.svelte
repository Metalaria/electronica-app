<script lang="ts">
  // «La protoboard por dentro» (0.11), what the user sees: the screen's card above the bench (one idea and
  // something to tap or answer, «Saltar», «Siguiente») and the answer at the foot of the bench.
  import type { Protoboard } from './estado.svelte';
  import X from '@lucide/svelte/icons/x';
  import Check from '@lucide/svelte/icons/check';

  let {
    pb,
    parte = 'banda',
    alTerminar,
  }: {
    pb: Protoboard;
    parte?: 'banda' | 'respuesta';
    /** The lesson ended (finished or skipped): `seguir` starts its next guided circuit. */
    alTerminar: (seguir: boolean) => void;
  } = $props();

  const l = $derived(pb.leccion);
  const p = $derived(l?.pantalla);
  const total = $derived((l?.pantallas.length ?? 1) - 1);
</script>

{#if l && p && parte === 'banda'}
  <section class="leccion" aria-label="La protoboard por dentro" data-pantalla={p.id}>
    <div class="fila">
      <div class="progreso" aria-hidden="true">
        {#each l.pantallas.slice(0, -1) as x, i (x.id)}<span class="punto" class:hecho={i < l.i || (i === l.i && l.listo)} class:actual={i === l.i}></span>{/each}
      </div>
      <span class="cuenta">La protoboard por dentro{p.tipo !== 'final' ? ` · ${l.i + 1} de ${total}` : ''}</span>
      {#if p.tipo !== 'final'}<button type="button" class="enlace" onclick={() => { l.marcar(); alTerminar(true); }}>Saltar</button>{/if}
      <button type="button" class="salir" aria-label="Cerrar la lección" title="Cerrar" onclick={() => { l.marcar(); alTerminar(false); }}><X size={18} /></button>
    </div>
    <p class="ahora" aria-live="polite">{p.titulo}</p>
    {#if p.tipo === 'final'}
      <p class="resumen">{p.texto}</p>
      <div class="botones">
        {#if l.siguiente}<button type="button" class="boton primario grande" onclick={() => { l.marcar(); alTerminar(true); }}>Siguiente: {l.siguiente.titulo}</button>{/if}
        <button type="button" class="boton grande" onclick={() => { l.marcar(); alTerminar(false); }}>Terminar</button>
      </div>
    {:else}
      <div class="botones">
        {#if p.tipo === 'pregunta' && !l.listo}
          <button type="button" class="boton grande si" onclick={() => l.responder(true)}>Sí</button>
          <button type="button" class="boton grande no" onclick={() => l.responder(false)}>No</button>
        {/if}
        <span class="hueco"></span>
        <button type="button" class="boton primario grande" disabled={!l.listo} onclick={() => l.avanzar()}>Siguiente</button>
      </div>
    {/if}
  </section>
{:else if l && p && parte === 'respuesta' && l.texto}
  <div class="respuesta" class:bien={l.resultado === 'bien'} class:mal={l.resultado === 'mal'} role={l.resultado === 'mal' ? 'alert' : 'status'}>
    {#if l.resultado === 'bien'}<span class="ok"><Check size={15} aria-hidden="true" /></span>{/if}
    <p>{#if l.resultado === 'bien' && p.tipo !== 'explorar'}<b>¡Bien! </b>{/if}{l.texto}</p>
  </div>
{/if}

<style>
  .leccion {
    flex: none;
    padding: 8px 12px 10px;
    border-bottom: 1px solid var(--linea);
    background: linear-gradient(var(--acento-tinte), var(--superficie));
    font-family: var(--sans);
  }
  .fila {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .progreso {
    display: flex;
    gap: 4px;
  }
  .punto {
    width: 16px;
    height: 6px;
    border-radius: 3px;
    background: var(--linea);
  }
  .punto.hecho {
    background: var(--c-ejemplo);
  }
  .punto.actual:not(.hecho) {
    background: var(--acento);
  }
  .cuenta {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    color: var(--tinta-suave);
    font-size: 12.5px;
    font-weight: 600;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .enlace {
    min-height: 44px;
    padding: 0 6px;
    border: 0;
    background: none;
    color: var(--tinta-suave);
    font: 600 14px var(--sans);
  }
  .salir {
    display: grid;
    flex: none;
    place-items: center;
    width: 44px;
    height: 44px;
    border: 0;
    border-radius: 10px;
    background: var(--hover);
    color: var(--tinta);
  }
  .ahora {
    margin: 4px 0 0;
    color: var(--tinta);
    font-size: 16px;
    font-weight: 700;
    line-height: 1.3;
  }
  .resumen {
    margin: 6px 0 0;
    font-size: 14.5px;
    line-height: 1.45;
  }
  .botones {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
  }
  .hueco {
    flex: 1;
  }
  .grande {
    min-height: 44px;
    padding: 0 18px;
    font-size: 15px;
  }
  .grande:disabled {
    opacity: 0.4;
  }
  .si,
  .no {
    min-width: 76px;
    justify-content: center;
  }
  .respuesta {
    position: absolute;
    left: 8px;
    right: 8px;
    bottom: 8px;
    z-index: 7;
    display: flex;
    align-items: center;
    gap: 10px;
    max-width: 680px;
    margin: 0 auto;
    padding: 10px 12px;
    border: 1px solid var(--linea);
    border-radius: 14px;
    background: var(--superficie);
    box-shadow: var(--sombra-alta);
    font-family: var(--sans);
  }
  .respuesta p {
    flex: 1;
    margin: 0;
    font-size: 14px;
    line-height: 1.4;
  }
  .respuesta.bien {
    border-color: color-mix(in srgb, var(--c-ejemplo) 45%, transparent);
    background: color-mix(in srgb, var(--c-ejemplo) 10%, var(--superficie));
  }
  .respuesta.mal {
    border-left: 5px solid var(--c-precaucion);
    background: color-mix(in srgb, var(--c-precaucion) 8%, var(--superficie));
    animation: sacude 0.35s ease-in-out;
  }
  @keyframes sacude {
    25% {
      transform: translateX(-4px);
    }
    75% {
      transform: translateX(4px);
    }
  }
  .ok {
    display: grid;
    flex: none;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--c-ejemplo);
    color: #fff;
  }
  @media (prefers-reduced-motion: reduce) {
    .respuesta.mal {
      animation: none;
    }
  }
  @media (max-width: 520px) {
    .ahora {
      font-size: 15px;
    }
  }
</style>
