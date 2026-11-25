<script lang="ts">
  // Start page (0.11, group B; 2.1 a row of «Para hoy también»): the way into «Práctica inteligente» (#/practicar) —
  // the concept that most needs it (the weakest one practised, or the most forgotten) and how many are due for review.
  // (Mastery per concept, 0.11's «Ver su dominio por conceptos», is reached from «Progreso».)
  import { onMount } from 'svelte';
  import Fila from './Fila.svelte';
  import { cargarDominio, conceptosConDominio, estadoDominio } from '../../lib/aprendizaje/dominio.svelte';
  import { tituloConcepto } from '../../lib/aprendizaje/catalogo';

  const resumen = $derived.by(() => {
    if (!estadoDominio.listo) return null;
    const cs = conceptosConDominio();
    const debiles = cs.filter((c) => c.valor < 0.6 && !c.repasar).sort((a, b) => a.valor - b.valor);
    const repasar = cs.filter((c) => c.repasar).sort((a, b) => a.retencion - b.retencion);
    return { practicados: cs.length, debil: debiles[0] ?? null, repasar: repasar.length, olvido: repasar[0] ?? null };
  });

  const detalle = $derived.by(() => {
    const r = resumen;
    if (!r) return 'Diez ejercicios elegidos para usted';
    if (!r.practicados) return 'Diez ejercicios de su curso, elegidos para usted';
    if (r.debil) return `Para reforzar: ${tituloConcepto(r.debil.clave)}`;
    if (r.olvido) return `Para repasar: ${tituloConcepto(r.olvido.clave)}`;
    return 'Repaso de lo que domina y algo nuevo de su curso';
  });

  onMount(() => {
    const ir = () => void cargarDominio();
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(ir, { timeout: 1500 });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(ir, 400);
    return () => clearTimeout(t);
  });
</script>

<Fila
  href="#/practicar"
  titulo="Práctica inteligente"
  detalle={resumen?.repasar ? `${detalle} · ${resumen.repasar} ${resumen.repasar === 1 ? 'concepto' : 'conceptos'} para repasar` : detalle}
  clase="practica-inicio"
  data-practica-inicio
/>
