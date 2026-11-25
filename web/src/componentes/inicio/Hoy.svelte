<script lang="ts">
  // 2.1 start page, «Hoy» (the approved mock-up): two figures, no cards — today's goal as a ring («1 de 3 pasos»,
  // «Objetivo de hoy»; a button that opens «Aa», where it is changed) and the streak («4 días seguidos», «Racha»; a link
  // to «Progreso», which has the streak's detail). The goal and the streak are lib/progreso-diario.svelte.ts's (0.9).
  // The phone shows the mock-up's short forms («1 de 3» / «pasos hoy», «4 días» / «de racha»).
  import { app } from '../../lib/estado.svelte';
  import { progresoDiario } from '../../lib/progreso-diario.svelte';
  import { elOrdinal, enPalabras } from './destino.svelte';

  const p = progresoDiario;
  const R = 23;
  const C = 2 * Math.PI * R;
  const hechos = $derived(p.hechosHoy);
  const cantidad = $derived(p.objetivo.cantidad);
  const fraccion = $derived(Math.min(1, hechos / Math.max(1, cantidad)));
  const pasos = $derived(p.objetivo.tipo === 'pasos');
  const unidad = $derived(pasos ? (cantidad === 1 ? 'paso' : 'pasos') : cantidad === 1 ? 'pregunta' : 'preguntas');

  const faltan = $derived(Math.max(0, cantidad - hechos));
  /** The 0.9 streak sentence, now the figure's spoken description. */
  const textoRacha = $derived.by(() => {
    if (p.cumplidoHoy) return 'Objetivo de hoy cumplido.';
    const u = pasos ? (faltan === 1 ? 'paso' : 'pasos') : faltan === 1 ? 'pregunta' : 'preguntas';
    const cuanto = `${faltan === 1 ? 'falta' : 'faltan'} ${faltan === 1 ? (u === 'pregunta' ? 'una' : 'un') : enPalabras(faltan)} ${u}`;
    if (!p.racha) return `Hoy le ${cuanto} para empezarla.`;
    return `Hoy le ${cuanto} para ${elOrdinal(p.racha + 1)}.`;
  });
  const etiquetaObjetivo = $derived(
    `Objetivo de hoy: ${hechos} de ${cantidad} ${unidad}${p.cumplidoHoy ? ', cumplido' : ''}${pasos && p.objetivo.secciones ? ' (pasos de lección o secciones leídas)' : ''}. Se cambia en «Aa».`,
  );

  function abrirAjustes(ev: MouseEvent): void {
    ev.stopPropagation();
    app.ajustes = true;
  }
</script>

<section class="seccion21 hoy" aria-labelledby="tit-hoy">
  <h2 class="etiqueta21" id="tit-hoy">Hoy</h2>
  <div class="cifras">
    <button type="button" class="cifra objetivo" class:cumplido={p.cumplidoHoy} onclick={abrirAjustes} aria-label={etiquetaObjetivo} data-hechos={hechos} data-cantidad={cantidad}>
      <svg class="anillo" width="56" height="56" viewBox="0 0 56 56" aria-hidden="true"
        ><circle cx="28" cy="28" r={R} fill="none" stroke="var(--v11-linea)" stroke-width="6" />{#if fraccion > 0}<circle
            cx="28"
            cy="28"
            r={R}
            fill="none"
            stroke={p.cumplidoHoy ? 'var(--v11-bien)' : 'var(--v11-azul)'}
            stroke-width="6"
            stroke-linecap="round"
            stroke-dasharray={`${(fraccion * C).toFixed(1)} ${C.toFixed(1)}`}
            transform="rotate(-90 28 28)"
          />{/if}</svg
      >
      <span class="textos" aria-hidden="true">
        <span class="valor"><span class="cuenta">{hechos} de {cantidad}</span><span class="largo">{' '}{unidad}</span></span>
        <span class="rotulo"><span class="largo">{p.cumplidoHoy ? 'Objetivo de hoy cumplido' : 'Objetivo de hoy'}</span><span class="corto">{p.cumplidoHoy ? 'cumplido' : `${unidad} hoy`}</span></span>
      </span>
    </button>
    <a class="cifra racha" href="#/progreso" data-racha={p.racha} aria-label={`Racha: ${p.racha} ${p.racha === 1 ? 'día seguido' : 'días seguidos'}. ${textoRacha} Ver el progreso.`}>
      <svg class="llama" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--v11-naranja)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
        ><path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-6 1 1 2 2 2 3 1-2 1-4 1-7z" /></svg
      >
      <span class="textos" aria-hidden="true">
        <span class="valor">{p.racha} {p.racha === 1 ? 'día' : 'días'}<span class="largo">{' '}{p.racha === 1 ? 'seguido' : 'seguidos'}</span></span>
        <span class="rotulo"><span class="largo">Racha</span><span class="corto">de racha</span></span>
      </span>
    </a>
  </div>
</section>

<style>
  .cifras {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 16px 40px;
  }
  .cifra {
    display: flex;
    align-items: center;
    gap: 14px;
    min-height: 56px;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 12px;
    background: none;
    color: var(--v11-tinta);
    font: inherit;
    text-align: left;
    text-decoration: none;
    cursor: pointer;
  }
  .cifra:hover .valor {
    color: var(--v11-azul);
  }
  .cifra:focus-visible {
    outline: 3px solid var(--v11-foco);
    outline-offset: 4px;
  }
  .anillo,
  .llama {
    flex: none;
  }
  .anillo circle {
    transition: stroke-dasharray 0.4s ease-out;
  }
  .racha .llama {
    margin: 0 14px;
  }
  .textos {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .valor {
    font-size: 18px;
    font-weight: 600;
    line-height: 1.25;
    font-variant-numeric: tabular-nums;
  }
  .rotulo {
    color: var(--v11-tinta-suave);
    font-size: 15px;
    line-height: 1.3;
  }
  .cumplido .rotulo {
    color: var(--v11-bien-texto);
  }
  .corto {
    display: none;
  }
  /* phone (InicioMovil.png): the short forms side by side */
  @container inicio (max-width: 599px) {
    .cifras {
      flex-wrap: nowrap;
      gap: 24px;
    }
    .cifra {
      gap: 10px;
    }
    .anillo {
      width: 44px;
      height: 44px;
    }
    .racha .llama {
      margin: 0;
      width: 24px;
      height: 24px;
    }
    .largo {
      display: none;
    }
    .corto {
      display: inline;
    }
    .valor {
      font-size: 16px;
    }
    .rotulo {
      font-size: 14px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .anillo circle {
      transition: none;
    }
  }
</style>
