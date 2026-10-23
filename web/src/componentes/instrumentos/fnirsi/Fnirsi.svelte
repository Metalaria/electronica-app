<script lang="ts">
  // The FNIRSI 2C53T drawn in SVG (body, buttons, BNC and banana jacks) with its screen as a canvas that is
  // redrawn only when a capture or a setting changes. Buttons as in section 21.3: MOVE, SELECT, TRIGGER, PRM,
  // CH1, CH2, AUTO, SAVE, MENU, power, the arrow pad and RUN/STOP in its centre.
  import { onMount } from 'svelte';
  import type { Fnirsi } from './logica.svelte.ts';
  import { dibujar, ANCHO, ALTO, type Zona } from './dibujo';
  import { DIV_H, DIV_V } from '../motor/osciloscopio.ts';
  import { pulsacion } from '../ui/pulsacion';
  import { limitarDds } from '../motor/generador.ts';
  import type { Borne } from '../motor/dmm.ts';

  let {
    f,
    alAuto,
  }: {
    f: Fnirsi;
    /** AUTO needs the signals (the bench provides them). */
    alAuto: () => void;
  } = $props();

  let lienzo: HTMLCanvasElement | undefined = $state();
  let caja: HTMLDivElement | undefined = $state();
  let tamPx = $state(0);
  let zonas: Zona[] = [];

  // Redraw when anything the screen shows changes (the effect tracks what dibujar reads).
  $effect(() => {
    const c = lienzo;
    const w = tamPx;
    if (!c || !w) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const W = Math.round(w * dpr);
    const H = Math.round((w * ALTO) / ANCHO * dpr);
    if (c.width !== W) c.width = W;
    if (c.height !== H) c.height = H;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(W / ANCHO, 0, 0, H / ALTO, 0, 0);
    zonas = dibujar(ctx, f);
  });

  onMount(() => {
    if (!caja) return;
    const ro = new ResizeObserver(() => {
      tamPx = lienzo?.getBoundingClientRect().width ?? 0;
    });
    ro.observe(caja);
    tamPx = lienzo?.getBoundingClientRect().width ?? 0;
    return () => ro.disconnect();
  });

  // ---------------------------------------------------------------- touching the screen
  let arrastre: 'a' | 'b' | null = null;
  function logico(ev: PointerEvent): [number, number] {
    const r = lienzo!.getBoundingClientRect();
    return [((ev.clientX - r.left) / r.width) * ANCHO, ((ev.clientY - r.top) / r.height) * ALTO];
  }
  function tocar(ev: PointerEvent) {
    if (!lienzo) return;
    const [x, y] = logico(ev);
    for (const z of zonas) {
      if (x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h) {
        const [tipo, valor] = z.accion.split(':');
        if (tipo === 'item') {
          const i = Number(valor);
          if (f.item === i) f.itemsMenu()[i]?.cambiar(x > z.x + z.w / 2 ? 1 : -1);
          f.item = i;
        } else if (tipo === 'modo') f.elegirModo(valor as 'osc' | 'dmm' | 'gen');
        else if (tipo === 'gen') {
          const i = Number(valor);
          if (f.itemGen === i) f.itemsGen()[i]?.cambiar(x > z.x + z.w / 2 ? 1 : -1);
          f.itemGen = i;
        }
        return;
      }
    }
    // Cursors: grab the nearest one.
    if (f.modo === 'osc' && f.cursores !== 'no') {
      const fft = f.mates === 'fft1' || f.mates === 'fft2';
      const div = f.cursores === 'tiempo' || fft ? (x - 10 - 150) / 25 : (18 + 100 - y) / 25;
      arrastre = Math.abs(div - f.cur.a) <= Math.abs(div - f.cur.b) ? 'a' : 'b';
      lienzo.setPointerCapture(ev.pointerId);
      mover(ev);
    }
  }
  function mover(ev: PointerEvent) {
    if (!arrastre || !lienzo) return;
    const [x, y] = logico(ev);
    const fft = f.mates === 'fft1' || f.mates === 'fft2';
    const tiempo = f.cursores === 'tiempo' || fft;
    let div = tiempo ? (x - 10 - 150) / 25 : (18 + 100 - y) / 25;
    const lim = tiempo ? DIV_H / 2 : DIV_V / 2;
    div = Math.max(-lim, Math.min(lim, Math.round(div * 25) / 25));
    f.cur = { ...f.cur, [arrastre]: div };
  }

  function guardar() {
    if (!lienzo) return;
    const a = document.createElement('a');
    a.href = lienzo.toDataURL('image/png');
    a.download = `2C53T-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`;
    a.click();
  }

  const BOTONES = [
    { id: 'move', x: 22, y: 288, t: 'MOVE', sub: 'C1⇄C2', ayuda: 'MOVE: canal activo; mantenido, mover trazas con las flechas' },
    { id: 'select', x: 100, y: 288, t: 'SELECT', sub: '', ayuda: 'SELECT: funciones (Math, cursores, X-Y) o siguiente opción' },
    { id: 'trigger', x: 178, y: 288, t: 'TRIGGER', sub: '', ayuda: 'TRIGGER: modo, fuente, flanco y nivel del disparo' },
    { id: 'prm', x: 256, y: 288, t: 'PRM', sub: '', ayuda: 'PRM: medidas automáticas' },
    { id: 'ch1', x: 22, y: 350, t: 'CH1', sub: '', ayuda: 'CH1: activa el canal 1 y abre su menú' },
    { id: 'auto', x: 22, y: 408, t: 'AUTO', sub: '', ayuda: 'AUTO: ajuste automático de escalas y disparo' },
    { id: 'ch2', x: 256, y: 350, t: 'CH2', sub: '', ayuda: 'CH2: activa el canal 2 y abre su menú' },
    { id: 'save', x: 256, y: 408, t: 'SAVE', sub: '', ayuda: 'SAVE: guarda la pantalla como imagen' },
  ];

  function accion(id: string, larga = false) {
    switch (id) {
      case 'move':
        if (larga) f.moveLargo();
        else f.pulsarMove();
        break;
      case 'select':
        f.pulsarSelect();
        break;
      case 'trigger':
        f.pulsarTrigger();
        break;
      case 'prm':
        f.pulsarPrm();
        break;
      case 'ch1':
        f.pulsarCanal(0);
        break;
      case 'ch2':
        f.pulsarCanal(1);
        break;
      case 'auto':
        alAuto();
        break;
      case 'save':
        guardar();
        break;
      case 'menu':
        f.pulsarMenu();
        break;
      case 'power':
        f.encendido = !f.encendido;
        break;
      case 'run':
        f.pulsarRun();
        break;
      case 'arriba':
        f.vertical(1);
        break;
      case 'abajo':
        f.vertical(-1);
        break;
      case 'izq':
        f.horizontal(-1);
        break;
      case 'der':
        f.horizontal(1);
        break;
    }
  }

  const FLECHAS = [
    { id: 'arriba', x: 147, y: 352, d: 'M 170 360 l -9 12 h 18 z', ayuda: '▲' },
    { id: 'abajo', x: 147, y: 452, d: 'M 170 486 l -9 -12 h 18 z', ayuda: '▼' },
    { id: 'izq', x: 97, y: 402, d: 'M 105 425 l 12 -9 v 18 z', ayuda: '◄' },
    { id: 'der', x: 197, y: 402, d: 'M 235 425 l -12 -9 v 18 z', ayuda: '►' },
  ];

  const BORNES: { id: Borne | 'COM'; x: number; t: string }[] = [
    { id: 'A', x: 60, t: '10A' },
    { id: 'mA', x: 130, t: 'mA' },
    { id: 'COM', x: 210, t: 'COM' },
    { id: 'V', x: 280, t: 'VΩ⊣⊢' },
  ];

  // Direct entry of the generator's frequency and amplitude (a convenience of the app).
  function teclear(campo: 'frecuencia' | 'amplitud', ev: Event) {
    const v = Number((ev.currentTarget as HTMLInputElement).value.replace(',', '.'));
    if (Number.isFinite(v)) f.dds = limitarDds({ ...f.dds, [campo]: v });
  }
</script>

<div class="fnirsi" bind:this={caja}>
  <svg class="cuerpo" viewBox="0 0 340 660" role="group" aria-label="FNIRSI 2C53T: osciloscopio, multímetro y generador">
    <!-- BNC connectors on the top edge -->
    {#each [['CH1', 90], ['CH2', 170], ['DDS', 250]] as [t, x] (t)}
      <rect x={Number(x) - 13} y="0" width="26" height="12" rx="3" fill="#b9bec4" />
      <text x={x} y="30" font-size="7" fill="#9aa" text-anchor="middle" font-family="var(--sans)">{t}</text>
    {/each}
    <rect x="0" y="8" width="340" height="652" rx="34" fill="#3aa3dd" />
    <rect x="8" y="12" width="324" height="640" rx="28" fill="#25282d" />
    <text x="28" y="38" font-size="15" font-weight="700" fill="#f2f2f2" font-family="var(--sans)" font-style="italic" letter-spacing="1">FNIRSI</text>
    <text x="312" y="38" font-size="13" font-weight="700" fill="#f2f2f2" text-anchor="end" font-family="var(--sans)">2C53T</text>
    <rect x="16" y="44" width="308" height="235" rx="6" fill="#0b0c0e" />

    {#each BOTONES as b (b.id)}
      <g class="boton" role="button" tabindex="0" aria-label={b.ayuda} use:pulsacion={{ corta: () => accion(b.id), larga: b.id === 'move' ? () => accion(b.id, true) : undefined }}>
        <title>{b.ayuda}</title>
        <rect class="tecla" x={b.x} y={b.y} width="62" height="44" rx="9" fill="#33373d" stroke="#4b5058" />
        <text x={b.x + 31} y={b.y + (b.sub ? 20 : 27)} font-size="11.5" font-weight="700" text-anchor="middle" fill="#eef" font-family="var(--sans)">{b.t}</text>
        {#if b.sub}<text x={b.x + 31} y={b.y + 35} font-size="8" text-anchor="middle" fill="#9ab" font-family="var(--sans)">{b.sub}</text>{/if}
      </g>
    {/each}

    <!-- arrow pad -->
    <rect x="92" y="346" width="156" height="156" rx="34" fill="#1f2226" stroke="#3aa3dd" stroke-width="3" />
    {#each FLECHAS as fl (fl.id)}
      <g class="boton" role="button" tabindex="0" aria-label={fl.ayuda} use:pulsacion={{ corta: () => accion(fl.id), repetir: true }}>
        <rect class="tecla" x={fl.x} y={fl.y} width="46" height="46" rx="8" fill="#2c3036" />
        <path d={fl.d} fill="#f2f2f2" />
      </g>
    {/each}
    <g class="boton" role="button" tabindex="0" aria-label="RUN/STOP" use:pulsacion={{ corta: () => accion('run') }}>
      <rect class="tecla" x="144" y="398" width="52" height="54" rx="9" fill="#2aa7e6" />
      <path d="M 158 413 v 24 M 164 413 v 24" stroke="#fff" stroke-width="3.5" />
      <path d="M 171 413 l 15 12 l -15 12 z" fill="#fff" />
    </g>

    <!-- power and menu -->
    <g class="boton" role="button" tabindex="0" aria-label={f.encendido ? 'Apagar' : 'Encender'} use:pulsacion={{ corta: () => accion('power') }}>
      <circle class="tecla" cx="53" cy="490" r="23" fill="#2d1f22" stroke="#e04848" stroke-width="2.5" />
      <path d="M 46 482 a 10 10 0 1 0 14 0 M 53 476 v 12" stroke="#e04848" stroke-width="2.6" fill="none" stroke-linecap="round" />
    </g>
    <g class="boton" role="button" tabindex="0" aria-label="MENU: osciloscopio, multímetro o generador" use:pulsacion={{ corta: () => accion('menu') }}>
      <circle class="tecla" cx="287" cy="490" r="23" fill="#2d2519" stroke="#f08a24" stroke-width="2.5" />
      <text x="287" y="494" font-size="10.5" font-weight="700" text-anchor="middle" fill="#f08a24" font-family="var(--sans)">MENU</text>
    </g>

    <!-- banana jacks of the multimeter -->
    <text x="95" y="540" font-size="7" fill="#aab" text-anchor="middle" font-family="var(--sans)">10A MAX FUSED · 1A MAX FUSED</text>
    <text x="245" y="540" font-size="7" fill="#aab" text-anchor="middle" font-family="var(--sans)">CAT II 600V</text>
    {#each BORNES as j (j.id)}
      {@const rojo = j.id === f.borne}
      <g
        class="borne"
        role="button"
        tabindex={j.id === 'COM' ? -1 : 0}
      aria-disabled={j.id === 'COM' ? 'true' : undefined}
        aria-label={j.id === 'COM' ? 'Borne COM' : `Punta roja del multímetro al borne ${j.t}`}
        aria-pressed={j.id === 'COM' ? undefined : rojo}
        onclick={() => j.id !== 'COM' && (f.borne = j.id)}
        onkeydown={(e) => e.key === 'Enter' && j.id !== 'COM' && (f.borne = j.id)}
      >
        <circle cx={j.x} cy="572" r="24" fill="transparent" />
        <circle cx={j.x} cy="572" r="16" fill="#111" stroke="#3aa3dd" stroke-width="4" />
        {#if rojo || j.id === 'COM'}
          <circle cx={j.x} cy="572" r="10" fill={j.id === 'COM' ? '#1b1b1b' : '#d0262e'} stroke={j.id === 'COM' ? '#555' : '#ff6b6b'} stroke-width="2" />
        {:else}<circle cx={j.x} cy="572" r="5" fill="#000" />{/if}
        <text x={j.x} y="606" font-size="10.5" font-weight="700" text-anchor="middle" fill="#f2f2f2" font-family="var(--sans)">{j.t}</text>
      </g>
    {/each}
    <rect x="8" y="620" width="324" height="32" rx="0" fill="#3aa3dd" opacity="0.9" />
    <text x="170" y="641" font-size="12" font-weight="700" text-anchor="middle" fill="#0d2230" font-family="var(--sans)">Oscilloscope &amp; Multimeter</text>
  </svg>
  <canvas
    bind:this={lienzo}
    class="pantalla"
    aria-label="Pantalla del FNIRSI 2C53T"
    onpointerdown={tocar}
    onpointermove={mover}
    onpointerup={() => (arrastre = null)}
    onpointercancel={() => (arrastre = null)}
  ></canvas>
</div>
{#if f.modo === 'gen' && f.encendido}
  <div class="teclado">
    <label>Frecuencia (Hz) <input type="text" inputmode="decimal" value={f.dds.frecuencia} onchange={(e) => teclear('frecuencia', e)} /></label>
    <label>Amplitud (V) <input type="text" inputmode="decimal" value={String(f.dds.amplitud).replace('.', ',')} onchange={(e) => teclear('amplitud', e)} /></label>
  </div>
{/if}

<style>
  .fnirsi {
    position: relative;
    width: 100%;
    aspect-ratio: 340 / 660;
    user-select: none;
    -webkit-user-select: none;
    touch-action: manipulation;
  }
  .cuerpo {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .pantalla {
    position: absolute;
    left: calc(20 / 340 * 100%);
    top: calc(46 / 660 * 100%);
    width: calc(300 / 340 * 100%);
    aspect-ratio: 4 / 3;
    border-radius: 2px;
    touch-action: none;
    cursor: crosshair;
  }
  .boton,
  .borne {
    cursor: pointer;
    outline: none;
  }
  .boton:focus-visible .tecla,
  .borne:focus-visible circle:nth-of-type(2) {
    stroke: #ffd34d;
    stroke-width: 3;
  }
  .boton:global(.pulsado) .tecla {
    filter: brightness(1.35);
  }
  .teclado {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 8px;
    font-family: var(--sans);
    font-size: 13px;
    color: var(--tinta-suave);
  }
  .teclado label {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .teclado input {
    width: 7em;
    min-height: 36px;
    padding: 0 8px;
    border: 1px solid var(--linea);
    border-radius: 8px;
    background: var(--superficie);
    font-family: var(--mono);
  }
</style>
