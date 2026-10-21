<script lang="ts">
  // Renders a list of content blocks (recursive for boxes, derivations, cards and exercises).
  import type { Bloque } from '../lib/tipos';
  import { prepararHtml } from '../lib/datos';
  import Bloques from './Bloques.svelte';
  import Seccion from './Seccion.svelte';
  import Ecuacion from './Ecuacion.svelte';
  import Figura from './Figura.svelte';
  import Tabla from './Tabla.svelte';
  import Ejercicios from './Ejercicios.svelte';

  let {
    bloques,
    parte,
    raiz = false,
    desde = 0,
  }: { bloques: Bloque[]; parte: string; raiz?: boolean; desde?: number } = $props();

  const CAJAS: Record<string, { ic: string; nombre: string } | null> = {
    nota: { ic: 'ℹ', nombre: 'NOTA' },
    importante: { ic: '★', nombre: 'IMPORTANTE' },
    precaucion: { ic: '⚠', nombre: 'PRECAUCIÓN' },
    ejemplo: { ic: '▸', nombre: 'EJEMPLO' },
    comprobacion: null,
  };
</script>

{#each bloques as b, i (i)}
  {@const id = b.label || undefined}
  {@const db = raiz ? desde + i : undefined}
  {#if b.t === 'p'}
    <p {id} data-b={db}>{@html prepararHtml(b.html)}</p>
  {:else if b.t === 'h2'}
    <Seccion bloque={b} {parte} indice={db} />
  {:else if b.t === 'h3'}
    <h3 {id} data-b={db}>{#if b.num}<span class="num">{b.num}</span>{/if}{@html prepararHtml(b.html)}</h3>
  {:else if b.t === 'h4'}
    <h4 {id} data-b={db}>{@html prepararHtml(b.html)}</h4>
  {:else if b.t === 'lista'}
    {#if b.ordenada}
      <ol {id} data-b={db} start={b.inicio ?? undefined} class:anidada={!!b.nivel} style:--nivel={b.nivel || undefined}>
        {#each b.items as it, k (k)}<li>{@html prepararHtml(it)}</li>{/each}
      </ol>
    {:else}
      <ul {id} data-b={db} class:anidada={!!b.nivel} style:--nivel={b.nivel || undefined}>
        {#each b.items as it, k (k)}<li>{@html prepararHtml(it)}</li>{/each}
      </ul>
    {/if}
  {:else if b.t === 'caja'}
    {@const c = CAJAS[b.tipo]}
    <aside {id} data-b={db} class="caja caja-{b.tipo}" aria-label={c ? c.nombre.toLowerCase() : 'comprobación'}>
      {#if c}<div class="caja-tit"><span class="ic" aria-hidden="true">{c.ic}</span>{c.nombre}</div>{/if}
      <div class="bloques"><Bloques bloques={b.bloques} {parte} /></div>
    </aside>
  {:else if b.t === 'deduccion'}
    <section {id} data-b={db} class="deduccion">
      <div class="deduccion-tit">Deducción <span class="guion">—</span> {@html prepararHtml(b.titulo)}</div>
      <Bloques bloques={b.bloques} {parte} />
    </section>
  {:else if b.t === 'tarjeta'}
    <section {id} data-b={db} class="tarjeta" aria-label="Tarjeta de fórmulas">
      <div class="tarjeta-tit">TARJETA DE FÓRMULAS</div>
      <Bloques bloques={b.bloques} {parte} />
    </section>
  {:else if b.t === 'ec'}
    <Ecuacion bloque={b} indice={db} />
  {:else if b.t === 'figura'}
    <Figura bloque={b} indice={db} />
  {:else if b.t === 'tabla'}
    <Tabla bloque={b} indice={db} />
  {:else if b.t === 'codigo'}
    <pre {id} data-b={db} class="codigo">{#if b.lenguaje}<span class="lenguaje">{b.lenguaje}</span>{/if}<code>{b.texto}</code></pre>
  {:else if b.t === 'centrado'}
    <div {id} data-b={db} class="centrado">{@html prepararHtml(b.html)}</div>
  {:else if b.t === 'ejercicios'}
    <Ejercicios bloque={b} {parte} indice={db} />
  {:else if b.t === 'glosario'}
    <dl {id} data-b={db} class="glosario-bloque">
      {#each b.entradas as e, k (k)}
        <dt>{@html prepararHtml(e.termino)}</dt>
        <dd>{@html prepararHtml(e.html)}</dd>
      {/each}
    </dl>
  {/if}
{/each}
