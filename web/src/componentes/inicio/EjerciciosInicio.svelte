<script lang="ts">
  // 2.1 start page, a row of «Para hoy también»: the book's exercises and problems answered wrong, «Repasar N
  // fallados» of the 0.9 progress block (now on «Progreso»), → #/ejercicios/repaso. Only when there are some.
  import { onMount } from 'svelte';
  import { cargarEjercicios, ejercicios } from '../../lib/ejercicios.svelte';
  import { aprendizaje, cargarAprendizaje, estadoDe } from '../../lib/aprendizaje.svelte';
  import Fila from './Fila.svelte';

  const fallados = $derived.by(() => {
    const d = ejercicios.datos;
    if (!d || !aprendizaje.listo) return 0;
    let n = 0;
    for (const c of d.capitulos) for (const l of c.items) if (estadoDe(l) === 'fallado') n++;
    return n;
  });

  onMount(() => {
    const ir = () => {
      void cargarAprendizaje();
      void cargarEjercicios();
    };
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(ir, { timeout: 1500 });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(ir, 400);
    return () => clearTimeout(t);
  });
</script>

{#if fallados}
  <Fila
    href="#/ejercicios/repaso"
    titulo="Ejercicios fallados"
    detalle={`${fallados} ${fallados === 1 ? 'ejercicio o problema' : 'ejercicios y problemas'} para repasar`}
    aviso
    data-ejercicios-fallados-inicio={fallados}
  />
{/if}
