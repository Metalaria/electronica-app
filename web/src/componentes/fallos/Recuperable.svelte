<script lang="ts" module>
  import { getContext } from 'svelte';
  import type { TipoFallo } from '../../lib/informe-fallos';

  const CLAVE = Symbol('recuperable');

  export interface ZonaRecuperable {
    /** Declares a failure the zone cannot recover from by itself (a lost WebGL context, an engine that died). */
    fallar(motivo: string, error?: unknown, tipo?: TipoFallo): void;
  }

  /** The nearest recoverable zone around a component (null outside one). */
  export function zonaRecuperable(): ZonaRecuperable | null {
    try {
      return getContext<ZonaRecuperable | undefined>(CLAVE) ?? null;
    } catch {
      return null;
    }
  }
</script>

<script lang="ts">
  // 1.0: an error boundary with a Spanish fallback and «Reintentar». A component inside that throws while it renders or
  // in an effect (a figure, a 3D board, a simulation's results, a whole page) shows this box instead of breaking the
  // page around it; «Reintentar» builds its content again from scratch. A child can also declare a failure it cannot
  // recover from by itself (`zonaRecuperable()?.fallar(…)`: a lost WebGL context). Each failure goes to the local
  // «Informe de fallos» (lib/informe-fallos.ts). `clave`: when it changes (another route), a failed zone tries again.
  import { setContext, untrack, type Snippet } from 'svelte';
  import { describir, informarFallo } from '../../lib/informe-fallos';

  let {
    zona,
    children,
    clave = '',
    grande = false,
  }: { zona: string; children: Snippet; clave?: string; grande?: boolean } = $props();

  let intento = $state(0);
  let declarado = $state<{ motivo: string } | null>(null);
  let reponer: (() => void) | null = null;

  setContext<ZonaRecuperable>(CLAVE, {
    fallar(motivo, error, tipo = 'componente') {
      informarFallo(tipo, error ?? motivo, { zona });
      declarado = { motivo };
    },
  });

  function reintentar(): void {
    declarado = null;
    const r = reponer;
    reponer = null;
    intento++;
    r?.();
  }

  // another route: a failed zone builds its content again
  $effect(() => {
    void clave;
    untrack(() => {
      if (declarado || reponer) reintentar();
    });
  });

  const detalle = (e: unknown) => describir(e).m;

  // Tests: `window.__epaFalloPrueba = '<zona>'` makes the next render of that zone throw (once), as a broken component
  // would — the fallback, the report entry and «Reintentar» are tested on the real build.
  function falloDePrueba(): string {
    const g = globalThis as { __epaFalloPrueba?: string };
    if (g.__epaFalloPrueba !== zona) return '';
    delete g.__epaFalloPrueba;
    throw new Error(`fallo de prueba en ${zona}`);
  }
</script>

{#snippet caja(texto: string)}
  <div class="fallo-zona" class:grande role="alert" data-fallo-zona={zona}>
    <p class="tit">No se ha podido mostrar {zona}.</p>
    <p>{grande ? 'Puede reintentarlo o ir a otra pantalla.' : 'El resto de la página sigue funcionando.'} {texto}</p>
    <div class="botones">
      <button type="button" class="boton primario" onclick={reintentar} data-reintentar-zona>Reintentar</button>
      <a class="boton" href="#/diagnostico/informe">Ver el informe</a>
    </div>
  </div>
{/snippet}

{#if declarado}
  {@render caja(declarado.motivo)}
{:else}
  <svelte:boundary
    onerror={(e, reset) => {
      reponer = reset;
      informarFallo('componente', e, { zona });
    }}
  >
    {#key intento}
      {falloDePrueba()}
      {@render children()}
    {/key}
    {#snippet failed(e)}
      {@render caja(`Detalle: ${detalle(e)}`)}
    {/snippet}
  </svelte:boundary>
{/if}

<style>
  .fallo-zona {
    max-width: 40em;
    margin: 16px auto;
    padding: 14px 18px;
    border: 1px solid var(--linea);
    border-radius: 10px;
    background: var(--superficie);
    color: var(--tinta);
    font-family: var(--sans);
  }
  .fallo-zona.grande {
    margin: 14vh auto;
  }
  .tit {
    margin: 0 0 4px;
    font-weight: 700;
    color: var(--titulos);
  }
  p {
    margin: 0 0 10px;
    overflow-wrap: anywhere;
  }
  .botones {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .boton {
    min-height: 44px;
  }
</style>
