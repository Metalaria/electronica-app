<script lang="ts">
  // The Brymen BM869s drawn in SVG (not a photo): red holster, LCD with the six-digit main display, the
  // four-digit secondary display and the 41-segment bargraph, the six buttons, the rotary selector (tap a
  // position or drag the knob; arrow keys when focused) and the four jacks (tap a jack to move the red lead).
  import { BM_POSICIONES, type Borne } from '../motor/dmm.ts';
  import type { Brymen } from './logica.svelte.ts';
  import { celdas, segmentos } from './siete';
  import { pulsacion } from '../ui/pulsacion';
  import { prepararAudio, pitido } from '../audio';
  import type { GuiaBrymen } from '../guia';

  let { m, guia = null }: { m: Brymen; /** Tutor (0.10): the dial position and the jack to light up. */ guia?: GuiaBrymen | null } = $props();

  const CX = 150;
  const CY = 424;
  const R_ROTULO = 113;
  const ANG0 = -120;
  const PASO = 24;
  const angulo = (i: number) => ANG0 + i * PASO;
  const rad = (g: number) => (g * Math.PI) / 180;

  const pan = $derived(m.pantalla);
  const apagado = $derived(m.posicion.id === 'off');

  const SEG = segmentos(24, 50, 5.4);
  const SEG2 = segmentos(12, 22, 2.8);
  const principal = $derived(celdas(pan.mensaje ?? pan.principal?.texto ?? '', 6));
  const secundaria = $derived(celdas(pan.secundaria?.texto ?? '', 5));

  // Units shown at the right of the main digits.
  const unidad = $derived(pan.principal?.unidad ?? '');
  const unidad2 = $derived(pan.secundaria?.unidad ?? '');

  // ---------------------------------------------------------------- selector by dragging
  let svg: SVGSVGElement | undefined = $state();
  let arrastrando = false;

  function posDesdePuntero(ev: PointerEvent): number | null {
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    const x = ((ev.clientX - r.left) / r.width) * 300;
    const y = ((ev.clientY - r.top) / r.height) * 640;
    const g = (Math.atan2(x - CX, -(y - CY)) * 180) / Math.PI;
    const i = Math.round((g - ANG0) / PASO);
    if (i < -1 || i > BM_POSICIONES.length) return null;
    return Math.max(0, Math.min(BM_POSICIONES.length - 1, i));
  }
  function girarA(i: number) {
    const antes = m.beepJack;
    m.girar(i);
    if (m.beepJack !== antes) pitido(400);
  }
  function abajo(ev: PointerEvent) {
    prepararAudio();
    arrastrando = true;
    (ev.currentTarget as Element).setPointerCapture?.(ev.pointerId);
    const i = posDesdePuntero(ev);
    if (i !== null) girarA(i);
  }
  function mover(ev: PointerEvent) {
    if (!arrastrando) return;
    const i = posDesdePuntero(ev);
    if (i !== null) girarA(i);
  }
  function teclaSelector(ev: KeyboardEvent) {
    if (ev.key === 'ArrowRight' || ev.key === 'ArrowUp') girarA(m.pos + 1);
    else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowDown') girarA(m.pos - 1);
    else if (ev.key === 'Home') girarA(0);
    else return;
    ev.preventDefault();
    prepararAudio();
  }

  const BOTONES: { id: string; x: number; y: number; texto: string; arriba?: string; color?: string; ayuda: string }[] = [
    { id: 'select', x: 26, y: 214, texto: 'SELECT', arriba: '☀', color: '#f4c430', ayuda: 'SELECT: cambia de función; mantenido, luz' },
    { id: 'range', x: 92, y: 214, texto: 'RANGE', arriba: 'dBm-Ω/T1-T2', ayuda: 'RANGE: rango manual; mantenido, automático' },
    { id: 'delta', x: 158, y: 214, texto: 'Δ', arriba: '500000', ayuda: 'Δ (REL): relativo; mantenido, 500 000 cuentas' },
    { id: 'hold', x: 224, y: 214, texto: 'HOLD H', ayuda: 'HOLD: congela la lectura' },
    { id: 'crest', x: 26, y: 266, texto: 'CREST C', ayuda: 'CREST: picos de 1 ms; mantenido, salir' },
    { id: 'rec', x: 224, y: 266, texto: 'REC R', ayuda: 'REC: máximo, mínimo y media; mantenido, salir' },
  ];

  function accion(id: string, larga: boolean) {
    switch (id) {
      case 'select':
        if (larga) m.selectLargo();
        else m.select();
        break;
      case 'range':
        if (larga) m.rangeLargo();
        else m.range();
        break;
      case 'delta':
        if (larga) m.deltaLargo();
        else m.delta();
        break;
      case 'hold':
        m.pulsarHold();
        break;
      case 'crest':
        if (larga) m.crestLargo();
        else m.pulsarCrest();
        break;
      case 'rec':
        if (larga) m.recLargo();
        else m.pulsarRec();
        break;
    }
  }

  const BORNES: { id: Borne | 'COM'; x: number; rotulo: string; bajo: string }[] = [
    { id: 'A', x: 52, rotulo: 'A', bajo: 'MAX 10A' },
    { id: 'mA', x: 116, rotulo: 'mA µA', bajo: 'MAX 0.44A' },
    { id: 'COM', x: 184, rotulo: 'COM', bajo: '' },
    { id: 'V', x: 248, rotulo: 'ΩV⊣⊢', bajo: 'MAX 1000V' },
  ];
  const marca = (k: string) => pan.marcas.includes(k);
  const luz = $derived(m.luz && !apagado);
</script>

<svg
  bind:this={svg}
  class="brymen"
  viewBox="0 0 300 640"
  role="group"
  aria-label="Multímetro Brymen BM869s"
>
  <!-- holster and face -->
  <rect x="0" y="0" width="300" height="640" rx="36" fill="#c4262e" />
  <rect x="4" y="4" width="292" height="632" rx="33" fill="none" stroke="#e0474d" stroke-width="2" />
  <rect x="14" y="14" width="272" height="612" rx="22" fill="#2a2c30" />

  <!-- LCD -->
  <rect x="26" y="28" width="248" height="166" rx="10" fill="#151618" />
  <rect x="34" y="36" width="232" height="150" rx="5" fill={luz ? '#bfe3d6' : '#c3c9b6'} />
  <g class="lcd" fill="#1e2420" opacity={apagado ? 0 : 1}>
    <g font-size="8.5" font-weight="700" font-family="var(--sans)">
      <text x="42" y="50" opacity={marca('AUTO') ? 1 : 0.06}>AUTO</text>
      <text x="68" y="50" opacity={marca('MANU') ? 1 : 0.06}>MANU</text>
      <text x="98" y="50" opacity={marca('Δ') ? 1 : 0.06}>Δ</text>
      <text x="108" y="50" opacity={m.hold ? 1 : 0.06}>H</text>
      <text x="118" y="50" opacity={marca('CREST') ? 1 : 0.06}>C</text>
      <text x="42" y="62" opacity={marca('MAX') ? 1 : 0.06}>MAX</text>
      <text x="62" y="62" opacity={marca('MIN') ? 1 : 0.06}>MIN</text>
      <text x="82" y="62" opacity={marca('AVG') ? 1 : 0.06}>AVG</text>
      <text x="102" y="62" opacity={marca('REC') || marca('MAX') || marca('MIN') || marca('AVG') ? 1 : 0.06}>R</text>
      <text x="42" y="74" opacity={marca('DC') || marca('AC+DC') ? 1 : 0.06}>DC</text>
      <text x="56" y="74" opacity={marca('AC') || marca('AC+DC') ? 1 : 0.06}>AC</text>
      <text x="70" y="74" opacity={marca('VFD') ? 1 : 0.06}>VFD</text>
      <text x="89" y="74" opacity={marca('·)))') ? 1 : 0.06}>·)))</text>
      <text x="108" y="74" opacity={marca('⏵') ? 1 : 0.06}>→|</text>
      <text x="124" y="74" opacity={marca('500000') ? 1 : 0.06} font-size="7">500k</text>
    </g>
    <!-- secondary display -->
    <g transform="translate(160 44)">
      {#each secundaria.celdas as c, i (i)}
        <g transform={`translate(${i * 16} 0) skewX(-6)`}>
          {#each Object.entries(SEG2) as [s, pts] (s)}
            <polygon points={pts} opacity={c.segs.includes(s) ? 0.92 : 0.05} />
          {/each}
          {#if c.punto}<rect x="13" y="20" width="2.6" height="2.6" />{/if}
        </g>
      {/each}
      {#if secundaria.menos}<rect x="-8" y="10" width="6" height="2.6" />{/if}
      <text x="80" y="22" font-size="9" font-weight="700" font-family="var(--sans)" text-anchor="end" transform="translate(16 10)">{unidad2}</text>
    </g>
    <!-- main display -->
    <g transform="translate(46 86)">
      {#if principal.menos}<rect x="-12" y="22.5" width="10" height="5.4" />{/if}
      {#each principal.celdas as c, i (i)}
        <g transform={`translate(${i * 31} 0) skewX(-6)`}>
          {#each Object.entries(SEG) as [s, pts] (s)}
            <polygon points={pts} opacity={c.segs.includes(s) ? 0.92 : 0.05} />
          {/each}
          {#if c.punto}<rect x="26" y="45" width="5" height="5" />{/if}
        </g>
      {/each}
    </g>
    <text x="258" y="134" font-size="15" font-weight="700" font-family="var(--sans)" text-anchor="end">{pan.mensaje ? '' : unidad}</text>
    <text x="258" y="100" font-size="8" font-weight="700" font-family="var(--sans)" text-anchor="end"
      >{pan.marcas.find((x) => /Ω$|^T/.test(x) && x !== 'AUTO') ?? ''}</text
    >
    <!-- bargraph -->
    {#if pan.barra !== null}
      <g transform="translate(44 158)">
        {#each Array.from({ length: 41 }, (_, k) => k) as k (k)}
          <rect x={k * 5.2} y="0" width="3.6" height={k % 5 === 0 ? 9 : 7} opacity={Math.abs(pan.barra) * 41 >= k + 0.5 ? 0.9 : 0.07} />
        {/each}
        <g font-size="6.5" font-family="var(--sans)" opacity="0.8">
          {#each [0, 1, 2, 3, 4, 5] as k (k)}<text x={k * 41.6} y="18" text-anchor="middle">{k}</text>{/each}
        </g>
        {#if pan.barra < 0}<rect x="-8" y="3" width="5" height="1.6" />{/if}
      </g>
    {/if}
  </g>

  <!-- buttons -->
  {#each BOTONES as b (b.id)}
    <g
      class="boton"
      role="button"
      tabindex="0"
      aria-label={b.ayuda}
      use:pulsacion={{ corta: () => accion(b.id, false), larga: () => accion(b.id, true) }}
    >
      <title>{b.ayuda}</title>
      {#if b.arriba}<text x={b.x + 29} y={b.y - 4} font-size="7.5" fill="#f2f2f2" text-anchor="middle" font-family="var(--sans)">{b.arriba}</text>{/if}
      <rect x={b.x - 2} y={b.y - 2} width="62" height="44" rx="10" fill="transparent" />
      <rect class="tecla" x={b.x} y={b.y + 4} width="58" height="30" rx="12" fill="#d9d6cf" stroke="#8e8b84" />
      <text x={b.x + 29} y={b.y + 23.5} font-size="10.5" font-weight="700" text-anchor="middle" fill={b.color ? '#b88600' : '#2a2c30'} font-family="var(--sans)"
        >{b.texto}</text
      >
    </g>
  {/each}

  <!-- rotary selector -->
  <g class="selector">
    {#each BM_POSICIONES as p, i (p.id)}
      {@const a = rad(angulo(i))}
      <g
        class="posicion"
        role="button"
        tabindex="-1"
        aria-label={`Selector en ${p.rotulo}`}
        onclick={() => {
          prepararAudio();
          girarA(i);
        }}
        onkeydown={(e) => e.key === 'Enter' && girarA(i)}
      >
        <circle cx={CX + R_ROTULO * Math.sin(a)} cy={CY - R_ROTULO * Math.cos(a)} r="22" fill="transparent" />
        {#if guia?.posicion === p.id && i !== m.pos}<circle class="guia" cx={CX + R_ROTULO * Math.sin(a)} cy={CY - R_ROTULO * Math.cos(a)} r="21" />{/if}
        <text
          x={CX + R_ROTULO * Math.sin(a)}
          y={CY - R_ROTULO * Math.cos(a) + 4}
          font-size={p.id === 'off' ? 12 : 11}
          font-weight="700"
          text-anchor="middle"
          fill={i === m.pos ? '#ffd34d' : p.corriente ? '#e9686e' : '#f0f0f0'}
          font-family="var(--sans)">{p.rotulo}</text
        >
      </g>
    {/each}
    <circle cx={CX} cy={CY} r="80" fill="#202124" stroke="#3a3c40" stroke-width="3" />
    <g
      class="mando"
      role="slider"
      tabindex="0"
      aria-label="Selector giratorio"
      aria-valuemin="0"
      aria-valuemax={BM_POSICIONES.length - 1}
      aria-valuenow={m.pos}
      aria-valuetext={m.posicion.rotulo}
      onpointerdown={abajo}
      onpointermove={mover}
      onpointerup={() => (arrastrando = false)}
      onpointercancel={() => (arrastrando = false)}
      onkeydown={teclaSelector}
    >
      <circle cx={CX} cy={CY} r="66" fill="#141517" />
      <g transform={`rotate(${angulo(m.pos)} ${CX} ${CY})`} style="transition: transform 0.12s">
        <rect x={CX - 17} y={CY - 70} width="34" height="140" rx="15" fill="#2d2f33" stroke="#4a4d52" />
        <path d={`M ${CX} ${CY - 66} L ${CX - 7} ${CY - 50} L ${CX + 7} ${CY - 50} Z`} fill="#f0f0f0" />
      </g>
    </g>
  </g>

  <!-- jacks -->
  {#each BORNES as j (j.id)}
    {@const rojo = j.id === m.borne}
    <g
      class="borne"
      role="button"
      tabindex={j.id === 'COM' ? -1 : 0}
      aria-disabled={j.id === 'COM' ? 'true' : undefined}
      aria-label={j.id === 'COM' ? 'Borne COM (punta negra)' : `Mover la punta roja al borne ${j.rotulo}`}
      aria-pressed={j.id === 'COM' ? undefined : rojo}
      onclick={() => j.id !== 'COM' && m.ponerBorne(j.id)}
      onkeydown={(e) => e.key === 'Enter' && j.id !== 'COM' && m.ponerBorne(j.id)}
    >
      <text x={j.x} y="540" font-size="11" font-weight="700" text-anchor="middle" fill={j.id === 'mA' ? '#5aa8e0' : j.id === 'A' ? '#e9686e' : '#f0f0f0'} font-family="var(--sans)"
        >{j.rotulo}</text
      >
      <circle cx={j.x} cy="566" r="24" fill="transparent" />
      {#if guia?.borne === j.id && m.borne !== j.id}<circle class="guia" cx={j.x} cy="566" r="23" />{/if}
      <circle cx={j.x} cy="566" r="17" fill="#111" stroke={j.id === 'COM' ? '#888' : '#b5262c'} stroke-width="4" />
      {#if rojo || j.id === 'COM'}
        <circle cx={j.x} cy="566" r="11" fill={j.id === 'COM' ? '#1b1b1b' : '#d0262e'} stroke={j.id === 'COM' ? '#555' : '#ff6b6b'} stroke-width="2" />
        <rect x={j.x - 4} y="577" width="8" height="40" fill={j.id === 'COM' ? '#1b1b1b' : '#d0262e'} />
      {:else}
        <circle cx={j.x} cy="566" r="5" fill="#000" />
      {/if}
      <text x={j.x} y="604" font-size="7" text-anchor="middle" fill="#cfcfcf" font-family="var(--sans)">{j.bajo}</text>
    </g>
  {/each}
  {#if (!m.fusibleMA && m.borne === 'mA') || (!m.fusibleA && m.borne === 'A')}
    <text x="150" y="512" font-size="10" text-anchor="middle" fill="#ffd34d" font-family="var(--sans)">fusible fundido</text>
  {/if}
  <rect x="96" y="610" width="70" height="14" rx="2" fill="#ddd" />
  <text x="131" y="621" font-size="10" font-weight="800" text-anchor="middle" fill="#2a2c30" font-family="var(--sans)" letter-spacing="1">BRYMEN</text>
  <text x="208" y="621" font-size="10" font-style="italic" font-weight="700" text-anchor="middle" fill="#f0f0f0" font-family="var(--serif)">BM869s</text>
</svg>

<style>
  .guia {
    fill: none;
    stroke: #ffd34d;
    stroke-width: 4;
    pointer-events: none;
    animation: guia 1.1s ease-in-out infinite;
  }
  @keyframes guia {
    50% {
      stroke-opacity: 0.25;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .guia {
      animation: none;
    }
  }
  .brymen {
    display: block;
    width: 100%;
    height: auto;
    max-height: 100%;
    user-select: none;
    -webkit-user-select: none;
    touch-action: manipulation;
  }
  .boton,
  .borne,
  .posicion {
    cursor: pointer;
    outline: none;
  }
  .boton:focus-visible .tecla,
  .borne:focus-visible circle:nth-of-type(2) {
    stroke: var(--acento);
    stroke-width: 3;
  }
  .boton:global(.pulsado) .tecla {
    fill: #b9b5ad;
    transform: translateY(1px);
  }
  .mando {
    cursor: grab;
    touch-action: none;
    outline: none;
  }
  .mando:focus-visible circle:first-child {
    stroke: var(--acento);
    stroke-width: 3;
  }
  @media (prefers-reduced-motion: reduce) {
    .mando g {
      transition: none !important;
    }
  }
</style>
