<script lang="ts">
  // 1.3 (averias13): «Busque la avería» on a photo of the board: the board's pads placed on the photo (the affine fit
  // of the console's `posiciones`, lib/averias-placa/modelo.ts), the meter's two leads on them. A tap puts the lead in
  // hand on the pad under it (when the pads are too small to tell apart under a finger, the tap zooms in there
  // instead); a placed lead is dragged with the precise gesture of componentes/colocar/ — 56 px above a finger,
  // snapped to the nearest pad with hysteresis, the loupe and the pad's name, the fine-adjust arrows after — and one
  // finger elsewhere pans, two fingers or the wheel zoom. The list of test points of the host is the keyboard's way.
  import { untrack } from 'svelte';
  import Lupa from '../../colocar/Lupa.svelte';
  import AjusteFino from '../../colocar/AjusteFino.svelte';
  import { candidatoConHisteresis, elevacion, vecinoEnDireccion, type Direccion } from '../../colocar/precision';
  import { vibrarAterrizaje, vibrarCambio } from '../../colocar/haptica';
  import Plus from '@lucide/svelte/icons/plus';
  import Minus from '@lucide/svelte/icons/minus';
  import Maximize from '@lucide/svelte/icons/scan';

  export type Punta = 'roja' | 'negra';
  export interface PadFoto {
    id: string;
    /** Photo px. */
    x: number;
    y: number;
  }

  let {
    src,
    ancho,
    alto,
    pads,
    puntas,
    activa,
    poner,
    elegir,
    nombre,
    encuadre,
    marcadas = [],
    paso = 21,
  }: {
    src: string;
    ancho: number;
    alto: number;
    pads: PadFoto[];
    puntas: Record<Punta, string | null>;
    activa: Punta;
    poner: (p: Punta, pad: string) => void;
    /** A tap on a placed lead (on its own pad): that lead in hand. */
    elegir?: (p: Punta) => void;
    /** «F1, pata 2 (…)». */
    nombre: (pad: string) => string;
    /** The view it starts with (photo px: x0, y0, x1, y1). */
    encuadre: [number, number, number, number];
    /** Boxes to outline (photo px), e.g. the faulty part once found. */
    marcadas?: [number, number, number, number][];
    /** Pitch of the pads (photo px, 2,54 mm), for the tap's rule. */
    paso?: number;
  } = $props();

  let caja: HTMLDivElement | undefined = $state();
  let grupo: SVGGElement | undefined = $state();
  let w = $state(0);
  let h = $state(0);
  let k = $state(0.3);
  let ox = $state(0);
  let oy = $state(0);
  /** The reader has moved the view: a resize no longer re-frames it. */
  let tocado = false;

  /** Keeps the photo over the whole view where it is big enough (no empty band beside the board's edge). */
  function limitar() {
    const pw = ancho * k;
    const ph = alto * k;
    ox = pw >= w ? Math.min(0, Math.max(w - pw, ox)) : (w - pw) / 2;
    oy = ph >= h ? Math.min(0, Math.max(h - ph, oy)) : (h - ph) / 2;
  }
  function encuadrar(b: [number, number, number, number] = encuadre) {
    const [x0, y0, x1, y1] = b;
    k = Math.min(w / (x1 - x0), h / (y1 - y0));
    ox = w / 2 - ((x0 + x1) / 2) * k;
    oy = h / 2 - ((y0 + y1) / 2) * k;
    limitar();
  }
  // (framed again while the box takes its size, until the reader moves the view)
  $effect(() => {
    const b = encuadre;
    if (w > 50 && h > 50) untrack(() => !tocado && encuadrar(b));
  });
  function zoom(f: number, px = w / 2, py = h / 2) {
    tocado = true;
    const n = Math.min(8, Math.max(Math.min(w / ancho, h / alto) * 0.8, k * f));
    ox = px - (px - ox) * (n / k);
    oy = py - (py - oy) * (n / k);
    k = n;
    limitar();
  }

  const porId = $derived(new Map(pads.map((p) => [p.id, p])));
  function rel(cx: number, cy: number): [number, number] {
    const r = caja!.getBoundingClientRect();
    return [cx - r.left, cy - r.top];
  }
  /** Client px of a photo point. */
  function cliente(x: number, y: number): { x: number; y: number } {
    const r = caja?.getBoundingClientRect();
    return { x: (r?.left ?? 0) + ox + x * k, y: (r?.top ?? 0) + oy + y * k };
  }
  /** The pads near a client point, as candidates in client px. */
  function cercanos(cx: number, cy: number, radio: number) {
    const r = caja!.getBoundingClientRect();
    const res: { id: string; x: number; y: number }[] = [];
    for (const p of pads) {
      const x = r.left + ox + p.x * k;
      const y = r.top + oy + p.y * k;
      if (Math.abs(x - cx) <= radio && Math.abs(y - cy) <= radio) res.push({ id: p.id, x, y });
    }
    return res;
  }

  // ---------------------------------------------------------------- gestures
  type Gesto = { t: 'pan'; desde: [number, number]; o0: [number, number]; movido: boolean } | { t: 'punta'; p: Punta; desde: [number, number]; pad: string | null; movido: boolean; tipo: string };
  let gesto = $state<Gesto | null>(null);
  const punteros = new Map<number, { x: number; y: number }>();
  let pinza: { d: number; k: number; c: [number, number]; o: [number, number] } | null = null;
  /** The lifted point of a finger drag (client px), for the loupe. */
  let objetivo = $state<{ x: number; y: number } | null>(null);
  let ajuste = $state<Punta | null>(null);
  let info = $state('');

  function abajo(ev: PointerEvent) {
    ajuste = null;
    tocado = true;
    punteros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    try {
      (ev.currentTarget as Element).setPointerCapture(ev.pointerId);
    } catch {
      /* synthetic */
    }
    if (punteros.size >= 2) {
      gesto = null;
      objetivo = null;
      const [a, b] = [...punteros.values()];
      pinza = { d: Math.hypot(a!.x - b!.x, a!.y - b!.y) || 1, k, c: rel((a!.x + b!.x) / 2, (a!.y + b!.y) / 2), o: [ox, oy] };
      return;
    }
    // a placed lead under the pointer is dragged
    const radio = ev.pointerType === 'mouse' ? 12 : 24;
    let cerca: { p: Punta; d: number } | null = null;
    for (const p of ['roja', 'negra'] as const) {
      const pad = puntas[p] ? porId.get(puntas[p]!) : null;
      if (!pad) continue;
      const c = cliente(pad.x, pad.y);
      const d = Math.hypot(c.x - ev.clientX, c.y - ev.clientY);
      if (d < radio && (!cerca || d < cerca.d)) cerca = { p, d };
    }
    if (cerca) gesto = { t: 'punta', p: cerca.p, desde: [ev.clientX, ev.clientY], pad: puntas[cerca.p], movido: false, tipo: ev.pointerType };
    else gesto = { t: 'pan', desde: [ev.clientX, ev.clientY], o0: [ox, oy], movido: false };
  }

  function mover(ev: PointerEvent) {
    const q = punteros.get(ev.pointerId);
    if (q) {
      q.x = ev.clientX;
      q.y = ev.clientY;
    }
    if (pinza && punteros.size >= 2) {
      const [a, b] = [...punteros.values()];
      const d = Math.hypot(a!.x - b!.x, a!.y - b!.y) || 1;
      const c = rel((a!.x + b!.x) / 2, (a!.y + b!.y) / 2);
      const n = Math.min(8, Math.max(0.05, (pinza.k * d) / pinza.d));
      ox = c[0] - (pinza.c[0] - pinza.o[0]) * (n / pinza.k);
      oy = c[1] - (pinza.c[1] - pinza.o[1]) * (n / pinza.k);
      k = n;
      limitar();
      return;
    }
    const g = gesto;
    if (!g) return;
    const umbral = ev.pointerType === 'mouse' ? 4 : 9;
    if (!g.movido && Math.hypot(ev.clientX - g.desde[0], ev.clientY - g.desde[1]) > umbral) g.movido = true;
    if (!g.movido) return;
    if (g.t === 'pan') {
      ox = g.o0[0] + ev.clientX - g.desde[0];
      oy = g.o0[1] + ev.clientY - g.desde[1];
      limitar();
      return;
    }
    const t = { x: ev.clientX, y: ev.clientY - elevacion(ev.pointerType) };
    const c = candidatoConHisteresis(cercanos(t.x, t.y, 60), t, g.pad, ev.pointerType === 'touch' ? 10 : 4, 40);
    if (c && c.id !== g.pad) vibrarCambio();
    g.pad = c?.id ?? null;
    objetivo = ev.pointerType === 'touch' ? t : null;
    info = c ? nombre(c.id) : 'Fuera de los pads: al soltar se queda donde estaba.';
  }

  function arriba(ev: PointerEvent) {
    punteros.delete(ev.pointerId);
    if (punteros.size < 2) pinza = null;
    const g = gesto;
    gesto = null;
    objetivo = null;
    if (!g) return;
    if (g.t === 'punta' && g.movido) {
      if (g.pad) {
        poner(g.p, g.pad);
        if (ev.pointerType === 'touch') {
          vibrarAterrizaje();
          ajuste = g.p;
        }
      } else info = 'Se queda donde estaba.';
      return;
    }
    if (g.movido) return;
    if (g.t === 'punta') {
      // a tap on a lead: on its own pad it takes that lead in hand; on a pad next to it, the lead in hand goes there
      const c = cercanos(ev.clientX, ev.clientY, 30).sort((a, b) => Math.hypot(a.x - ev.clientX, a.y - ev.clientY) - Math.hypot(b.x - ev.clientX, b.y - ev.clientY))[0];
      if (!c || c.id === puntas[g.p]) {
        elegir?.(g.p);
        info = `En la mano: la punta ${g.p}. Arrástrela, o toque un pad para ponerla.`;
        return;
      }
    }
    tocar(ev.clientX, ev.clientY, ev.pointerType, activa);
  }

  /** A tap: the pad under it gets the lead, unless the pads there are too close for a finger (then zoom in). */
  function tocar(cx: number, cy: number, tipo: string, p: Punta) {
    const radio = tipo === 'mouse' ? 10 : 22;
    const cs = cercanos(cx, cy, radio * 2).map((c) => ({ ...c, d: Math.hypot(c.x - cx, c.y - cy) })).sort((a, b) => a.d - b.d);
    const c = cs[0];
    if (!c || c.d > radio) {
      info = 'Ahí no hay ningún pad: toque una pata, un pad o un punto de prueba.';
      return;
    }
    const minimo = tipo === 'mouse' ? 8 : 18;
    if (paso * k < minimo && cs[1] && cs[1].d - c.d < minimo / 2) {
      const [px, py] = rel(cx, cy);
      zoom(Math.min(4, (minimo * 1.6) / (paso * k)), px, py);
      info = 'Acercado: los pads eran muy pequeños para el dedo. Toque otra vez el que quiera.';
      return;
    }
    poner(p, c.id);
  }

  function cancelar() {
    punteros.clear();
    pinza = null;
    gesto = null;
    objetivo = null;
  }

  function rueda(ev: WheelEvent) {
    ev.preventDefault();
    const [px, py] = rel(ev.clientX, ev.clientY);
    zoom(Math.exp(-Math.sign(ev.deltaY) * 0.18), px, py);
  }
  function sinZoomPagina(node: HTMLElement) {
    const f = (e: TouchEvent) => {
      if ((e.target as Element | null)?.closest?.('button')) return;
      if (e.cancelable) e.preventDefault();
    };
    node.addEventListener('touchstart', f, { passive: false });
    node.addEventListener('touchmove', f, { passive: false });
    node.addEventListener('wheel', rueda, { passive: false });
    return {
      destroy() {
        node.removeEventListener('touchstart', f);
        node.removeEventListener('touchmove', f);
        node.removeEventListener('wheel', rueda);
      },
    };
  }

  // ---------------------------------------------------------------- fine adjust (the next pad that way)
  function vecino(p: Punta, d: Direccion): string | null {
    const id = puntas[p];
    const pad = id ? porId.get(id) : null;
    if (!pad) return null;
    const a = cliente(pad.x, pad.y);
    const cs = cercanos(a.x, a.y, Math.max(60, paso * k * 3));
    return vecinoEnDireccion(cs, { id: pad.id, ...a }, d)?.id ?? null;
  }
  const posAjuste = $derived.by(() => {
    void k;
    void ox;
    void oy;
    const p = ajuste;
    const pad = p && puntas[p] ? porId.get(puntas[p]!) : null;
    return pad && !gesto ? cliente(pad.x, pad.y) : null;
  });

  const previa = $derived.by(() => {
    const g = gesto;
    if (!objetivo || !g || g.t !== 'punta') return null;
    const pad = g.pad ? porId.get(g.pad) : null;
    return { marca: pad ? cliente(pad.x, pad.y) : null, etiqueta: pad ? nombre(pad.id) : 'Fuera de los pads: se queda donde estaba', mal: !pad };
  });

  /** Where a lead is drawn now (while dragged, on the pad shown). */
  function sitio(p: Punta): PadFoto | null {
    const g = gesto;
    const id = g?.t === 'punta' && g.p === p && g.movido ? g.pad : puntas[p];
    return id ? (porId.get(id) ?? null) : null;
  }
  const COLOR: Record<Punta, string> = { roja: '#d93025', negra: '#1d1d1f' };

  // (tests: the client point of a pad in the current view, and the view's scale)
  const gl = globalThis as unknown as { __epaFotoAveria?: unknown };
  $effect(() => {
    gl.__epaFotoAveria = { pantalla: (id: string) => (porId.get(id) ? cliente(porId.get(id)!.x, porId.get(id)!.y) : null), escala: () => k, paso: () => paso * k };
    return () => delete gl.__epaFotoAveria;
  });
</script>

<div class="foto-averia" bind:this={caja} bind:clientWidth={w} bind:clientHeight={h} use:sinZoomPagina data-foto-averia>
  <svg width={w} height={h} role="presentation" onpointerdown={abajo} onpointermove={mover} onpointerup={arriba} onpointercancel={cancelar}>
    <g bind:this={grupo} transform={`translate(${ox} ${oy}) scale(${k})`}>
      <image href={src} width={ancho} height={alto} preserveAspectRatio="none" />
      {#each marcadas as b, i (i)}
        <rect class="marcada" x={b[0]} y={b[1]} width={b[2] - b[0]} height={b[3] - b[1]} rx={6 / k} style:stroke-width={`${3 / k}px`} />
      {/each}
      {#if paso * k >= 10}
        {#each pads as p (p.id)}
          <circle class="pad" cx={p.x} cy={p.y} r={paso * 0.32} style:stroke-width={`${1 / k}px`} />
        {/each}
      {/if}
      {#each ['negra', 'roja'] as const as p (p)}
        {@const s = sitio(p)}
        {#if s}
          {@const r = Math.max(paso * 0.42, 9 / k)}
          <path class="cable" d={`M${s.x} ${s.y}c${r * 0.6} ${-r * 3} ${r * 3} ${-r * 3.4} ${r * 4} ${-r * 6.4}`} stroke={COLOR[p]} style:stroke-width={`${Math.max(r * 0.5, 4 / k)}px`} />
          <circle class="punta" class:activa={activa === p} cx={s.x} cy={s.y} {r} fill={COLOR[p]} style:stroke-width={`${2.5 / k}px`} data-punta-foto={p} data-pad={s.id} />
          <text class="letra" x={s.x} y={s.y} font-size={r * 1.2} text-anchor="middle" dominant-baseline="central">{p === 'roja' ? '+' : '−'}</text>
        {/if}
      {/each}
    </g>
  </svg>
  <div class="zoom" role="group" aria-label="Vista de la foto">
    <button type="button" aria-label="Acercar" title="Acercar" onclick={() => zoom(1.4)}><Plus size={18} /></button>
    <button type="button" aria-label="Alejar" title="Alejar" onclick={() => zoom(1 / 1.4)}><Minus size={18} /></button>
    <button type="button" aria-label="Volver al encuadre de la alimentación" title="Volver al encuadre" onclick={() => ((tocado = false), encuadrar())}><Maximize size={17} /></button>
  </div>
  {#if info && !previa}<p class="info" aria-live="polite">{info}</p>{/if}
  {#if previa && objetivo}
    <Lupa origen={grupo ?? null} {objetivo} marca={previa.marca} etiqueta={previa.etiqueta} mal={previa.mal} zoom={Math.min(5, Math.max(1.8, 30 / (paso * k)))} />
  {/if}
  {#if posAjuste && ajuste}
    {@const p = ajuste}
    <AjusteFino
      x={posAjuste.x}
      y={posAjuste.y}
      nombre={p === 'roja' ? 'la punta roja' : 'la punta negra'}
      paso="al pad de al lado"
      puede={(d) => !!vecino(p, d)}
      mover={(d) => {
        const v = vecino(p, d);
        if (v) {
          poner(p, v);
          vibrarCambio();
          info = nombre(v);
        }
      }}
      cerrar={() => (ajuste = null)}
    />
  {/if}
</div>

<style>
  .foto-averia {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    background: #1b1f24;
    border-radius: 12px;
  }
  svg {
    /* (out of the flow: the box sizes the drawing, never the other way round) */
    position: absolute;
    inset: 0;
    display: block;
    touch-action: none;
  }
  .pad {
    fill: none;
    stroke: rgba(255, 216, 74, 0.55);
    pointer-events: none;
  }
  .marcada {
    fill: rgba(255, 176, 46, 0.12);
    stroke: #ffb02e;
    pointer-events: none;
  }
  .cable {
    fill: none;
    stroke-linecap: round;
    opacity: 0.9;
    pointer-events: none;
  }
  .punta {
    stroke: #fff;
  }
  .punta.activa {
    stroke: #ffd84a;
  }
  .letra {
    fill: #fff;
    font-weight: 800;
    pointer-events: none;
  }
  .zoom {
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--linea);
    border-radius: 12px;
    background: color-mix(in srgb, var(--superficie) 94%, transparent);
    box-shadow: var(--sombra);
    overflow: hidden;
  }
  .zoom button {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border: 0;
    background: transparent;
    color: var(--tinta);
  }
  .zoom button + button {
    border-top: 1px solid var(--linea-suave);
  }
  .info {
    position: absolute;
    left: 8px;
    right: 60px;
    bottom: 8px;
    margin: 0;
    padding: 6px 10px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--superficie) 92%, transparent);
    color: var(--tinta);
    font: 13.5px/1.3 var(--sans);
    box-shadow: var(--sombra);
    pointer-events: none;
  }
</style>
