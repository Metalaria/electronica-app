<script lang="ts">
  // Card of the selected part: designator, value, its function in the receiver (from the book's chapter), the
  // section that explains it, its block, its component animation, and its simulated DC voltages and current.
  import PlayCircle from '@lucide/svelte/icons/circle-play';
  import X from '@lucide/svelte/icons/x';
  import { rutaDeRef } from '../../lib/datos';
  import { prepararSalto } from '../../lib/ruta.svelte';
  import { animacion } from '../animaciones/catalogo';
  import { disponible } from '../animaciones/cargadores';
  import type { EstadoKit } from './estado.svelte';
  import { nombreNodo } from './estado.svelte';
  import { si } from './formato';
  import Modelado from './ui/Modelado.svelte';

  let { k, ref }: { k: EstadoKit; ref: string } = $props();

  const ficha = $derived(k.kit.componentes[ref]);
  const el = $derived(k.kit.esquema.elementos.find((e) => e.designador === ref));
  const bloque = $derived(ficha ? k.kit.bloques[String(ficha.bloque)] : undefined);
  const anim = $derived(ficha?.animacion && disponible(ficha.animacion) ? animacion(ficha.animacion) : null);
  const med = $derived(el && k.dc ? k.est.medidas(el.id) : null);
  const terminales = $derived(
    el
      ? Object.entries(el.terminales ?? {}).map(([t, n]) => ({
          t,
          nodo: n,
          v: k.tension(n),
          i: med?.terminales[t] ?? null,
        }))
      : [],
  );
  const nombreT = (t: string) =>
    ({ start: '1', end: '2', tap: 'cursor', base: 'base', collector: 'colector', emitter: 'emisor', com: 'común', a: 'ON', b: 'OFF', pos: '+', neg: '−' })[t] ??
    t.replace(/^p(\d+)$/, 'patilla $1');

  function volver() {
    prepararSalto({ texto: 'Volver al kit FM7303' });
  }
</script>

{#if ficha && el}
  <article class="ficha-pieza" data-pieza={ref}>
    <header>
      <h3>{ref}{#if ficha.valor}<span class="valor"> · {ficha.valor}</span>{/if}</h3>
      <button type="button" class="cerrar" aria-label="Cerrar la ficha" onclick={() => k.elegirPieza(null)}><X size={18} /></button>
    </header>
    <p class="funcion">{ficha.funcion}</p>
    <div class="enlaces">
      <a class="libro" href={rutaDeRef(ficha.seccion) ?? undefined} onclick={volver}>Sección {ficha.num} del libro</a>
      {#if bloque}
        <button type="button" class="bloque" style:--c={bloque.color} onclick={() => k.enfocarBloque(ficha.bloque)}>Bloque {ficha.bloque}: {bloque.nombre}</button>
      {/if}
      {#if anim}
        <a class="anim" href={`#/componentes/${anim.id}`} onclick={volver}><PlayCircle size={15} /> {anim.titulo}</a>
      {/if}
    </div>
    {#if terminales.length}
      <table>
        <caption>Continua simulada <Modelado texto="modelo" /></caption>
        <thead><tr><th>Terminal</th><th>Nudo</th><th>Tensión</th><th>Corriente</th></tr></thead>
        <tbody>
          {#each terminales as t (t.t)}
            <tr>
              <td>{nombreT(t.t)}</td>
              <td class="nudo">{nombreNodo(k, t.nodo)}</td>
              <td>{t.v == null ? '—' : si(t.v, 'V', 3)}</td>
              <td>{t.i == null ? '—' : si(Math.abs(t.i) < 1e-12 ? 0 : t.i, 'A', 3)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </article>
{/if}

<style>
  .ficha-pieza {
    padding: 10px 12px;
    border: 1px solid var(--linea);
    border-radius: 12px;
    background: var(--superficie);
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  h3 {
    margin: 0;
    font-size: 17px;
    color: var(--titulos);
  }
  .valor {
    font-weight: 500;
    color: var(--tinta-suave);
  }
  .cerrar {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border: 0;
    border-radius: 8px;
    background: none;
    color: var(--tinta-suave);
    cursor: pointer;
  }
  .funcion {
    margin: 6px 0 8px;
    font-size: 14px;
    line-height: 1.45;
  }
  .enlaces {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .enlaces a,
  .bloque {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-height: 34px;
    padding: 0 10px;
    border: 1px solid var(--acento-borde);
    border-radius: 999px;
    background: var(--acento-tinte);
    color: var(--acento);
    font: 600 12.5px var(--sans);
    text-decoration: none;
    cursor: pointer;
  }
  .bloque {
    border-color: var(--c);
    background: color-mix(in srgb, var(--c) 10%, var(--superficie));
    color: var(--tinta);
  }
  table {
    width: 100%;
    margin-top: 10px;
    border-collapse: collapse;
    font-size: 12.5px;
    font-variant-numeric: tabular-nums;
  }
  caption {
    text-align: left;
    font-weight: 600;
    margin-bottom: 4px;
    font-size: 12.5px;
  }
  th,
  td {
    padding: 3px 4px;
    border-bottom: 1px solid var(--linea-suave);
    text-align: left;
  }
  th {
    color: var(--tinta-suave);
    font-weight: 600;
  }
  .nudo {
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
