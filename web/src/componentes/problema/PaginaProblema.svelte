<script lang="ts">
  // «Problema del día» (0.11, group B; #/problema, #/problema/ayer): one problem a day, the same all day and on
  // every device (lib/aprendizaje/problema-dia.svelte.ts), from the reader's course and level: a «Calcula» item of
  // the book with the values of the day, or a self-checked exercise. One answer (two attempts and the hints, as
  // every practice item); its first final answer is the day's result (XP, streak, achievements). Once answered, the
  // page shows the solution with the values of the day; «La solución de ayer» shows yesterday's. The day follows
  // the 04:00 change while the page is open (`reloj.hoy`): the page moves on to the new day's problem.
  import { onMount, untrack } from 'svelte';
  import CalendarDays from '@lucide/svelte/icons/calendar-days';
  import Check from '@lucide/svelte/icons/check';
  import X from '@lucide/svelte/icons/x';
  import { app } from '../../lib/estado.svelte';
  import { tonoBloque } from '../../lib/color';
  import { rotuloParte } from '../../lib/datos';
  import { escuchar } from '../../lib/aprendizaje/eventos';
  import { cargarProgresoXp } from '../../lib/aprendizaje/progreso.svelte';
  import { cargarEjercicios } from '../../lib/ejercicios.svelte';
  import { registrarActividad } from '../../lib/progreso-diario.svelte';
  import { cargarProblemas, diaAnterior, hoy as diaHoy, problemaDe, problemaDeHoy, problemas, rachaProblemas, registrarResultado, reloj, seguirDia, type DiaProblema } from '../../lib/aprendizaje/problema-dia.svelte';
  import { cargarPractica } from '../practica/datos';
  import type { ItemNumerico } from '../practica/tipos';
  import Practica, { type RespuestaPractica } from '../practica/Practica.svelte';
  import Numerico from '../practica/Numerico.svelte';
  import TarjetaEjercicio from '../aprender/TarjetaEjercicio.svelte';
  import { tituloConcepto } from '../../lib/aprendizaje/catalogo';

  let { ayer = false }: { ayer?: boolean } = $props();

  seguirDia();
  let dia = $state(untrack(() => (ayer ? diaAnterior(diaHoy()) : diaHoy())));
  let p = $state<DiaProblema | null>(null);
  let item = $state.raw<ItemNumerico | null>(null);
  let estado = $state<'cargando' | 'listo' | 'nada' | 'error'>('cargando');
  let error = $state('');
  let finalP = $state(false);

  const resultado = $derived(problemas.dias[dia]?.r ?? null);
  const racha = $derived(rachaProblemas(reloj.hoy));
  const tono = $derived(tonoBloque(app.indice?.partes[p?.parte ?? '']?.color, app.tema));
  const fecha = $derived.by(() => {
    const [a, m, d] = dia.split('-').map(Number);
    return new Date(a ?? 1970, (m ?? 1) - 1, d ?? 1).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  });
  const concepto = $derived(item ? tituloConcepto(`${item.parte}/${item.seccion}`) : '');

  let vez = 0;
  async function cargar() {
    const esta = ++vez;
    const delDia = dia;
    estado = 'cargando';
    try {
      await cargarProblemas();
      const d = ayer ? await problemaDe(delDia) : await problemaDeHoy(delDia);
      if (esta !== vez) return;
      if (!d) {
        estado = 'nada';
        return;
      }
      p = d;
      if (d.k === 'practica') {
        const datos = await cargarPractica(d.parte);
        const it = datos?.items.find((x) => x.id === d.id);
        if (!it || it.tipo !== 'numerico') throw new Error('No se encuentra el problema en los datos del libro.');
        item = it;
      } else await cargarEjercicios();
      if (esta !== vez) return;
      estado = 'listo';
    } catch (e) {
      if (esta !== vez) return;
      error = e instanceof Error ? e.message : String(e);
      estado = 'error';
    }
  }

  /** The answer goes to the current day: the problem on screen becomes it if the day changed meanwhile. */
  function anotar(bien: boolean, intentos: number) {
    if (!p) return;
    const hoy = diaHoy();
    registrarResultado(ayer ? dia : hoy, bien, intentos, $state.snapshot(p) as DiaProblema);
    // (the 04:00 timer had not fired yet: the page moves on to the day the answer went to)
    if (!ayer && hoy !== reloj.hoy) reloj.hoy = hoy;
  }

  function responder(r: RespuestaPractica) {
    registrarActividad('pregunta');
    anotar(r.bien, r.intentos);
  }

  // 04:00 with the page open: on to the new day (or, for «ayer», to the new yesterday)
  $effect(() => {
    const nuevo = ayer ? diaAnterior(reloj.hoy) : reloj.hoy;
    untrack(() => {
      if (!nuevo || nuevo === dia) return;
      dia = nuevo;
      p = null;
      item = null;
      finalP = false;
      fallosEjercicio = 0;
      void cargar();
    });
  });

  // an exercise of the book as the problem: its first check that settles it (right, or the second wrong one)
  let fallosEjercicio = 0;
  $effect(() => {
    const d = p;
    if (!d || d.k !== 'ejercicio' || ayer) return;
    return escuchar((e) => {
      if (e.tipo !== 'respuesta' || e.clase !== 'ejercicio' || e.id !== d.id) return;
      if (e.correcta) anotar(true, fallosEjercicio + 1);
      else if (++fallosEjercicio >= 2) anotar(false, fallosEjercicio);
    });
  });

  onMount(() => {
    void cargarProgresoXp();
    void cargar();
  });
</script>

<svelte:head><title>{ayer ? 'El problema de ayer' : 'Problema del día'} · Electrónica Práctica Avanzada</title></svelte:head>

<div class="problema" data-problema-dia={dia} data-estado={estado} data-resuelto={resultado ? (resultado.bien ? 'bien' : 'mal') : ''} style:--bloque={tono.relleno} style:--sobre-bloque={tono.sobre}>
  <header class="cab">
    <span class="icono" aria-hidden="true"><CalendarDays size={26} /></span>
    <div class="txt">
      <h1>{ayer ? 'El problema de ayer' : 'Problema del día'}</h1>
      <p class="fecha">{fecha.charAt(0).toUpperCase() + fecha.slice(1)}{#if p}{` · ${rotuloParte(p.parte)}`}{#if concepto}{` · ${concepto}`}{/if}{/if}</p>
    </div>
  </header>

  {#if !ayer}
    <p class="racha" data-racha-problemas={racha}>
      {#if racha > 1}{racha} días seguidos resolviendo el problema del día.{:else if racha === 1}Lleva un día resolviendo el problema del día: vuelva mañana para seguir la racha.{:else}Resuelva el problema de hoy para empezar una racha.{/if}
    </p>
  {/if}

  {#if estado === 'cargando'}
    <div class="cargando" aria-live="polite"><span class="punto"></span> Preparando el problema…</div>
  {:else if estado === 'error'}
    <p class="aviso" role="alert">No se pudo abrir el problema: {error}</p>
    <button type="button" class="t09-boton t09-contorno" onclick={cargar}>Reintentar</button>
  {:else if estado === 'nada'}
    <p class="aviso">{ayer ? 'Ayer no hubo problema del día.' : 'No hay problemas disponibles ahora mismo.'}</p>
  {:else if p}
    {#if resultado && !ayer}
      <div class="veredicto" class:bien={resultado.bien} data-veredicto-dia>
        <span class="sello" aria-hidden="true">{#if resultado.bien}<Check size={18} strokeWidth={3} />{:else}<X size={18} strokeWidth={3} />{/if}</span>
        <span>{resultado.bien ? (resultado.intentos > 1 ? 'Resuelto hoy, a la segunda.' : 'Resuelto hoy a la primera.') : 'Hoy no salió: aquí tiene la solución. Mañana, otro.'}</span>
      </div>
    {/if}
    {#if p.k === 'practica' && item}
      {#if ayer || (resultado && !finalP)}
        <!-- the solution with the values of that day -->
        <div class="sol-dia" data-solucion-dia>
          <Numerico {item} final={true} listo={false} pistas={null} onenviar={() => {}} semillaFija={p.semilla} />
        </div>
      {:else}
        <Practica {item} origen="problema-dia" etiqueta="Problema del día · Calcula" semilla={p.semilla} repetir={false} respuesta={null} onresponder={responder} bind:final={finalP} />
      {/if}
    {:else if p.k === 'ejercicio'}
      <TarjetaEjercicio label={p.id} />
    {/if}
    <nav class="enlaces" aria-label="Otros días">
      {#if ayer}
        <a class="t09-boton" href="#/problema" data-problema-hoy>El problema de hoy</a>
      {:else}
        <a class="enlace" href="#/problema/ayer" data-problema-ayer>La solución de ayer</a>
      {/if}
      <a class="enlace" href="#/practicar">Práctica inteligente</a>
    </nav>
  {/if}
</div>

<style>
  .problema {
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-width: 640px;
    margin: 0 auto;
    padding: 24px 24px 64px;
    font-family: var(--sans);
  }
  @media (max-width: 600px) {
    .problema {
      padding: 16px 16px 48px;
    }
  }
  .cab {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .icono {
    display: grid;
    flex: none;
    place-items: center;
    width: 52px;
    height: 52px;
    border-radius: 14px;
    background: var(--ambar-tinte);
    color: var(--ambar);
  }
  .txt {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  h1 {
    margin: 0;
    color: var(--titulos);
    font-family: var(--serif);
    font-size: clamp(24px, 3.4vw, 30px);
    line-height: 1.2;
  }
  .fecha {
    margin: 0;
    color: var(--tinta-suave);
    font-size: 15px;
  }
  .racha {
    margin: 0;
    padding: 10px 14px;
    border-radius: var(--radio-tarjeta-p);
    background: var(--ambar-tinte);
    color: var(--tinta);
    font-size: 15px;
  }
  .veredicto {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border-radius: var(--radio-tarjeta-p);
    background: color-mix(in srgb, var(--c-precaucion) 12%, var(--superficie));
    color: var(--tinta);
    font-weight: 600;
  }
  .veredicto.bien {
    background: color-mix(in srgb, var(--c-ejemplo) 14%, var(--superficie));
  }
  .veredicto .sello {
    display: grid;
    flex: none;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--c-precaucion);
    color: #fff;
  }
  .veredicto.bien .sello {
    background: var(--c-ejemplo);
  }
  :global(:root[data-tema='oscuro']) .veredicto .sello {
    color: #10161d;
  }
  .enlaces {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 18px;
    margin-top: 8px;
  }
  .enlace {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    color: var(--acento);
    font-weight: 600;
  }
  .aviso {
    margin: 0;
    color: var(--tinta-suave);
  }
  .cargando {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12vh 0;
    color: var(--tinta-suave);
  }
  .punto {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--acento);
    animation: latido 1s ease-in-out infinite;
  }
  @keyframes latido {
    50% {
      opacity: 0.25;
      transform: scale(0.7);
    }
  }
</style>
