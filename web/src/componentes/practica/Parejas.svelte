<script lang="ts">
  // «Une las parejas»: glossary terms with their definitions (first sentence of the book's glossary entry),
  // or circuit symbols with their components. Tap a term (or symbol), then the card it goes with; a tap on a
  // paired card undoes it. A wrong set marks each card; the second attempt keeps the right pairs.
  import { onMount, untrack } from 'svelte';
  import Check from '@lucide/svelte/icons/check';
  import X from '@lucide/svelte/icons/x';
  import { prepararHtml } from '../../lib/datos';
  import type { ItemParejas } from './tipos';
  import type { Comprobacion } from './Practica.svelte';
  import { barajarCon, hash } from './azar';

  let { item, final, listo = $bindable(false) }: { item: ItemParejas; final: boolean; listo?: boolean } = $props();

  const n = untrack(() => item.pares.length);
  /** Order of the right-hand cards: indices into item.pares. */
  const orden = untrack(() => {
    // no card next to its own term (a derangement), so the order gives nothing away
    const base = Array.from({ length: n }, (_, k) => k);
    for (let i = 0; i < 60; i++) {
      const o = barajarCon(base, hash(item.id) + 17 + i * 7919);
      if (o.every((v, k) => v !== k)) return o;
    }
    return [...base.slice(1), 0];
  });
  /** card position → left index assigned */
  let asignado = $state<(number | null)[]>(Array.from({ length: n }, () => null));
  let activo = $state<number | null>(0);
  let revisado = $state(false);
  let simbolos = $state<Record<string, string>>({});

  onMount(() => {
    if (item.modo !== 'simbolo') return;
    void import('../glosario/simbolo').then((m) => {
      const r: Record<string, string> = {};
      for (const p of item.pares) if (p.simbolo && m.esClaveSimbolo(p.simbolo)) r[p.simbolo] = m.svgSimbolo(p.simbolo);
      simbolos = r;
    });
  });

  $effect(() => {
    listo = asignado.every((x) => x != null);
  });

  const COLORES = ['#2563eb', '#c2410c', '#15803d', '#7e22ce', '#b45309', '#0e7490'];

  function elegirIzq(i: number) {
    if (final) return;
    activo = i;
  }
  function elegirDer(pos: number) {
    if (final) return;
    revisado = false;
    if (activo == null) {
      if (asignado[pos] != null) asignado[pos] = null;
      return;
    }
    const prev = asignado.indexOf(activo);
    if (prev >= 0) asignado[prev] = null;
    asignado[pos] = activo;
    // next free term
    const libres = Array.from({ length: n }, (_, k) => k).filter((k) => !asignado.includes(k));
    activo = libres[0] ?? null;
  }

  export function comprobar(): Comprobacion {
    if (asignado.some((x) => x == null)) return { bien: false, nula: true, mensaje: 'Une todas las parejas.' };
    revisado = true;
    const bien = orden.every((k, pos) => asignado[pos] === k);
    const aciertos = orden.filter((k, pos) => asignado[pos] === k).length;
    return bien ? { bien: true } : { bien: false, mensaje: `${aciertos} de ${n} parejas están bien.` };
  }

  export function reintentar(): void {
    asignado = asignado.map((x, pos) => (x === orden[pos] ? x : null));
    revisado = false;
    activo = Array.from({ length: n }, (_, k) => k).find((k) => !asignado.includes(k)) ?? null;
  }

  const izqDe = (pos: number) => (final ? orden[pos]! : asignado[pos]);
</script>

{#snippet izquierda(i: number, peque: boolean)}
  {@const p = item.pares[i]!}
  <span class="ficha" class:peque style:--c={COLORES[i % COLORES.length]}>
    <span class="n">{i + 1}</span>
    {#if item.modo === 'simbolo'}
      <span class="sim" aria-label={`Símbolo ${i + 1}`}>{@html simbolos[p.simbolo ?? ''] ?? ''}</span>
    {:else}
      <span class="term">{@html prepararHtml(p.a)}</span>
    {/if}
  </span>
{/snippet}

<div class="parejas" data-modo={item.modo} data-asignado={asignado.map((x) => (x == null ? '-' : x)).join(',')}>
  <div class="izq" role="group" aria-label={item.modo === 'simbolo' ? 'Símbolos' : 'Términos'}>
    {#each item.pares as _, i (i)}
      <button type="button" class="elegible" class:activo={activo === i} class:usado={asignado.includes(i)} disabled={final} aria-pressed={activo === i} onclick={() => elegirIzq(i)} data-izq={i}>
        {@render izquierda(i, false)}
      </button>
    {/each}
  </div>
  <p class="ayuda">{final ? 'Las parejas del libro.' : activo != null ? `Ahora toca ${item.modo === 'simbolo' ? 'el componente' : 'la definición'} que va con el ${activo + 1}.` : 'Toca un elemento de arriba y después su pareja.'}</p>
  <ul class="der">
    {#each orden as k, pos (pos)}
      {@const i = izqDe(pos)}
      {@const marca = revisado && !final && asignado[pos] != null ? asignado[pos] === k : null}
      <li>
        <button type="button" class="p10-carta" class:bien={marca === true} class:mal={marca === false} class:fin={final} disabled={final} onclick={() => elegirDer(pos)} data-der={pos} data-pareja={k}>
          <span class="hueco">{#if i != null}{@render izquierda(i, true)}{:else}<span class="libre">?</span>{/if}</span>
          <span class="def">{@html prepararHtml(item.modo === 'simbolo' ? item.pares[k]!.b : item.pares[k]!.b)}</span>
          {#if marca === true}<span class="icono ok"><Check size={15} strokeWidth={3} /></span>{:else if marca === false}<span class="icono no"><X size={15} strokeWidth={3} /></span>{/if}
        </button>
      </li>
    {/each}
  </ul>
</div>

<style>
  .parejas {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .izq {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .elegible {
    min-height: 44px;
    padding: 4px;
    border: 2px solid var(--linea);
    border-radius: 14px;
    background: var(--superficie);
    color: var(--tinta);
  }
  .elegible.activo {
    border-color: var(--acento);
    box-shadow: 0 0 0 3px var(--acento-tinte);
  }
  .elegible.usado:not(.activo) {
    opacity: 0.55;
  }
  .ficha {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 2px 8px 2px 2px;
  }
  .n {
    display: grid;
    flex-shrink: 0;
    place-items: center;
    width: 26px;
    height: 26px;
    border-radius: 8px;
    background: var(--c);
    color: #fff;
    font-size: 14px;
    font-weight: 700;
  }
  .term {
    font-size: 15.5px;
    font-weight: 600;
    text-align: left;
  }
  .sim {
    display: inline-flex;
    width: 64px;
    height: 44px;
    align-items: center;
    justify-content: center;
    color: var(--tinta);
  }
  .sim :global(svg) {
    width: 100%;
    height: 100%;
  }
  .ficha.peque .sim {
    width: 44px;
    height: 30px;
  }
  .ficha.peque .term {
    font-size: 14px;
  }
  .ayuda {
    margin: 0;
    color: var(--tinta-suave);
    font-size: 14.5px;
  }
  .der {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .p10-carta {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-height: 56px;
    padding: 8px 12px 8px 8px;
    border: 2px solid var(--linea);
    border-radius: 14px;
    background: var(--superficie);
    color: var(--tinta);
    text-align: left;
  }
  .p10-carta:not(:disabled):hover {
    border-color: var(--acento-borde);
  }
  .p10-carta:disabled {
    cursor: default;
  }
  .hueco {
    flex-shrink: 0;
    min-width: 40px;
  }
  .libre {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border: 2px dashed var(--linea);
    border-radius: 8px;
    color: var(--tinta-suave);
    font-weight: 700;
  }
  .def {
    flex: 1;
    font-family: var(--serif);
    font-size: 15.5px;
    line-height: 1.4;
  }
  .p10-carta.bien,
  .p10-carta.fin {
    border-color: var(--ok);
    background: var(--ok-tinte);
  }
  .p10-carta.mal {
    border-color: var(--mal);
    background: var(--mal-tinte);
  }
  .icono {
    display: grid;
    flex-shrink: 0;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    color: var(--sobre-veredicto);
  }
  .icono.ok {
    background: var(--ok);
  }
  .icono.no {
    background: var(--mal);
  }
  @media (min-width: 560px) {
    .parejas[data-modo='definicion'] .hueco {
      width: 11.5em;
    }
  }
</style>
