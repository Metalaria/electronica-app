<script lang="ts">
  // «Ordena los pasos»: a numbered list of the book (a procedure) shuffled; the reader taps the steps in
  // order (a tap on a placed step takes it back). A wrong order marks each position; the second attempt
  // keeps the steps that were already right from the start.
  import { untrack } from 'svelte';
  import Check from '@lucide/svelte/icons/check';
  import X from '@lucide/svelte/icons/x';
  import { prepararHtml } from '../../lib/datos';
  import type { ItemOrdenar } from './tipos';
  import type { Comprobacion } from './Practica.svelte';
  import { desorden, hash } from './azar';

  let { item, final, listo = $bindable(false) }: { item: ItemOrdenar; final: boolean; listo?: boolean } = $props();

  const n = untrack(() => item.pasos.length);
  const barajado = untrack(() => desorden(n, hash(item.id)));
  let colocados = $state<number[]>([]);
  let revisado = $state(false);

  const pendientes = $derived(barajado.filter((k) => !colocados.includes(k)));
  $effect(() => {
    listo = colocados.length === n;
  });

  function poner(k: number) {
    if (final) return;
    revisado = false;
    colocados = [...colocados, k];
  }
  function quitar(pos: number) {
    if (final) return;
    revisado = false;
    colocados = colocados.slice(0, pos).concat(colocados.slice(pos + 1));
  }

  export function comprobar(): Comprobacion {
    if (colocados.length < n) return { bien: false, nula: true, mensaje: 'Coloca todos los pasos.' };
    revisado = true;
    const bien = colocados.every((k, i) => k === i);
    const aciertos = colocados.filter((k, i) => k === i).length;
    return bien ? { bien: true } : { bien: false, mensaje: `${aciertos} de ${n} pasos están en su sitio.` };
  }

  export function reintentar(): void {
    let i = 0;
    while (i < colocados.length && colocados[i] === i) i++;
    colocados = colocados.slice(0, i);
    revisado = false;
  }

  const mostrar = $derived(final ? Array.from({ length: n }, (_, k) => k) : colocados);
</script>

<div class="ordenar" data-orden={colocados.join(',')}>
  <ol class="colocados" aria-label="Tu orden">
    {#each Array.from({ length: n }, (_, i) => i) as i (i)}
      {@const k = mostrar[i]}
      {@const marca = revisado && !final && colocados[i] != null ? colocados[i] === i : null}
      <li class="hueco" class:lleno={k != null} class:bien={marca === true} class:mal={marca === false}>
        <span class="num">{i + 1}</span>
        {#if k != null}
          <button type="button" class="paso" onclick={() => quitar(i)} disabled={final} data-colocado={k}>
            <span class="txt">{@html prepararHtml(item.pasos[k])}</span>
            {#if marca === true}<span class="icono ok" aria-label="En su sitio"><Check size={16} strokeWidth={3} /></span>{:else if marca === false}<span class="icono no" aria-label="Fuera de sitio"><X size={16} strokeWidth={3} /></span>{/if}
          </button>
        {:else}
          <span class="vacio">Toca un paso de abajo</span>
        {/if}
      </li>
    {/each}
  </ol>
  {#if !final && pendientes.length}
    <p class="rot">Pasos por colocar</p>
    <ul class="pendientes">
      {#each pendientes as k (k)}
        <li><button type="button" class="paso suelto" onclick={() => poner(k)} data-pendiente={k}>{@html prepararHtml(item.pasos[k])}</button></li>
      {/each}
    </ul>
  {/if}
  {#if final}<p class="nota">Este es el orden del libro.</p>{/if}
</div>

<style>
  .ordenar {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  ol,
  ul {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .hueco {
    display: flex;
    align-items: stretch;
    gap: 10px;
  }
  .num {
    display: grid;
    flex-shrink: 0;
    place-items: center;
    width: 32px;
    border-radius: 10px;
    background: var(--superficie-2);
    color: var(--tinta);
    font-weight: 700;
  }
  .vacio {
    display: flex;
    flex: 1;
    align-items: center;
    min-height: 48px;
    padding: 0 14px;
    border: 2px dashed var(--linea);
    border-radius: 12px;
    color: var(--tinta-suave);
    font-size: 14px;
  }
  .paso {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 10px;
    min-height: 48px;
    padding: 10px 14px;
    border: 2px solid var(--linea);
    border-radius: 12px;
    background: var(--superficie);
    color: var(--tinta);
    font-family: var(--serif);
    font-size: 16px;
    line-height: 1.4;
    text-align: left;
  }
  .paso:not(:disabled):hover {
    border-color: var(--acento-borde);
    background: var(--acento-tinte);
  }
  .paso:disabled {
    cursor: default;
  }
  .suelto {
    width: 100%;
    border-style: solid;
    box-shadow: var(--sombra);
  }
  .txt {
    flex: 1;
  }
  .hueco.bien .paso {
    border-color: var(--ok);
    background: var(--ok-tinte);
  }
  .hueco.mal .paso {
    border-color: var(--mal);
    background: var(--mal-tinte);
  }
  .icono {
    display: grid;
    flex-shrink: 0;
    place-items: center;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    color: var(--sobre-veredicto);
  }
  .icono.ok {
    background: var(--ok);
  }
  .icono.no {
    background: var(--mal);
  }
  .rot {
    margin: 6px 0 0;
    color: var(--tinta-suave);
    font-size: 12.5px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .nota {
    margin: 0;
    color: var(--tinta-suave);
    font-size: 14.5px;
  }
</style>
