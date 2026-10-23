<script lang="ts">
  // «Ejercicios propuestos» block: statement, the answer panel (Comprobador: fields, hints, solution,
  // saved attempts) and the book's solution. Without ejercicios.json (sample content) the panel falls
  // back to the plain «Ver solución» button.
  import { onMount } from 'svelte';
  import type { BEjercicios } from '../lib/tipos';
  import { cargarEjercicios, item } from '../lib/ejercicios.svelte';
  import { aprendizaje, cargarAprendizaje, estadoDe } from '../lib/aprendizaje.svelte';
  import Bloques from './Bloques.svelte';
  import Icono from './Icono.svelte';
  import BotonSimular from './BotonSimular.svelte';
  import Comprobador from './aprender/Comprobador.svelte';

  let { bloque, parte, indice }: { bloque: BEjercicios; parte: string; indice?: number } = $props();

  let abiertas = $state<Record<number, boolean>>({});
  const conSolucion = $derived(bloque.items.map((it, k) => (it.solucion?.length ? k : -1)).filter((k) => k >= 0));
  const todas = $derived(conSolucion.length > 0 && conSolucion.every((k) => abiertas[k]));
  const resueltos = $derived(
    aprendizaje.listo ? bloque.items.filter((it) => it.label && estadoDe(it.label) === 'resuelto').length : 0,
  );

  function alternarTodas() {
    const valor = !todas;
    for (const k of conSolucion) abiertas[k] = valor;
  }

  onMount(() => {
    void cargarEjercicios();
    void cargarAprendizaje();
  });
</script>

<section class="ejercicios" id={bloque.label || undefined} data-b={indice}>
  <div class="ejercicios-cab">
    <span class="tit">✎ EJERCICIOS PROPUESTOS</span>
    {#if resueltos}<span class="cuenta-ej" title="Resueltos">{resueltos}/{bloque.items.length} ✓</span>{/if}
    {#if conSolucion.length > 1}
      <button onclick={alternarTodas}>{todas ? 'Ocultar soluciones' : 'Ver todas las soluciones'}</button>
    {/if}
  </div>
  {#each bloque.items as it, k (it.label ?? k)}
    {@const datos = item(it.label)}
    {@const est = it.label && aprendizaje.listo ? estadoDe(it.label) : 'pendiente'}
    <div class="ejercicio" id={it.label || undefined} data-estado={est}>
      <div class="bloques">
        <span class="ejercicio-num">Ejercicio {it.num}.{#if est === 'resuelto'}<span class="marca-ok" title="Resuelto"> ✓</span>{/if}</span>
        {#if it.label}<span class="ej-simular"><BotonSimular label={it.label} compacto /></span>{/if}
        <Bloques bloques={it.bloques} {parte} />
      </div>
      {#if datos && it.label}
        <Comprobador
          label={it.label}
          item={datos}
          solucionVisible={!!abiertas[k]}
          sinSolucion={!it.solucion?.length}
          alVerSolucion={(ver) => (abiertas[k] = ver)}
        />
      {:else if it.solucion?.length}
        <button class="ver-solucion" aria-expanded={!!abiertas[k]} onclick={() => (abiertas[k] = !abiertas[k])}>
          <Icono nombre={abiertas[k] ? 'ocultar' : 'ver'} tam={16} />
          {abiertas[k] ? 'Ocultar solución' : 'Ver solución'}
        </button>
      {/if}
      {#if it.solucion?.length}
        {#if abiertas[k]}
          <div class="solucion">
            <span class="solucion-tit">Solución {it.num}.</span>
            <div class="sol-cuerpo"><Bloques bloques={it.solucion} {parte} /></div>
          </div>
        {/if}
      {:else if !datos}
        <span class="sin-solucion">Sin solución en el libro.</span>
      {/if}
    </div>
  {/each}
</section>

<style>
  .cuenta-ej {
    padding: 0 9px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.16);
    font-size: 13px;
    font-weight: 700;
    line-height: 24px;
  }
  .marca-ok {
    color: var(--c-ejemplo);
  }
</style>
