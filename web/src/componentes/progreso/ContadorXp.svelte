<script lang="ts">
  // A number that counts up to its new value (0.11: XP on the lesson's end, the start page and «Progreso»).
  // requestAnimationFrame only while it moves (≈ 0.9 s, ease-out); nothing runs once it arrives. With
  // prefers-reduced-motion, or when the change is tiny, it jumps. The final value is always in the DOM
  // attribute data-valor (tests and screen readers read the text once it settles).
  import { untrack } from 'svelte';

  let { valor, desde = null, duracion = 900 }: { valor: number; desde?: number | null; duracion?: number } = $props();

  let mostrado = $state(untrack(() => desde ?? valor));
  let raf = 0;

  $effect(() => {
    const destino = valor;
    const inicio = untrack(() => mostrado);
    cancelAnimationFrame(raf);
    if (destino === inicio || window.matchMedia('(prefers-reduced-motion: reduce)').matches || Math.abs(destino - inicio) < 2) {
      mostrado = destino;
      return;
    }
    const t0 = performance.now();
    const paso = (t: number) => {
      const f = Math.min(1, (t - t0) / duracion);
      const e = 1 - (1 - f) ** 3;
      mostrado = Math.round(inicio + (destino - inicio) * e);
      if (f < 1) raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  });
</script>

<span class="contador" data-valor={valor}>{mostrado.toLocaleString('es-ES')}</span>

<style>
  .contador {
    font-variant-numeric: tabular-nums;
  }
</style>
