<script lang="ts">
  // Start page (0.11, group B): the problem of the day — what it is about, whether it is solved, the streak of days
  // solving it — with «Resolver» (#/problema) and «La solución de ayer». Chosen in idle time (it reads the course's
  // practice files), so the start page does not wait for it; the card keeps its height meanwhile. Left open, the card
  // moves on to the new day at 04:00 (`reloj.hoy` of the module).
  import { onMount, untrack } from 'svelte';
  import CalendarDays from '@lucide/svelte/icons/calendar-days';
  import BotonPrincipal from '../ui09/BotonPrincipal.svelte';
  import type { DiaProblema } from '../../lib/aprendizaje/problema-dia.svelte';

  let problema = $state<DiaProblema | null>(null);
  let tema = $state('');
  let fallo = $state(false);
  let modulo = $state<typeof import('../../lib/aprendizaje/problema-dia.svelte') | null>(null);

  /** The day the card shows (the module's clock, once loaded). */
  const dia = $derived(modulo ? modulo.reloj.hoy : '');
  const resuelto = $derived(modulo && problema && dia ? (modulo.problemas.dias[dia]?.r ?? null) : null);
  const racha = $derived(modulo && dia ? modulo.rachaProblemas(dia) : 0);

  let vivo = true;
  let vez = 0;
  /** Chooses (or reads) a day's problem and what it is about. */
  async function cargarDia(m: typeof import('../../lib/aprendizaje/problema-dia.svelte'), d0: string) {
    const esta = ++vez;
    const fuera = () => !vivo || esta !== vez;
    try {
      const { tituloConcepto } = await import('../../lib/aprendizaje/catalogo');
      const d = await m.problemaDeHoy(d0);
      if (fuera()) return;
      problema = d;
      tema = '';
      fallo = false;
      if (d?.k === 'practica') {
        const { cargarPractica } = await import('../practica/datos');
        const it = (await cargarPractica(d.parte))?.items.find((x) => x.id === d.id);
        if (it && !fuera()) tema = tituloConcepto(`${it.parte}/${it.seccion}`);
      } else if (d) {
        const { cargarEjercicios } = await import('../../lib/ejercicios.svelte');
        const it = (await cargarEjercicios())?.items[d.id];
        if (it && !fuera()) tema = `${it.tipo === 'ej' ? 'Ejercicio' : 'Problema'} ${it.num}${it.seccion ? ` · ${tituloConcepto(`${it.parte}/${it.seccion}`)}` : ''}`;
      }
      if (!d && !fuera()) fallo = true;
    } catch {
      if (!fuera()) fallo = true;
    }
  }

  // 04:00 with the start page open: the new day's problem
  $effect(() => {
    const d = dia;
    const m = modulo;
    if (!m || !d) return;
    untrack(() => {
      if (problema && m.problemas.dias[d]?.id === problema.id) return;
      void cargarDia(m, d);
    });
  });

  onMount(() => {
    const ir = async () => {
      try {
        const m = await import('../../lib/aprendizaje/problema-dia.svelte');
        if (!vivo) return;
        m.seguirDia();
        // the effect above loads the day's problem
        modulo = m;
      } catch {
        if (vivo) fallo = true;
      }
    };
    const id = 'requestIdleCallback' in window ? window.requestIdleCallback(() => void ir(), { timeout: 1500 }) : setTimeout(() => void ir(), 400);
    return () => {
      vivo = false;
      if ('cancelIdleCallback' in window && typeof id === 'number') window.cancelIdleCallback(id);
    };
  });

  const detalle = $derived.by(() => {
    if (fallo) return 'No se pudo preparar el problema de hoy.';
    if (!problema) return 'Preparando el problema de hoy…';
    if (resuelto) return resuelto.bien ? `Resuelto${racha > 1 ? ` · ${racha} días seguidos` : ''}` : 'Hoy no salió · mañana, otro';
    return racha ? `Sin resolver · racha de ${racha} ${racha === 1 ? 'día' : 'días'}` : 'Sin resolver · unos minutos';
  });
</script>

<section class="t09-tarjeta problema-inicio" aria-labelledby="tit-problema-inicio" aria-busy={!problema && !fallo} data-problema-inicio={resuelto ? (resuelto.bien ? 'bien' : 'mal') : problema ? 'pendiente' : 'espera'}>
  <div class="fila">
    <span class="icono" aria-hidden="true"><CalendarDays size={26} /></span>
    <div class="textos">
      <h2 id="tit-problema-inicio">Problema del día</h2>
      <span class="tema">{tema || ' '}</span>
      <span class="det">{detalle}</span>
    </div>
    {#if problema}
      <BotonPrincipal href="#/problema" contorno={!!resuelto}>{resuelto ? 'Ver' : 'Resolver'}</BotonPrincipal>
    {/if}
  </div>
  <a class="ayer" href="#/problema/ayer" data-problema-ayer-inicio>La solución de ayer</a>
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
    background: var(--ambar-tinte);
    color: var(--ambar);
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
  .tema {
    display: -webkit-box;
    overflow: hidden;
    color: var(--tinta);
    font-size: 14.5px;
    line-height: 1.35;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }
  .det {
    color: var(--tinta-suave);
    font-size: 14px;
  }
  .fila :global(.t09-boton) {
    flex: none;
  }
  .ayer {
    display: flex;
    align-items: center;
    min-height: var(--toque);
    margin: 6px 0 -10px 62px;
    color: var(--acento);
    font-size: 14px;
    font-weight: 600;
    text-decoration: none;
  }
  .ayer:hover {
    text-decoration: underline;
  }
</style>
