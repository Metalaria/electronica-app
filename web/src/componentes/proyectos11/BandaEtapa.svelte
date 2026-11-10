<script lang="ts">
  // 1.1 «Proyectos por etapas»: the band the schematic editor shows over a stage's circuit (a saved circuit whose
  // `origen` is `{tipo: 'proyecto', id}`, componentes/proyectos11/circuito.ts): which stage it is and the way back to
  // check it. The editor saves every change by itself, so the stage page simulates the drawing as it was left.
  import Wrench from '@lucide/svelte/icons/wrench';
  import { INDICE_PROYECTOS } from '../../lib/proyectos11/indice';

  let { etapa }: { etapa: string } = $props();
  const quien = $derived.by(() => {
    for (const p of INDICE_PROYECTOS) {
      const e = p.etapas.find((x) => x.id === etapa);
      if (e) return { p, e };
    }
    return null;
  });
</script>

{#if quien}
  <div class="banda-etapa" role="note" data-banda-etapa={etapa}>
    <Wrench size={18} strokeWidth={2.2} aria-hidden="true" />
    <p>Etapa {quien.e.n} del proyecto «{quien.p.corto}»: {@html quien.e.titulo}. Cambie valores o piezas; los cambios se guardan solos.</p>
    <a href={`#/etapas/${quien.p.parte}/${quien.e.n}`} data-volver-etapa>Volver a la etapa y comprobar</a>
  </div>
{/if}

<style>
  .banda-etapa {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 12px;
    padding: 8px 14px;
    border: 1px solid var(--v11-linea);
    border-radius: var(--v11-radio-panel);
    background: var(--v11-azul-tinte);
    color: var(--v11-tinta);
    font: 14.5px/1.45 var(--v11-texto);
  }
  p {
    flex: 1 1 260px;
    margin: 0;
  }
  a {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    color: var(--v11-azul);
    font-weight: 700;
  }
  a:focus-visible {
    outline: 3px solid var(--v11-foco);
    outline-offset: 2px;
  }
</style>
