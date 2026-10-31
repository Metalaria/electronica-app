<script lang="ts">
  // Mastery of a chapter or a course (0.11, group B): one bar split by the number of its sections at each level
  // (dominado, competente, familiarizado, intentado, sin practicar) and a line of text with the counts.
  import { NOMBRE_NIVEL_DOMINIO, porcentaje, type Agregado, type NivelDominio } from '../../lib/aprendizaje/dominio';

  let { a, resumen = true }: { a: Agregado; resumen?: boolean } = $props();

  const ORDEN: Exclude<NivelDominio, 'nuevo'>[] = ['dominado', 'competente', 'familiarizado', 'intentado'];
  const COLOR: Record<Exclude<NivelDominio, 'nuevo'>, string> = {
    dominado: 'var(--dominio-4)',
    competente: 'var(--dominio-3)',
    familiarizado: 'var(--dominio-2)',
    intentado: 'var(--dominio-1)',
  };
  const texto = $derived.by(() => {
    if (!a.total) return '';
    if (!a.practicados) return `${a.total} ${a.total === 1 ? 'sección' : 'secciones'} sin practicar`;
    const partes = ORDEN.filter((n) => a.cuenta[n]).map((n) => `${a.cuenta[n]} ${NOMBRE_NIVEL_DOMINIO[n].toLowerCase()}${a.cuenta[n] === 1 ? '' : 's'}`);
    return `${partes.join(', ')} de ${a.total}${a.repasar ? ` · ${a.repasar} para repasar` : ''}`;
  });
</script>

{#if a.total}
  <div class="barra-dominio" data-dominio-valor={a.valor.toFixed(3)} data-practicados={a.practicados} data-total={a.total}>
    <span class="barra" role="img" aria-label={`Dominio ${porcentaje(a.valor)}: ${texto}`}>
      {#each ORDEN as n (n)}
        {#if a.cuenta[n]}<i style:flex-grow={a.cuenta[n]} style:background={COLOR[n]}></i>{/if}
      {/each}
      {#if a.cuenta.nuevo}<i class="vacio" style:flex-grow={a.cuenta.nuevo}></i>{/if}
    </span>
    {#if resumen}<span class="txt">{texto}</span>{/if}
  </div>
{/if}

<style>
  .barra-dominio {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    font-family: var(--sans);
  }
  .barra {
    display: flex;
    gap: 2px;
    height: 8px;
    overflow: hidden;
    border-radius: 4px;
  }
  .barra i {
    display: block;
    flex-basis: 0;
    min-width: 3px;
    height: 100%;
  }
  .barra i.vacio {
    background: var(--dominio-0);
  }
  .txt {
    color: var(--tinta-suave);
    font-size: 13.5px;
    line-height: 1.35;
  }
</style>
