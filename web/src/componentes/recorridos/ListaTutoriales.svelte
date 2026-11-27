<script lang="ts">
  // 2.2: «Recorrido y tutoriales» in the Guía de uso (#/guia/recorridos, mock-up ListaTutoriales): the app's tour and
  // each tool's tutorial, with how many steps and a tick once seen on this device; a row starts it (going to the page
  // where it runs). Under them, the switch «Ofrecer el tutorial la primera vez que abro una herramienta».
  import { RECORRIDOS, TUTORIALES } from '../../lib/recorridos-pasos';
  import { empezarRecorrido, marcas, ofrecerTutoriales, ponerOfrecerTutoriales, type IdRecorrido } from '../../lib/recorridos.svelte';
  import Icono from '../Icono.svelte';

  const ofrecer = $derived.by(() => {
    void marcas.ofrecer;
    return ofrecerTutoriales();
  });

  function sub(id: IdRecorrido): string {
    const n = RECORRIDOS[id].pasos.length;
    return `${n} pasos${marcas.v[id] === 2 ? ' · visto' : ''}`;
  }
</script>

{#snippet fila(id: IdRecorrido, principal: boolean)}
  {@const r = RECORRIDOS[id]}
  {@const visto = marcas.v[id] === 2}
  <li>
    <button type="button" class="fila21" class:principal onclick={() => empezarRecorrido(id)} data-empezar-recorrido={id} data-visto={visto ? '1' : undefined}>
      <span class="fila21-texto">
        <span class="fila21-titulo">{r.nombre}</span>
        <span class="fila21-sub">{sub(id)}</span>
      </span>
      <span class="fila21-fin" class:visto>
        {#if visto}<span class="tic" role="img" aria-label="Visto"><Icono nombre="hecho" tam={20} grosor={2.2} /></span>{:else}<Icono nombre="chevron" tam={20} />{/if}
      </span>
    </button>
  </li>
{/snippet}

<section class="lista-tutoriales" aria-labelledby="h-recorridos" data-lista-tutoriales>
  <ul class="filas21">
    {@render fila('app', true)}
  </ul>
  <h2 class="etiqueta21" id="h-herramientas">Herramientas</h2>
  <ul class="filas21" aria-labelledby="h-herramientas">
    {#each TUTORIALES as id (id)}{@render fila(id, false)}{/each}
  </ul>
  <label class="interruptor">
    <span>Ofrecer el tutorial la primera vez que abro una herramienta</span>
    <input type="checkbox" role="switch" checked={ofrecer} onchange={(e) => ponerOfrecerTutoriales(e.currentTarget.checked)} data-ofrecer-tutoriales />
  </label>
  <p class="nota21">Solo usan los aparatos simulados de la aplicación; nada se envía al Brymen ni al FNIRSI de verdad.</p>
</section>

<style>
  .lista-tutoriales {
    display: flex;
    flex-direction: column;
    gap: var(--e21-1);
    max-width: 640px;
    font-family: var(--sans);
  }
  .etiqueta21 {
    margin: var(--e21-2) 0 0;
  }
  .principal :global(.fila21-titulo) {
    font-weight: 600;
  }
  .principal {
    min-height: 72px;
  }
  .fila21 {
    min-height: 64px;
    width: 100%;
    text-align: left;
  }
  .tic {
    display: inline-flex;
    color: var(--v11-bien-texto, var(--v11-bien));
  }
  .interruptor {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 64px;
    margin-top: var(--e21-1);
    font-size: 15px;
    line-height: 1.4;
    cursor: pointer;
  }
  .interruptor span {
    flex-grow: 1;
  }
  .interruptor input {
    flex-shrink: 0;
    width: 48px;
    height: 28px;
    margin: 0;
    accent-color: var(--a21);
    cursor: pointer;
  }
  .nota21 {
    margin: 0;
  }
</style>
