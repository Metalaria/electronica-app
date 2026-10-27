<script lang="ts">
  // Start page (0.9): the streak — consecutive days with the daily goal met (lib/progreso-diario.svelte.ts) —
  // with a flame and the last seven days (today last; today's circle fills once its goal is met).
  import { progresoDiario } from '../../lib/progreso-diario.svelte';
  import { elOrdinal, enPalabras } from './destino.svelte';

  const LETRAS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
  const NOMBRES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

  const p = progresoDiario;
  const faltan = $derived(Math.max(0, p.objetivo.cantidad - (p.objetivo.tipo === 'pasos' ? p.hoy.pasos : p.hoy.preguntas)));
  const unidad = $derived(p.objetivo.tipo === 'pasos' ? (faltan === 1 ? 'paso' : 'pasos') : faltan === 1 ? 'pregunta' : 'preguntas');

  const texto = $derived.by(() => {
    if (p.cumplidoHoy) return p.racha === 1 ? 'de racha: hoy empieza. Objetivo cumplido.' : 'de racha. Objetivo de hoy cumplido.';
    const cuanto = `${faltan === 1 ? 'falta' : 'faltan'} ${faltan === 1 ? (unidad === 'pregunta' ? 'una' : 'un') : enPalabras(faltan)} ${unidad}`;
    if (!p.racha) return `de racha. Hoy te ${cuanto} para empezarla.`;
    return `de racha. Hoy te ${cuanto} para ${elOrdinal(p.racha + 1)}.`;
  });

  const dias = $derived(
    p.ultimosDias.map((d, i) => {
      const dia = new Date(`${d.fecha}T12:00:00`).getDay();
      const hoy = i === p.ultimosDias.length - 1;
      return { ...d, hoy, letra: LETRAS[dia] ?? '', nombre: hoy ? 'hoy' : (NOMBRES[dia] ?? '') };
    }),
  );
</script>

<section class="t09-tarjeta racha" aria-labelledby="tit-racha" data-racha={p.racha}>
  <div class="cifra">
    <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true"
      ><path
        d="M12 2.5c.6 3.2 4.8 5.6 4.8 10.4A4.8 4.8 0 0 1 12 17.7a4.8 4.8 0 0 1-4.8-4.8c0-2.2 1.2-3.6 2.3-4.8.3 1.6 1.1 2.6 2.1 3 0-2.9.1-5.8.4-8.6z"
        fill="var(--ambar-relleno)"
      /><path d="M12 21.5a6.5 6.5 0 0 0 6.5-6.5" fill="none" stroke="var(--ambar-relleno)" stroke-width="2" stroke-linecap="round" /></svg
    >
    <h2 id="tit-racha">{p.racha} {p.racha === 1 ? 'día' : 'días'}</h2>
  </div>
  <p class="txt">{texto}</p>
  <ol class="semana" aria-label="Últimos siete días">
    {#each dias as d (d.fecha)}
      <li class:hecho={d.cumplido} class:hoy={d.hoy} aria-label={`${d.nombre}: ${d.cumplido ? 'objetivo cumplido' : 'sin cumplir'}`}>
        <span class="punto" aria-hidden="true">
          {#if d.cumplido}<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"
              ><path d="M5 12.5l4.5 4.5L19 7.5" /></svg
            >{/if}
        </span>
        <span class="letra" aria-hidden="true">{d.letra}</span>
      </li>
    {/each}
  </ol>
</section>

<style>
  .racha {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .cifra {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  h2 {
    margin: 0;
    color: var(--titulos);
    font-family: var(--serif);
    font-size: 28px;
    font-weight: 700;
    line-height: 1.1;
  }
  .txt {
    margin: 0;
    color: var(--tinta-suave);
    font-size: 14px;
    line-height: 1.4;
  }
  .semana {
    display: flex;
    justify-content: space-between;
    gap: 2px;
    margin: auto 0 0;
    padding: 0;
    list-style: none;
  }
  .semana li {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  .punto {
    display: grid;
    place-items: center;
    /* seven fit in the phone's half-width card */
    width: 20px;
    height: 20px;
    border: 2px solid var(--linea);
    border-radius: 50%;
    color: var(--sobre-ambar);
  }
  .hoy .punto {
    border-color: var(--ambar-relleno);
  }
  .hecho .punto {
    border-color: var(--ambar-relleno);
    background: var(--ambar-relleno);
  }
  .letra {
    color: var(--tinta-suave);
    font-size: 12px;
  }
  .hoy .letra {
    color: var(--tinta);
    font-weight: 700;
  }
</style>
