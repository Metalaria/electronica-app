<script lang="ts">
  import type { BEjercicios } from '../lib/tipos';
  import Bloques from './Bloques.svelte';
  import Icono from './Icono.svelte';

  let { bloque, parte, indice }: { bloque: BEjercicios; parte: string; indice?: number } = $props();

  let abiertas = $state<Record<number, boolean>>({});
  const conSolucion = $derived(bloque.items.map((it, k) => (it.solucion?.length ? k : -1)).filter((k) => k >= 0));
  const todas = $derived(conSolucion.length > 0 && conSolucion.every((k) => abiertas[k]));

  function alternarTodas() {
    const valor = !todas;
    for (const k of conSolucion) abiertas[k] = valor;
  }
</script>

<section class="ejercicios" id={bloque.label || undefined} data-b={indice}>
  <div class="ejercicios-cab">
    <span class="tit">✎ EJERCICIOS PROPUESTOS</span>
    {#if conSolucion.length > 1}
      <button onclick={alternarTodas}>{todas ? 'Ocultar soluciones' : 'Ver todas las soluciones'}</button>
    {/if}
  </div>
  {#each bloque.items as it, k (it.label ?? k)}
    <div class="ejercicio" id={it.label || undefined}>
      <div class="bloques">
        <span class="ejercicio-num">Ejercicio {it.num}.</span>
        <Bloques bloques={it.bloques} {parte} />
      </div>
      {#if it.solucion?.length}
        <button class="ver-solucion" aria-expanded={!!abiertas[k]} onclick={() => (abiertas[k] = !abiertas[k])}>
          <Icono nombre={abiertas[k] ? 'ocultar' : 'ver'} tam={16} />
          {abiertas[k] ? 'Ocultar solución' : 'Ver solución'}
        </button>
        {#if abiertas[k]}
          <div class="solucion">
            <span class="solucion-tit">Solución {it.num}.</span>
            <div class="sol-cuerpo"><Bloques bloques={it.solucion} {parte} /></div>
          </div>
        {/if}
      {:else}
        <span class="sin-solucion">Sin solución en el libro.</span>
      {/if}
    </div>
  {/each}
</section>
