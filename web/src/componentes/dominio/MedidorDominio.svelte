<script lang="ts">
  // Mastery of one concept as four small segments (0.11, group B), as Khan Academy shows it: one lit per level
  // reached (intentado, familiarizado, competente, dominado), in the level's colour. The level is also given as
  // text (visible with `texto`, else to screen readers and in the tooltip), never by colour alone.
  import { NOMBRE_NIVEL_DOMINIO, NIVELES_DOMINIO, porcentaje, type NivelDominio } from '../../lib/aprendizaje/dominio';

  let {
    nivel,
    valor = 0,
    repasar = false,
    texto = false,
    tam = 'mini',
  }: {
    nivel: NivelDominio;
    valor?: number;
    repasar?: boolean;
    /** Show the level's name next to the segments. */
    texto?: boolean;
    tam?: 'mini' | 'normal';
  } = $props();

  const n = $derived(NIVELES_DOMINIO.indexOf(nivel));
  const etiqueta = $derived(
    nivel === 'nuevo' ? 'Sin practicar' : `Dominio: ${NOMBRE_NIVEL_DOMINIO[nivel].toLowerCase()} (${porcentaje(valor)})${repasar ? ', para repasar' : ''}`,
  );
</script>

<span class="medidor {tam}" data-nivel-dominio={nivel} data-valor={valor.toFixed(3)} title={etiqueta}>
  <span class="segs" aria-hidden="true">
    {#each [1, 2, 3, 4] as k (k)}<i class:on={k <= n} style:--c={`var(--dominio-${Math.min(4, Math.max(1, n))})`}></i>{/each}
  </span>
  {#if texto}
    <span class="txt">{NOMBRE_NIVEL_DOMINIO[nivel]}{#if repasar}<span class="rep"> · para repasar</span>{/if}</span>
  {:else}
    <span class="solo-lector">{etiqueta}</span>
  {/if}
</span>

<style>
  .medidor {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: 6px;
    font-family: var(--sans);
  }
  .segs {
    display: inline-flex;
    gap: 2px;
  }
  .segs i {
    display: block;
    width: 5px;
    height: 10px;
    border-radius: 1.5px;
    background: var(--dominio-0);
  }
  .segs i.on {
    background: var(--c);
  }
  .normal .segs {
    gap: 3px;
  }
  .normal .segs i {
    width: 9px;
    height: 14px;
    border-radius: 2.5px;
  }
  .txt {
    color: var(--tinta-suave);
    font-size: 13.5px;
    font-weight: 600;
    white-space: nowrap;
  }
  .rep {
    color: color-mix(in srgb, var(--ambar) 80%, var(--tinta));
    font-weight: 600;
  }
</style>
