<script lang="ts">
  // The toasts of 0.11 over any page: «+10 XP» (awards arriving together are added up into one pill that bumps),
  // and, one at a time, a new level or an achievement with its sound and vibration. Informative only: they never
  // take a tap (pointer-events: none) and never push the page (fixed). Transforms and opacity only; each toast
  // ends its animation and is removed. With prefers-reduced-motion they only fade.
  import { untrack } from 'svelte';
  import { avisos, retirar, type Aviso } from '../../lib/aprendizaje/avisos.svelte';
  import { retro } from '../../lib/aprendizaje/retroalimentacion';
  import { LOGRO } from '../../lib/aprendizaje/logros';
  import Medalla from './Medalla.svelte';

  let xp = $state(0);
  let golpe = $state(0);
  let verXp = $state(false);
  let grande = $state<Exclude<Aviso, { tipo: 'xp' }> | null>(null);
  let tXp: ReturnType<typeof setTimeout> | null = null;
  let tGrande: ReturnType<typeof setTimeout> | null = null;

  const DURA_XP = 1700;
  const DURA_GRANDE = 3400;

  function siguiente() {
    // (the timer that called this has fired: without clearing it, the effect below would think one is still pending
    // and never show a later notice of the session)
    tGrande = null;
    const a = avisos.lista.find((x): x is Exclude<Aviso, { tipo: 'xp' }> => x.tipo !== 'xp');
    if (!a) {
      grande = null;
      return;
    }
    retirar(a.id);
    grande = a;
    retro(a.tipo === 'nivel' ? 'nivel' : 'logro');
    tGrande = setTimeout(() => {
      grande = null;
      tGrande = setTimeout(siguiente, 300);
    }, DURA_GRANDE);
  }

  $effect(() => {
    const lista = avisos.lista;
    if (!lista.length) return;
    untrack(() => {
      const xps = lista.filter((a) => a.tipo === 'xp');
      if (xps.length) {
        const suma = xps.reduce((n, a) => n + (a.tipo === 'xp' ? a.xp : 0), 0);
        xp = (verXp ? xp : 0) + suma;
        golpe++;
        verXp = true;
        if (tXp) clearTimeout(tXp);
        tXp = setTimeout(() => (verXp = false), DURA_XP);
        for (const a of xps) retirar(a.id);
      }
      if (!grande && !tGrande) siguiente();
    });
  });

  $effect(() => () => {
    if (tXp) clearTimeout(tXp);
    if (tGrande) clearTimeout(tGrande);
  });

  const logro = $derived(grande?.tipo === 'logro' ? LOGRO.get(grande.logro) : undefined);
  const texto = $derived(
    grande?.tipo === 'nivel' ? `Nivel ${grande.nivel}: ${grande.nombre}` : logro ? `Logro desbloqueado: ${logro.nombre}` : verXp ? `Más ${xp} XP` : '',
  );
</script>

<div class="celebraciones" data-celebraciones>
  <p class="solo-lector" role="status" aria-live="polite">{texto}</p>
  {#if verXp}
    {#key golpe}
      <div class="xp" data-aviso-xp={xp} aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 2.5L5 13.5h6.5l-1 8 8.5-11h-6.5z" fill="currentColor" /></svg>
        +{xp} XP
      </div>
    {/key}
  {/if}
  {#if grande}
    {#key grande.id}
      <div class="grande" class:nivel={grande.tipo === 'nivel'} data-aviso={grande.tipo} aria-hidden="true">
        {#if grande.tipo === 'nivel'}
          <span class="anillo"><span>{grande.nivel}</span></span>
          <span class="txt"><span class="rot">¡Sube de nivel!</span><strong>Nivel {grande.nivel} · {grande.nombre}</strong></span>
        {:else if logro}
          <Medalla logro={logro.id} desbloqueado tam={48} />
          <span class="txt"><span class="rot">Logro desbloqueado</span><strong>{logro.nombre}</strong></span>
        {/if}
      </div>
    {/key}
  {/if}
</div>

<style>
  .celebraciones {
    position: fixed;
    top: calc(env(safe-area-inset-top) + 10px);
    left: 50%;
    z-index: 70;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    width: min(380px, calc(100vw - 32px));
    transform: translateX(-50%);
    pointer-events: none;
    font-family: var(--sans);
  }
  .xp {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    border-radius: 999px;
    background: var(--ambar);
    color: var(--sobre-ambar);
    box-shadow: var(--sombra-alta);
    font-size: 16px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    animation: entrar-xp 1.7s ease both;
  }
  @keyframes entrar-xp {
    0% {
      opacity: 0;
      transform: translateY(-12px) scale(0.8);
    }
    12% {
      opacity: 1;
      transform: translateY(0) scale(1.08);
    }
    22% {
      transform: translateY(0) scale(1);
    }
    80% {
      opacity: 1;
      transform: translateY(0);
    }
    100% {
      opacity: 0;
      transform: translateY(-8px);
    }
  }
  .grande {
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
    padding: 12px 16px;
    border: 1px solid var(--linea);
    border-radius: var(--radio-tarjeta);
    background: var(--superficie);
    color: var(--tinta);
    box-shadow: var(--sombra-alta);
    animation: entrar-grande 3.4s ease both;
  }
  @keyframes entrar-grande {
    0% {
      opacity: 0;
      transform: translateY(-16px) scale(0.94);
    }
    8% {
      opacity: 1;
      transform: translateY(0) scale(1.02);
    }
    14% {
      transform: translateY(0) scale(1);
    }
    90% {
      opacity: 1;
      transform: translateY(0);
    }
    100% {
      opacity: 0;
      transform: translateY(-10px);
    }
  }
  .txt {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .rot {
    color: var(--tinta-suave);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  strong {
    color: var(--titulos);
    font-family: var(--titular);
    font-size: 19px;
    line-height: 1.25;
  }
  .anillo {
    display: grid;
    flex: none;
    place-items: center;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: var(--ambar);
    color: var(--sobre-ambar);
    font-size: 21px;
    font-weight: 800;
  }
  .anillo span {
    animation: girar-num 0.6s 0.15s cubic-bezier(0.3, 1.5, 0.5, 1) both;
  }
  @keyframes girar-num {
    from {
      transform: scale(0.4) rotate(-40deg);
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .xp {
      animation-name: fundido;
    }
    .grande {
      animation-name: fundido;
    }
    .anillo span {
      animation: none;
    }
    @keyframes fundido {
      0%,
      100% {
        opacity: 0;
      }
      10%,
      85% {
        opacity: 1;
      }
    }
  }
</style>
