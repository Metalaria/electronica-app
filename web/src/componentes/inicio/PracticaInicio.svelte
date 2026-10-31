<script lang="ts">
  // Start page (0.11, group B): the way into «Práctica inteligente» — the concept that most needs it (the weakest
  // one practised, or the most forgotten), how many are due for review, and «Practicar» (#/practicar).
  import { onMount } from 'svelte';
  import Brain from '@lucide/svelte/icons/brain';
  import BotonPrincipal from '../ui09/BotonPrincipal.svelte';
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

<section class="t09-tarjeta practica-inicio" aria-labelledby="tit-practica-inicio" data-practica-inicio>
  <div class="fila">
    <span class="icono" aria-hidden="true"><Brain size={26} /></span>
    <div class="textos">
      <h2 id="tit-practica-inicio">Práctica inteligente</h2>
      <span class="det">{detalle}</span>
      {#if resumen?.repasar}<span class="rep">{resumen.repasar} {resumen.repasar === 1 ? 'concepto' : 'conceptos'} para repasar</span>{/if}
    </div>
    <BotonPrincipal href="#/practicar" contorno>Practicar</BotonPrincipal>
  </div>
  {#if resumen?.practicados}<a class="dominio" href="#/progreso/dominio" data-ir-dominio>Ver su dominio por conceptos</a>{/if}
</section>

<style>
  .fila {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .icono {
    display: grid;
    flex: none;
    place-items: center;
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: var(--acento-tinte);
    color: var(--acento);
  }
  .textos {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  h2 {
    margin: 0;
    color: var(--tinta);
    font-size: 16px;
    font-weight: 600;
  }
  .det {
    color: var(--tinta-suave);
    font-size: 14px;
  }
  .rep {
    color: color-mix(in srgb, var(--ambar) 80%, var(--tinta));
    font-size: 14px;
    font-weight: 600;
  }
  .fila :global(.t09-boton) {
    flex: none;
  }
  .dominio {
    display: flex;
    align-items: center;
    min-height: var(--toque);
    margin: 6px 0 -10px 62px;
    color: var(--acento);
    font-size: 14px;
    font-weight: 600;
    text-decoration: none;
  }
  .dominio:hover {
    text-decoration: underline;
  }
</style>
