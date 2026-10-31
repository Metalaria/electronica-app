<script lang="ts">
  // End of a lesson (0.11): three tiles under «Sección completada» — the XP this visit earned (counting up), the
  // streak and the accuracy of the answers at the first attempt — and, the first time the summary is reached in
  // the visit, a short burst of confetti (CSS transforms, ~1.2 s, then removed; none with reduced motion).
  // The level bar below shows the level and how much is left for the next one.
  import { onMount } from 'svelte';
  import { progresoXp, cargarProgresoXp, xpDesde } from '../../lib/aprendizaje/progreso.svelte';
  import { progresoDiario } from '../../lib/progreso-diario.svelte';
  import ContadorXp from './ContadorXp.svelte';

  let {
    inicio,
    aciertos = 0,
    respondidas = 0,
    fiesta = true,
  }: {
    /** When the visit started (ms): the XP earned since then is this lesson's. */
    inicio: number;
    /** Answers right at the first attempt, and answers given, in this visit. */
    aciertos?: number;
    respondidas?: number;
    /** Confetti (the summary reached by finishing the lesson, not by reopening it). */
    fiesta?: boolean;
  } = $props();

  const ganado = $derived(progresoXp.listo ? xpDesde(inicio) : 0);
  const precision = $derived(respondidas ? Math.round((100 * aciertos) / respondidas) : null);
  const nivel = $derived(progresoXp.nivel);
  let confeti = $state(false);

  const PIEZAS = Array.from({ length: 14 }, (_, k) => ({
    x: Math.round(Math.cos((k / 14) * Math.PI * 2) * (90 + (k % 3) * 30)),
    y: Math.round(-60 - Math.abs(Math.sin((k / 14) * Math.PI * 2)) * 90 - (k % 4) * 12),
    giro: (k * 67) % 360,
    color: ['var(--c-ejemplo)', 'var(--ambar-relleno)', 'var(--acento)', 'var(--c-precaucion)'][k % 4]!,
    retraso: (k % 5) * 30,
  }));

  onMount(() => {
    void cargarProgresoXp();
    if (!fiesta || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    confeti = true;
    const t = setTimeout(() => (confeti = false), 1400);
    return () => clearTimeout(t);
  });
</script>

<div class="celebracion" data-celebracion>
  {#if confeti}
    <span class="confeti" aria-hidden="true">
      {#each PIEZAS as p, k (k)}
        <i style:--x={`${p.x}px`} style:--y={`${p.y}px`} style:--giro={`${p.giro}deg`} style:--c={p.color} style:animation-delay={`${p.retraso}ms`}></i>
      {/each}
    </span>
  {/if}
  <ul class="fichas">
    <li class="ficha xp" data-xp-leccion={ganado}>
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 2.5L5 13.5h6.5l-1 8 8.5-11h-6.5z" fill="currentColor" /></svg>
      {#if ganado > 0}
        <strong>+<ContadorXp valor={ganado} desde={0} /></strong>
        <span>XP ganados</span>
      {:else}
        <strong><ContadorXp valor={progresoXp.total} /></strong>
        <span>XP en total</span>
      {/if}
    </li>
    <li class="ficha racha" data-racha-leccion={progresoDiario.racha}>
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"
        ><path
          d="M12 2.5c.6 3.2 4.8 5.6 4.8 10.4A4.8 4.8 0 0 1 12 17.7a4.8 4.8 0 0 1-4.8-4.8c0-2.2 1.2-3.6 2.3-4.8.3 1.6 1.1 2.6 2.1 3 0-2.9.1-5.8.4-8.6z"
          fill="currentColor"
        /></svg
      >
      <strong>{progresoDiario.racha}</strong>
      <span>{progresoDiario.racha === 1 ? 'día de racha' : 'días de racha'}</span>
    </li>
    {#if precision !== null}
      <li class="ficha precision" data-precision={precision}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"
          ><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="0.8" fill="currentColor" /></svg
        >
        <strong>{precision} %</strong>
        <span>a la primera</span>
      </li>
    {/if}
  </ul>
  <a class="nivel" href="#/progreso" data-nivel-leccion={nivel.nivel}>
    <span class="rot">Nivel {nivel.nivel} · {nivel.nombre}</span>
    <span class="falta">{nivel.falta.toLocaleString('es-ES')} XP para el nivel {nivel.nivel + 1}</span>
    <span class="barra" aria-hidden="true"><span style:transform={`scaleX(${nivel.fraccion})`}></span></span>
  </a>
</div>

<style>
  .celebracion {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
    width: 100%;
    margin-top: 6px;
  }
  .fichas {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .ficha {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 14px 10px 12px;
    border: 1px solid var(--linea);
    border-radius: var(--radio-tarjeta-p);
    background: var(--superficie);
    text-align: center;
    animation: subir 0.45s cubic-bezier(0.2, 1.2, 0.4, 1) both;
  }
  .ficha:nth-child(2) {
    animation-delay: 0.08s;
  }
  .ficha:nth-child(3) {
    animation-delay: 0.16s;
  }
  @keyframes subir {
    from {
      opacity: 0;
      transform: translateY(10px) scale(0.96);
    }
  }
  .ficha svg {
    margin-bottom: 2px;
  }
  .ficha strong {
    color: var(--titulos);
    font-family: var(--serif);
    font-size: 28px;
    font-weight: 700;
    line-height: 1.1;
  }
  .ficha > span {
    color: var(--tinta-suave);
    font-size: 14px;
  }
  .xp svg {
    color: var(--ambar);
  }
  .racha svg {
    color: var(--ambar);
  }
  .precision svg {
    color: var(--c-ejemplo);
  }
  .nivel {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 6px 12px;
    padding: 12px 14px;
    border-radius: var(--radio-tarjeta-p);
    background: var(--superficie-2);
    color: var(--tinta);
    text-align: left;
    text-decoration: none;
  }
  .nivel .rot {
    color: var(--titulos);
    font-size: 15px;
    font-weight: 700;
  }
  .nivel .falta {
    color: var(--tinta-suave);
    font-size: 13.5px;
    text-align: right;
  }
  .barra {
    grid-column: 1 / -1;
    height: 8px;
    overflow: hidden;
    border-radius: 999px;
    background: var(--linea);
  }
  .barra span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--ambar-relleno);
    transform-origin: left center;
    transition: transform 0.8s ease-out;
  }
  .confeti {
    position: absolute;
    top: -40px;
    left: 50%;
    width: 0;
    height: 0;
    pointer-events: none;
  }
  .confeti i {
    position: absolute;
    width: 8px;
    height: 12px;
    border-radius: 2px;
    background: var(--c);
    opacity: 0;
    animation: volar 1.1s cubic-bezier(0.15, 0.7, 0.4, 1) both;
  }
  @keyframes volar {
    0% {
      opacity: 1;
      transform: translate(0, 0) rotate(0deg) scale(0.6);
    }
    70% {
      opacity: 1;
    }
    100% {
      opacity: 0;
      transform: translate(var(--x), calc(var(--y) + 70px)) rotate(var(--giro)) scale(1);
    }
  }
  @media (max-width: 420px) {
    .fichas {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }
    .ficha {
      padding: 12px 4px 10px;
    }
    .ficha strong {
      font-size: 22px;
    }
    .ficha > span {
      font-size: 13px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .ficha {
      animation: none;
    }
    .barra span {
      transition: none;
    }
  }
</style>
