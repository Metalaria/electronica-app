<script lang="ts">
  // 1.1 lessons: the options of a prediction or a question (the mock-up's big buttons). One choice at a time
  // (aria-pressed); after «Comprobar» the chosen one turns green or orange and a wrong one stays marked («ya probada»)
  // and cannot be chosen again. Keys 1–5 or A–E choose too (Leccion11.svelte).
  import type { Opcion } from '../../lib/leccion11/tipos';
  import TextoVivo from './TextoVivo.svelte';

  let {
    opciones,
    eleccion,
    descartadas,
    comprobado,
    bien,
    resuelta,
    valor,
    elegir,
  }: {
    opciones: Opcion[];
    eleccion: number | null;
    descartadas: number[];
    comprobado: boolean;
    bien: boolean | null;
    resuelta: boolean;
    valor: (id: string) => string;
    elegir: (k: number) => void;
  } = $props();
  const LETRAS = 'ABCDE';
</script>

<div class="opciones" role="group" aria-label="Opciones">
  {#each opciones as o, k (k)}
    {@const elegida = eleccion === k}
    {@const probada = descartadas.includes(k)}
    {@const estado = comprobado && elegida ? (bien ? 'bien' : 'mal') : resuelta && o.bien ? 'bien' : probada ? 'probada' : elegida ? 'elegida' : ''}
    <button
      type="button"
      class={`opcion ${estado}`}
      aria-pressed={elegida}
      aria-disabled={comprobado || resuelta || probada}
      data-opcion={k}
      data-correcta={o.bien ? 'si' : undefined}
      onclick={() => !(comprobado || resuelta || probada) && elegir(k)}
    >
      <span class="letra" aria-hidden="true">{LETRAS[k]}</span>
      <span class="txt"><TextoVivo texto={o.texto} {valor} />{#if probada && !(comprobado && elegida)}<span class="solo-lector"> (ya probada: no es esta)</span>{/if}</span>
    </button>
  {/each}
</div>

<style>
  .opciones {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .opcion {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 52px;
    padding: 10px 14px;
    border: 2px solid var(--v11-borde);
    border-radius: var(--v11-radio-opcion);
    background: var(--v11-fondo);
    color: var(--v11-tinta);
    font: 500 16px/1.35 var(--v11-texto);
    text-align: left;
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s;
  }
  .opcion[aria-disabled='true'] {
    cursor: default;
  }
  .letra {
    flex: none;
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border: 1.5px solid var(--v11-borde);
    border-radius: 8px;
    color: var(--v11-tinta-suave);
    font-size: 13px;
    font-weight: 700;
  }
  .elegida {
    border-color: var(--v11-azul);
    background: var(--v11-azul-tinte);
  }
  .bien {
    border-color: var(--v11-bien);
    background: var(--v11-bien-tinte);
  }
  .mal,
  .probada {
    border-color: var(--v11-mal);
    background: var(--v11-mal-tinte);
  }
  .elegida .letra,
  .bien .letra,
  .mal .letra,
  .probada .letra {
    color: var(--v11-tinta);
  }
  .probada .txt {
    text-decoration: line-through;
  }
  .opcion:focus-visible {
    outline: 3px solid var(--v11-foco);
    outline-offset: 2px;
  }
  .solo-lector {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  @media (prefers-reduced-motion: reduce) {
    .opcion {
      transition: none;
    }
  }
</style>
