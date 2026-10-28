<script lang="ts">
  // The two instruments of a bench, with what each one is reading under it: side by side when the
  // surrounding container (`container-type: inline-size`) is 640 px or wider, as tabs otherwise. Shared by
  // the bench page, the breadboard and the editor (0.10).
  import type { Banco } from '../banco.svelte.ts';
  import BrymenVista from '../brymen/Brymen.svelte';
  import FnirsiVista from '../fnirsi/Fnirsi.svelte';
  import { formatoSI } from '../../grafica';
  import type { GuiaBrymen, GuiaFnirsi } from '../guia';

  let {
    b,
    alAuto,
    pestana = $bindable('fnirsi'),
    guiaBm = null,
    guiaFn = null,
  }: { b: Banco; alAuto: () => void; pestana?: 'brymen' | 'fnirsi'; guiaBm?: GuiaBrymen | null; guiaFn?: GuiaFnirsi | null } = $props();
  let ayuda = $state<'brymen' | 'fnirsi' | null>(null);

  const infoOsc = $derived.by(() => {
    const f = b.fnirsi;
    const W = 12 * f.sDiv;
    const fs = Math.min(250e6, 1000 / W);
    return `Muestreo real ${formatoSI(fs, 'S/s', 3)} (1 000 puntos en ${formatoSI(W, 's', 3)}): sin alias hasta ${formatoSI(fs / 2, 'Hz', 3)}`;
  });
  const infoBm = $derived.by(() => {
    void b.tic;
    const l = b.brymen.pantalla.principal;
    if (!l || l.valor === null) return '';
    const inc = l.incertidumbre;
    const base = l.unidad.replace(/^[kMmµn](?=[VAΩFHS])/, '');
    return `Brymen: ${l.texto.replace('.', ',')} ${l.unidad}${inc !== null ? ` ± ${formatoSI(inc, base, 2)} según el manual` : ''}`;
  });
</script>

<div class="aparatos">
  <div class="pestanas" role="tablist" aria-label="Instrumentos">
    <button role="tab" aria-selected={pestana === 'brymen'} onclick={() => (pestana = 'brymen')}>Brymen BM869s</button>
    <button role="tab" aria-selected={pestana === 'fnirsi'} onclick={() => (pestana = 'fnirsi')}>FNIRSI 2C53T</button>
  </div>
  <div class="par">
    <figure class="instrumento brymen" class:oculto={pestana !== 'brymen'}>
      <BrymenVista m={b.brymen} guia={guiaBm} />
      <figcaption>
        {infoBm || 'Brymen BM869s · 50 000 cuentas · 10 MΩ'}
        <button type="button" class="ayuda-boton" aria-expanded={ayuda === 'brymen'} aria-label="Ayuda del Brymen" onclick={() => (ayuda = ayuda === 'brymen' ? null : 'brymen')}>?</button>
      {#if ayuda === 'brymen'}
        <div class="ayuda">
          <p><strong>Selector:</strong> gírelo (arrastre o toque una posición) a lo que quiere medir: V⎓ continua, V∿ alterna, Ω resistencia (SELECT pasa a continuidad), ⊣⊢ capacidad o diodo, A mA y µA corriente.</p>
          <p><strong>Bornes:</strong> la punta negra siempre en COM; la roja en ΩV para tensión, resistencia y capacidad, en mA µA hasta 0,44 A y en A hasta 10 A (toque un borne para pasarla).</p>
          <p><strong>Tensión</strong> en paralelo (las puntas en los dos puntos); <strong>corriente</strong> en serie (abra el circuito y ciérrelo con el polímetro); <strong>resistencia</strong> sin alimentación.</p>
          <p><strong>Botones:</strong> SELECT cambia la función, RANGE fija el rango (mantenido, vuelve a AUTO), Δ relativo, HOLD congela, REC máximo/mínimo/media, CREST picos.</p>
        </div>
      {/if}
      </figcaption>
    </figure>
    <figure class="instrumento fnirsi" class:oculto={pestana !== 'fnirsi'}>
      <FnirsiVista f={b.fnirsi} {alAuto} guia={guiaFn} />
      <figcaption>
        {b.fnirsi.modo === 'osc' ? infoOsc : b.fnirsi.modo === 'gen' ? 'Generador DDS: 1 Hz … 50 kHz, 0,1 … 3 V (de 0 a la amplitud)' : 'Multímetro del 2C53T: 19 999 cuentas'}
        <button type="button" class="ayuda-boton" aria-expanded={ayuda === 'fnirsi'} aria-label="Ayuda del FNIRSI" onclick={() => (ayuda = ayuda === 'fnirsi' ? null : 'fnirsi')}>?</button>
      {#if ayuda === 'fnirsi'}
        <div class="ayuda">
          <p><strong>MENU</strong> elige osciloscopio, multímetro o generador; el botón rojo lo enciende.</p>
          <p><strong>Osciloscopio:</strong> la pinza de masa a la masa del circuito y la punta de la sonda en el punto. <strong>AUTO</strong> ajusta base de tiempos, V/div y disparo; las flechas los cambian a mano (◄► tiempo, ▲▼ tensión del canal activo), TRIGGER el disparo, PRM muestra frecuencia, periodo, Vpp y media, RUN/STOP congela.</p>
          <p><strong>CH1 / CH2:</strong> encienden el canal y abren su menú: acoplamiento, ×1/×10 (debe coincidir con el conmutador de la sonda), invertir.</p>
          <p><strong>Generador:</strong> forma, frecuencia y amplitud (de 0 a la amplitud); sus dos puntas alimentan el circuito.</p>
        </div>
      {/if}
      </figcaption>
    </figure>
  </div>
</div>

<style>
  .aparatos {
    min-width: 0;
  }
  .pestanas {
    display: flex;
    gap: 6px;
    margin-bottom: 8px;
  }
  .pestanas button {
    flex: 1;
    min-height: 44px;
    border: 1px solid var(--linea);
    border-radius: 10px;
    background: var(--superficie);
    font-family: var(--sans);
    font-weight: 600;
  }
  .pestanas button[aria-selected='true'] {
    border-color: var(--acento);
    color: var(--acento);
    background: var(--acento-tinte);
  }
  .par {
    display: flex;
    gap: 16px;
    align-items: flex-start;
    justify-content: center;
  }
  .instrumento {
    margin: 0;
    min-width: 0;
  }
  .instrumento.brymen {
    flex: 0 1 300px;
  }
  .instrumento.fnirsi {
    flex: 0 1 360px;
  }
  .oculto {
    display: none;
  }
  .ayuda-boton {
    width: 26px;
    height: 26px;
    margin-left: 6px;
    border: 1px solid var(--linea);
    border-radius: 50%;
    background: var(--superficie);
    color: var(--acento);
    font: 700 13px var(--sans);
    vertical-align: middle;
  }
  .ayuda {
    margin-top: 6px;
    text-align: left;
    padding: 8px 10px;
    border: 1px solid var(--linea);
    border-radius: 10px;
    background: var(--superficie-2);
    font-family: var(--sans);
    font-size: 13px;
    line-height: 1.4;
    color: var(--tinta);
  }
  .ayuda p {
    margin: 0 0 6px;
  }
  figcaption {
    margin-top: 6px;
    font-family: var(--sans);
    font-size: 12.5px;
    color: var(--tinta-suave);
    text-align: center;
    line-height: 1.35;
  }

  /* Two instruments side by side as soon as they fit; the tabs only on narrow screens. */
  @container (min-width: 640px) {
    .pestanas {
      display: none;
    }
    .oculto {
      display: block;
    }
    .instrumento.brymen {
      flex: 0 1 290px;
    }
  }
  @container (min-width: 940px) {
    .par {
      gap: 12px;
    }
  }
</style>
