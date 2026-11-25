<script lang="ts">
  // Start page (0.11, group B; 2.1 a row of «Para hoy también»): the problem of the day — what it is about, whether it
  // is solved, the streak of days solving it — a link to #/problema; and, when yesterday's problem was seen, a row
  // «La solución de ayer» (#/problema/ayer). Chosen in idle time (it reads the course's practice files), so the start
  // page does not wait for it. Left open, the row moves on to the new day at 04:00 (`reloj.hoy` of the module).
  import { onMount, untrack } from 'svelte';
  import Fila from './Fila.svelte';
  import type { DiaProblema } from '../../lib/aprendizaje/problema-dia.svelte';

  let problema = $state<DiaProblema | null>(null);
  let tema = $state('');
  let fallo = $state(false);
  let modulo = $state<typeof import('../../lib/aprendizaje/problema-dia.svelte') | null>(null);

  /** The day the card shows (the module's clock, once loaded). */
  const dia = $derived(modulo ? modulo.reloj.hoy : '');
  const resuelto = $derived(modulo && problema && dia ? (modulo.problemas.dias[dia]?.r ?? null) : null);
  const racha = $derived(modulo && dia ? modulo.rachaProblemas(dia) : 0);
  /** Yesterday's problem was seen (stored): its solution is worth a row. */
  const hayAyer = $derived(!!(modulo && dia && modulo.problemas.dias[modulo.diaAnterior(dia)]));

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
    const estado = resuelto
      ? resuelto.bien
        ? `Resuelto${racha > 1 ? ` · ${racha} días seguidos` : ''}`
        : 'Hoy no salió · mañana, otro'
      : racha
        ? `Racha de ${racha} ${racha === 1 ? 'día' : 'días'}`
        : '';
    return [tema.trim(), estado].filter(Boolean).join(' · ') || 'Unos minutos';
  });
</script>

<Fila
  href="#/problema"
  titulo="Problema del día"
  {detalle}
  aria-busy={!problema && !fallo}
  data-problema-inicio={resuelto ? (resuelto.bien ? 'bien' : 'mal') : problema ? 'pendiente' : 'espera'}
/>
{#if hayAyer}
  <Fila href="#/problema/ayer" titulo="La solución de ayer" data-problema-ayer-inicio />
{/if}
