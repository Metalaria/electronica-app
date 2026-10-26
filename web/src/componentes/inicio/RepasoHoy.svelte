<script lang="ts">
  // Start page: today's flashcards (counted in idle time, the glossary is not needed to show the page).
  import { onMount } from 'svelte';
  import Icono from '../Icono.svelte';
  import type { ResumenRepaso } from './repasoHoy';

  let resumen = $state<ResumenRepaso | null>(null);
  let fallo = $state(false);

  onMount(() => {
    let vivo = true;
    const contar = () =>
      import('./repasoHoy')
        .then((m) => m.resumenRepaso())
        .then((r) => {
          if (vivo) resumen = r;
        })
        .catch(() => {
          if (vivo) fallo = true;
        });
    const id = 'requestIdleCallback' in window ? window.requestIdleCallback(contar, { timeout: 1200 }) : setTimeout(contar, 300);
    return () => {
      vivo = false;
      if ('cancelIdleCallback' in window && typeof id === 'number') window.cancelIdleCallback(id);
    };
  });

  const detalle = $derived.by(() => {
    if (!resumen) return '';
    const partes: string[] = [];
    if (resumen.nuevas) partes.push(`${resumen.nuevas} ${resumen.nuevas === 1 ? 'nueva' : 'nuevas'}`);
    if (resumen.aprendiendo) partes.push(`${resumen.aprendiendo} en aprendizaje`);
    if (resumen.repaso) partes.push(`${resumen.repaso} de repaso`);
    return partes.join(' · ');
  });
</script>

<section class="repaso-hoy" aria-labelledby="tit-repaso-hoy" aria-busy={!resumen && !fallo}>
  <h2 id="tit-repaso-hoy"><Icono nombre="repaso" tam={16} /> Repaso de hoy</h2>
  {#if fallo}
    <p class="det">No se pudo contar el repaso.</p>
    <a class="boton" href="#/repaso">Abrir el repaso</a>
  {:else if !resumen}
    <p class="cifra cargando" aria-hidden="true">·</p>
    <p class="det">Contando las tarjetas…</p>
  {:else}
    <p class="cifra" data-pendientes={resumen.total}>{resumen.total}</p>
    <p class="txt">{resumen.total === 1 ? 'tarjeta para hoy' : resumen.total ? 'tarjetas para hoy' : 'tarjetas: al día'}</p>
    <p class="det">
      {#if detalle}{detalle}{:else}Vuelva mañana para las siguientes.{/if}
      <span class="mazo">{resumen.mazo}</span>
    </p>
    <div class="acciones">
      {#if resumen.total}
        <a class="boton primario" href="#/repaso/tarjetas">Empezar <Icono nombre="chevron" tam={16} /></a>
      {:else}
        <a class="boton" href="#/repaso">Ver el repaso</a>
      {/if}
      {#if resumen.fallos}<a class="enlace" href="#/repaso/repasar">{resumen.fallos} {resumen.fallos === 1 ? 'pregunta fallada' : 'preguntas falladas'}</a>{/if}
    </div>
    {#if resumen.racha > 1}<p class="racha">Racha de {resumen.racha} días</p>{/if}
  {/if}
</section>

<style>
  .repaso-hoy {
    display: flex;
    flex-direction: column;
    padding: 16px 18px;
    border: 1px solid var(--linea);
    border-radius: 14px;
    background: var(--superficie);
  }
  h2 {
    display: flex;
    align-items: center;
    gap: 7px;
    margin: 0 0 10px;
    color: var(--tinta-tenue);
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .cifra {
    margin: 0;
    color: var(--titulos);
    font-size: 44px;
    font-weight: 700;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .cifra.cargando {
    color: var(--linea);
  }
  .txt {
    margin: 4px 0 0;
    color: var(--tinta);
    font-size: 16px;
    font-weight: 600;
  }
  .det {
    margin: 6px 0 0;
    color: var(--tinta-suave);
    font-size: 14px;
    line-height: 1.4;
  }
  .mazo {
    display: block;
    color: var(--tinta-tenue);
    font-size: 13px;
  }
  .acciones {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 14px;
    margin-top: auto;
    padding-top: 14px;
  }
  .acciones .boton {
    min-height: 40px;
  }
  .enlace {
    color: var(--acento);
    font-size: 14px;
    font-weight: 600;
    text-decoration: none;
  }
  .enlace:hover {
    text-decoration: underline;
  }
  .racha {
    margin: 10px 0 0;
    color: var(--tinta-tenue);
    font-size: 13px;
  }
</style>
