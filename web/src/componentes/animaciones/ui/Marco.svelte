<script lang="ts">
  // Layout of one animation: scene, legend and live plot on the left; playback, explanation, controls and
  // readouts on the right. On narrow screens everything stacks in reading order.
  import type { Snippet } from 'svelte';
  import type { Reloj } from '../nucleo/reloj.svelte';
  import Reproduccion from './Reproduccion.svelte';
  import Leyenda, { type ElementoLeyenda } from './Leyenda.svelte';
  import Rico from './Rico.svelte';

  export interface Lectura {
    e: string;
    v: string;
    c?: string;
  }

  let {
    reloj,
    escena,
    grafica,
    controles,
    texto,
    lecturas = [],
    leyenda = [],
    reiniciar = true,
    modos,
  }: {
    reloj: Reloj;
    escena: Snippet;
    grafica?: Snippet;
    controles?: Snippet;
    /** Two or three short sentences that describe the current state. */
    texto: string;
    lecturas?: Lectura[];
    leyenda?: ElementoLeyenda[];
    reiniciar?: boolean;
    /** Mode tabs shown above the scene. */
    modos?: Snippet;
  } = $props();

  const frases = $derived(texto.split(/\n+/).filter(Boolean));
</script>

<div class="contenedor">
  <div class="marco">
    <div class="col-a">
      {#if modos}<div class="modos">{@render modos()}</div>{/if}
      <div class="escena">{@render escena()}</div>
      {#if leyenda.length}<div class="leyenda"><Leyenda elementos={leyenda} /></div>{/if}
      {#if grafica}<div class="grafica">{@render grafica()}</div>{/if}
    </div>
    <div class="col-b">
      <div class="mando">
        <Reproduccion {reloj} {reiniciar} />
      </div>
      <div class="texto">
        {#each frases as f, i (i)}<p><Rico texto={f} /></p>{/each}
      </div>
      {#if controles}<div class="controles">{@render controles()}</div>{/if}
      {#if lecturas.length}
        <dl class="lecturas">
          {#each lecturas as l (l.e)}
            <div style:--c={l.c}>
              <dt><Rico texto={l.e} /></dt>
              <dd>{l.v}</dd>
            </div>
          {/each}
        </dl>
      {/if}
    </div>
  </div>
</div>

<style>
  .contenedor {
    container-type: inline-size;
  }
  .marco {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .col-a,
  .col-b {
    display: contents;
  }
  .modos {
    order: 0;
  }
  .escena {
    order: 1;
  }
  .leyenda {
    order: 2;
  }
  .mando {
    order: 3;
  }
  .controles {
    order: 4;
  }
  .texto {
    order: 5;
  }
  .lecturas {
    order: 6;
  }
  .grafica {
    order: 7;
  }

  .mando {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .texto {
    padding: 12px 14px;
    border-left: 3px solid var(--acento);
    border-radius: 0 10px 10px 0;
    background: var(--acento-tinte);
    font-family: var(--serif);
    font-size: 16px;
    line-height: 1.5;
  }
  .texto p {
    margin: 0;
  }
  .texto p + p {
    margin-top: 0.45em;
  }
  .controles {
    display: grid;
    gap: 14px;
    padding: 14px;
    border-radius: 14px;
    background: var(--superficie);
    box-shadow: 0 0 0 1px var(--linea-suave);
  }
  .lecturas {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
    gap: 8px;
    margin: 0;
  }
  .lecturas div {
    --c: var(--tinta);
    padding: 8px 10px;
    border-radius: 10px;
    background: var(--superficie-2);
    border: 1px solid var(--linea-suave);
  }
  .lecturas dt {
    font-size: 12.5px;
    color: var(--tinta-suave);
  }
  .lecturas dd {
    margin: 1px 0 0;
    font-size: 17px;
    font-weight: 700;
    color: var(--c);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  @container (min-width: 860px) {
    .marco {
      display: grid;
      grid-template-columns: minmax(0, 1.65fr) minmax(300px, 1fr);
      align-items: start;
      gap: 22px;
    }
    .col-a,
    .col-b {
      display: flex;
      flex-direction: column;
      gap: 14px;
      min-width: 0;
    }
    .col-b {
      position: sticky;
      top: calc(var(--alto-barra) + 12px);
    }
    .mando {
      order: 0;
    }
    .texto {
      order: 1;
    }
    .controles {
      order: 2;
    }
    .lecturas {
      order: 3;
    }
  }
</style>
