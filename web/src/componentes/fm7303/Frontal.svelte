<script lang="ts">
  // The radio as the reader uses it: frequency display (SC3610D), needle signal meter, power and stereo LEDs,
  // tuning and volume, the switches K4, K1 (AFC), K2 (Mute), K3 (St/Mon), the antenna, and what is heard.
  import Volume2 from '@lucide/svelte/icons/volume-2';
  import type { EstadoKit } from './estado.svelte';
  import { fx, mhz, voltios } from './formato';
  import Interruptor from './ui/Interruptor.svelte';
  import Deslizador from './ui/Deslizador.svelte';
  import Cita from './ui/Cita.svelte';

  let { k, compacto = false }: { k: EstadoKit; compacto?: boolean } = $props();

  const r = $derived(k.radio);
  const citas = $derived(k.kit.citas);
  // Needle: 0–5 V over 100° of arc.
  const angulo = $derived(-50 + (Math.min(5, Math.max(0, r.vMedidor)) / 5) * 100);
  const textoDisplay = $derived(r.display == null ? '' : fx(r.display / 1e6, 1));
</script>

<div class="frontal" class:compacto data-frontal>
  <div class="cara">
    <div class="display" class:apagado={r.display == null} aria-label={r.display == null ? 'Display apagado' : `Display: ${mhz(r.display)}`} data-display={r.display == null ? '' : (r.display / 1e6).toFixed(2)}>
      <span class="cifras">{textoDisplay || (r.alimentada ? '' : '')}</span><span class="unidad">{r.display == null ? '' : 'MHz'}</span>
    </div>
    <svg class="medidor" viewBox="0 0 120 70" role="img" aria-label={`Medidor de señal: ${voltios(r.vMedidor)}`} data-medidor={r.vMedidor.toFixed(3)}>
      <path d="M 21.7 31.9 A 50 50 0 0 1 98.3 31.9" fill="none" stroke="currentColor" stroke-opacity="0.35" stroke-width="2" />
      {#each [0, 1, 2, 3, 4, 5] as v (v)}
        {@const a = ((-50 + v * 20) * Math.PI) / 180}
        <line x1={60 + 44 * Math.sin(a)} y1={64 - 44 * Math.cos(a)} x2={60 + 50 * Math.sin(a)} y2={64 - 50 * Math.cos(a)} stroke="currentColor" stroke-width="1.4" />
        <text x={60 + 36 * Math.sin(a)} y={66 - 36 * Math.cos(a)} font-size="7" text-anchor="middle" fill="currentColor">{v}</text>
      {/each}
      <line class="aguja" x1="60" y1="64" x2="60" y2="16" style:transform={`rotate(${angulo}deg)`} />
      <circle cx="60" cy="64" r="3.5" fill="currentColor" />
    </svg>
    <div class="leds">
      <span class="led verde" class:on={r.alimentada} title="D5: encendido">D5</span>
      <span class="led rojo" class:on={r.estereo} class:parpadeo={r.parpadeo} title="D4: estéreo" data-estereo={r.estereo ? 'si' : 'no'}>ST</span>
    </div>
    <div class="lecturas">
      <span>Medidor {voltios(r.vMedidor)}</span>
      <Cita cita={citas['medidor_5v']} corto />
    </div>
  </div>

  <Deslizador id="dial" etiqueta="Sintonía (condensador variable)" bind:valor={k.c.dial} paso={0.0005} fino={0.0025}
    texto={r.display != null ? mhz(r.display, 2) : 'sin lectura'} />
  {#if !compacto}
    <Deslizador id="volumen" etiqueta="Volumen (W4)" bind:valor={k.c.volumen} paso={0.01} fino={0.05} texto={`${Math.round(k.c.volumen * 100)} %`} />
  {/if}
  <div class="interruptores">
    <Interruptor id="k4" etiqueta="K4" si="encendida" no="apagada" bind:activo={k.c.k4} titulo="Encendido (en el potenciómetro de volumen)" />
    <Interruptor id="k1" etiqueta="K1 AFC" bind:activo={k.c.k1} />
    <Interruptor id="k2" etiqueta="K2 Mute" bind:activo={k.c.k2} />
    <Interruptor id="k3" etiqueta="K3" si="mono" no="estéreo" bind:activo={k.c.k3} titulo="ON: detiene el VCO y fuerza el mono" />
    <Interruptor id="antena" etiqueta="Antena" si="extendida" no="recogida" bind:activo={k.c.antena} />
  </div>
  <p class="oye" aria-live="polite" data-oye><Volume2 size={16} aria-hidden="true" /> {r.descripcion}</p>
</div>

<style>
  .frontal {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .cara {
    display: grid;
    grid-template-columns: auto 1fr auto;
    grid-template-rows: auto auto;
    align-items: center;
    gap: 6px 10px;
    padding: 10px 12px;
    border-radius: 12px;
    background: #20262d;
    color: #d8dde2;
  }
  .display {
    display: flex;
    align-items: baseline;
    gap: 4px;
    min-width: 116px;
    padding: 6px 10px;
    border-radius: 6px;
    background: #0d1a12;
    color: #63f08a;
    font-family: 'Source Code Pro', ui-monospace, monospace;
    text-shadow: 0 0 6px rgba(99, 240, 138, 0.45);
  }
  .display.apagado {
    color: #233328;
    text-shadow: none;
  }
  .cifras {
    min-width: 4.2ch;
    font-size: 26px;
    font-weight: 600;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .unidad {
    font-size: 12px;
  }
  .medidor {
    width: 100%;
    max-width: 150px;
    height: auto;
    justify-self: center;
    color: #e9e3cf;
  }
  .aguja {
    stroke: #ff6b4a;
    stroke-width: 1.8;
    transform-origin: 60px 64px;
    transition: transform 0.25s ease-out;
  }
  @media (prefers-reduced-motion: reduce) {
    .aguja {
      transition: none;
    }
  }
  .leds {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .led {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    font-weight: 700;
    color: #8b949e;
  }
  .led::before {
    content: '';
    width: 11px;
    height: 11px;
    border-radius: 50%;
    background: #3a3f45;
  }
  .led.verde.on::before {
    background: #3ee06b;
    box-shadow: 0 0 8px #3ee06b;
  }
  .led.rojo.on::before {
    background: #ff4b3e;
    box-shadow: 0 0 8px #ff4b3e;
  }
  .led.rojo.on.parpadeo::before {
    animation: parpadeo 0.7s steps(2) infinite;
  }
  @keyframes parpadeo {
    50% {
      background: #3a3f45;
      box-shadow: none;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .led.rojo.on.parpadeo::before {
      animation: none;
      opacity: 0.6;
    }
  }
  .lecturas {
    grid-column: 1 / -1;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    font-size: 12.5px;
    font-variant-numeric: tabular-nums;
  }
  .interruptores {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .oye {
    display: flex;
    gap: 6px;
    align-items: flex-start;
    margin: 2px 0 0;
    padding: 8px 10px;
    border-radius: 10px;
    background: var(--superficie-2);
    font-size: 13.5px;
    line-height: 1.35;
  }
  .oye :global(svg) {
    flex: none;
    margin-top: 2px;
    color: var(--acento);
  }
</style>
