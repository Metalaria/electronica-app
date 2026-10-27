<script lang="ts">
  // Start page (0.9): today's goal as a ring («2/3»), lesson steps or review questions; set in «Aa».
  import { app } from '../../lib/estado.svelte';
  import { progresoDiario } from '../../lib/progreso-diario.svelte';

  const p = progresoDiario;
  const C = 2 * Math.PI * 26;
  const hechos = $derived(p.hechosHoy);
  const fraccion = $derived(Math.min(1, hechos / p.objetivo.cantidad));
  const unidad = $derived(
    p.objetivo.tipo === 'pasos'
      ? (p.objetivo.cantidad === 1 ? 'paso de lección' : 'pasos de lección') + (p.objetivo.secciones ? ' o secciones leídas' : '')
      : p.objetivo.cantidad === 1 ? 'pregunta de repaso' : 'preguntas de repaso',
  );
  const etiqueta = $derived(
    `${hechos} de ${p.objetivo.cantidad} ${p.objetivo.tipo === 'pasos' ? 'pasos' : 'preguntas'} hechos hoy`.replace('preguntas hechos', 'preguntas hechas'),
  );

  function abrirAjustes(ev: MouseEvent): void {
    ev.stopPropagation();
    app.ajustes = true;
  }
</script>

<section class="t09-tarjeta objetivo" class:cumplido={p.cumplidoHoy} aria-labelledby="tit-objetivo" data-hechos={hechos} data-cantidad={p.objetivo.cantidad}>
  <div class="fila">
    <div class="anillo">
      <svg width="64" height="64" viewBox="0 0 64 64" role="img" aria-label={etiqueta}
        ><circle cx="32" cy="32" r="26" fill="none" stroke="var(--linea)" stroke-width="8" />{#if fraccion > 0}<circle
            cx="32"
            cy="32"
            r="26"
            fill="none"
            stroke="var(--acento)"
            stroke-width="8"
            stroke-linecap="round"
            stroke-dasharray={`${(fraccion * C).toFixed(1)} ${C.toFixed(1)}`}
            transform="rotate(-90 32 32)"
          />{/if}</svg
      >
      <span class="cuenta" aria-hidden="true">{hechos}/{p.objetivo.cantidad}</span>
    </div>
    <div class="textos">
      <h2 id="tit-objetivo">Objetivo de hoy</h2>
      <span class="det">{p.cumplidoHoy ? '¡Cumplido!' : `${p.objetivo.cantidad} ${unidad}`}</span>
    </div>
  </div>
  <p class="txt">
    Lo cambias en <button type="button" class="aa" onclick={abrirAjustes} aria-label="«Aa», ajustes">«Aa»</button>: de 1 a 10 pasos, o preguntas de repaso.
  </p>
</section>

<style>
  .objetivo {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .fila {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .anillo {
    position: relative;
    flex: none;
    width: 64px;
    height: 64px;
  }
  .anillo svg {
    display: block;
  }
  .anillo circle {
    transition: stroke-dasharray 0.4s ease-out;
  }
  .cuenta {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    color: var(--titulos);
    font-size: 18px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .textos {
    display: flex;
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
  .cumplido .det {
    color: var(--acento);
    font-weight: 700;
  }
  .txt {
    margin: auto 0 0;
    color: var(--tinta-suave);
    font-size: 14px;
    line-height: 1.4;
  }
  .aa {
    position: relative;
    padding: 0;
    border: 0;
    background: none;
    color: var(--acento);
    font-weight: 700;
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 2px;
  }
  /* 44 px touch target around the inline word */
  .aa::after {
    content: '';
    position: absolute;
    inset: -12px -8px;
  }
</style>
