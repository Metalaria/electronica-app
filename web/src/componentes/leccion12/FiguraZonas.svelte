<script lang="ts">
  // 1.2 widget «figura» (GUIA §11.1): a book figure or photo, or a console photo of the «Consolas» explorer, with
  // tappable zones in the picture's own coordinates. On an explore card a touch shows what the zone is; on a «tocar»
  // card it is the answer (one zone, or several with `todas`), marked right or wrong after the check. The zones are
  // also a labelled list of buttons (keyboard and screen reader); the picture zooms with «+ / −» and with two fingers
  // (the frame then scrolls), and keeps the book's figure plate in the three themes.
  // 1.2 (motor12e): a code listing instead of a picture (`fuente.origen` «codigo»): drawn in monospace with its
  // highlighted lines and its comments dimmed, read whole to a screen reader (a hidden <pre>); its zones are lines.
  // 1.3 (motor13b): `w.recorte` shows only a part of the picture (the zones keep the picture's coordinates: the zone
  // layer's viewBox is the crop) and `w.ampliar` starts zoomed in on a narrow screen, so that small zones reach 44 px.
  // 2.2: around each zone the touch area is 48 px (TOQUE_MIN) even where the drawing is smaller (tocarEn).
  import './digital12.css';
  import { url } from '../../lib/datos';
  import type { EstadoTarjeta } from '../../lib/leccion11/motor';
  import type { Tarjeta } from '../../lib/leccion11/tipos';
  import type { EstadoTocar, Tocar, WidgetFigura, ZonaFigura } from '../../lib/leccion12/digital/tipos';
  import { CODIGO_COL, CODIGO_LINEA, CODIGO_MARGEN } from '../../lib/leccion12/digital/tipos';
  import { tocarVisita } from '../../lib/leccion12/digital/objetivo-figura';
  import TextoVivo from '../leccion11/TextoVivo.svelte';
  import { TOQUE_MIN } from '../../lib/toque';

  let {
    t,
    w,
    e,
    prefijo,
    cambiar,
  }: {
    t: Tarjeta;
    w: WidgetFigura;
    e: EstadoTarjeta;
    prefijo: string;
    cambiar: (c: Partial<EstadoTarjeta>) => void;
  } = $props();

  const valor = (id: string) => id;
  const a = $derived(t.actividad?.tipo === 'tocar' ? (t.actividad as Tocar) : null);
  const ea = $derived(e.actividad?.tipo === 'tocar' ? (e.actividad as EstadoTocar) : null);
  const zonaVista = $derived(e.widget12?.zona ?? null);
  const src = $derived(w.fuente.origen === 'libro' ? url(w.fuente.src) : w.fuente.src);
  const [vx, vy, vw, vh] = $derived(w.fuente.vista);
  // (the part shown: the crop, or the whole picture)
  const [rx, ry, rw, rh] = $derived(w.recorte ?? w.fuente.vista);
  const pct = (n: number) => `${Math.round(n * 1e4) / 1e2}%`;
  // (answer locked while a verdict is on show or once right)
  const bloqueado = $derived(!!a && (e.comprobado || e.resuelta));

  let zoom = $state(1);
  const ZOOM_MAX = 4;
  /** Below this frame width (a phone), `w.ampliar` is the starting zoom. */
  const ANCHO_ESTRECHO = 560;
  let marco = $state<HTMLDivElement | null>(null);
  let ampliado = false;
  $effect(() => {
    if (!marco || ampliado || !w.ampliar) return;
    ampliado = true;
    if (marco.clientWidth > 0 && marco.clientWidth < ANCHO_ESTRECHO) zoom = Math.min(ZOOM_MAX, w.ampliar);
  });
  function cambiarZoom(f: number) {
    zoom = Math.min(ZOOM_MAX, Math.max(1, Math.round(zoom * f * 100) / 100));
  }

  function area(z: ZonaFigura): number {
    if (z.poligono) {
      let s = 0;
      const p = z.poligono;
      for (let k = 0; k < p.length; k++) {
        const [x1, y1] = p[k]!;
        const [x2, y2] = p[(k + 1) % p.length]!;
        s += x1 * y2 - x2 * y1;
      }
      return Math.abs(s) / 2;
    }
    return z.rects.reduce((s, r) => s + r[2] * r[3], 0);
  }
  function dentro(z: ZonaFigura, x: number, y: number): boolean {
    if (z.rects.some((r) => x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3])) return true;
    const p = z.poligono;
    if (!p) return false;
    let d = false;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      const [xi, yi] = p[i]!;
      const [xj, yj] = p[j]!;
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) d = !d;
    }
    return d;
  }

  let svg = $state<SVGSVGElement | null>(null);
  let mensaje = $state('');
  /**
   * 2.2: a zone's touch area is at least TOQUE_MIN (48) CSS px on each side, centred on what is drawn (the drawing
   * keeps its size): a touch just outside a small zone still selects it. `sx`, `sy`: CSS px per picture unit.
   * Returns the distance in CSS px from the touch to the zone's nearest drawn part, or null if out of its area.
   */
  function cercania(z: ZonaFigura, x: number, y: number, sx: number, sy: number): number | null {
    const cajas: [number, number, number, number][] = [...z.rects];
    if (z.poligono?.length) {
      const xs = z.poligono.map((q) => q[0]);
      const ys = z.poligono.map((q) => q[1]);
      cajas.push([Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)]);
    }
    let mejor: number | null = null;
    for (const [rx0, ry0, rw0, rh0] of cajas) {
      const px = Math.max(0, (TOQUE_MIN - rw0 * sx) / 2) / sx;
      const py = Math.max(0, (TOQUE_MIN - rh0 * sy) / 2) / sy;
      if (x < rx0 - px || x > rx0 + rw0 + px || y < ry0 - py || y > ry0 + rh0 + py) continue;
      const dx = Math.max(0, rx0 - x, x - (rx0 + rw0)) * sx;
      const dy = Math.max(0, ry0 - y, y - (ry0 + rh0)) * sy;
      const d = Math.hypot(dx, dy);
      if (mejor === null || d < mejor) mejor = d;
    }
    return mejor;
  }

  function tocarEn(ev: MouseEvent) {
    if (!svg) return;
    const m = svg.getScreenCTM();
    if (!m) return;
    const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m.inverse());
    // (overlapping zones: the smallest one under the finger)
    let z = w.zonas.filter((q) => dentro(q, p.x, p.y)).sort((q, r) => area(q) - area(r))[0];
    // (2.2: none under the finger: the nearest one whose 48 px touch area takes the touch)
    if (!z) {
      const sx = Math.abs(m.a) || 1;
      const sy = Math.abs(m.d) || 1;
      let d0 = Infinity;
      for (const q of w.zonas) {
        const d = cercania(q, p.x, p.y, sx, sy);
        if (d !== null && d < d0) {
          d0 = d;
          z = q;
        }
      }
    }
    if (z) elegir(z.id);
    else mensaje = 'Ahí no hay ninguna zona: toque una de las marcadas.';
  }

  function elegir(id: string) {
    mensaje = '';
    const movidos = e.movidos.includes(id) ? e.movidos : [...e.movidos, id];
    const w12 = e.widget12 ?? { zona: null, niveles: {}, logica: null, pulsos: 0, tramo: 0 };
    if (a && ea) {
      if (bloqueado || ea.descartadas.includes(id)) return;
      // (1.2.1: in an ordered touch, touching one already chosen takes it back with the ones after it)
      const elegidas = a.orden
        ? ea.elegidas.includes(id)
          ? ea.elegidas.slice(0, ea.elegidas.indexOf(id))
          : [...ea.elegidas, id]
        : a.todas
          ? ea.elegidas.includes(id)
            ? ea.elegidas.filter((z) => z !== id)
            : [...ea.elegidas, id]
          : [id];
      cambiar({ actividad: { ...ea, elegidas }, movidos, widget12: { ...w12, zona: id } });
    }
    // (motor13: an explore card keeps every touch, in order: a goal on zones looks at them, objetivo-figura.ts)
    else cambiar({ movidos, widget12: { ...w12, zona: id, visitadas: tocarVisita(w12, id, t.objetivo) } });
  }

  function estadoZona(z: ZonaFigura): 'bien' | 'mal' | 'elegida' | 'vista' | '' {
    if (a && ea) {
      if (ea.descartadas.includes(z.id)) return 'mal';
      if (e.resuelta && a.bien.includes(z.id)) return 'bien';
      if (ea.elegidas.includes(z.id)) return 'elegida';
      return '';
    }
    return z.id === zonaVista ? 'vista' : e.movidos.includes(z.id) ? 'elegida' : '';
  }
  const zonaTexto = $derived(!a && zonaVista ? w.zonas.find((z) => z.id === zonaVista) : null);

  // two-finger zoom (the frame scrolls to pan; one finger keeps scrolling the page or the frame)
  const dedos = new Map<number, { x: number; y: number }>();
  let distancia0 = 0;
  let zoom0 = 1;
  function abajo(ev: PointerEvent) {
    if (ev.pointerType !== 'touch') return;
    dedos.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (dedos.size === 2) {
      const [p, q] = [...dedos.values()];
      distancia0 = Math.hypot(p!.x - q!.x, p!.y - q!.y);
      zoom0 = zoom;
    }
  }
  function mover(ev: PointerEvent) {
    if (!dedos.has(ev.pointerId)) return;
    dedos.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (dedos.size === 2 && distancia0 > 0) {
      const [p, q] = [...dedos.values()];
      zoom = Math.min(ZOOM_MAX, Math.max(1, (zoom0 * Math.hypot(p!.x - q!.x, p!.y - q!.y)) / distancia0));
    }
  }
  function arriba(ev: PointerEvent) {
    dedos.delete(ev.pointerId);
    if (dedos.size < 2) distancia0 = 0;
  }
  const puntosPoligono = (p: [number, number][]) => p.map((q) => q.join(',')).join(' ');
  // a listing's line split into code and its comment (dimmed): //, /* (C, AVR, Verilog), # (Python), -- (VHDL), ; (asm)
  const marcasComentario = (l: string): string[] => (/^(vhdl|sql|ada)$/i.test(l) ? ['--'] : /^(python|py|sh|bash|yaml)$/i.test(l) ? ['#'] : /^(asm|ensamblador)$/i.test(l) ? [';'] : ['//', '/*']);
  function trozos(linea: string): [string, string] {
    const cod = w.fuente.codigo;
    if (!cod) return [linea, ''];
    const k = Math.min(...marcasComentario(cod.lenguaje).map((m) => linea.indexOf(m)).filter((i) => i >= 0), Infinity);
    return Number.isFinite(k) ? [linea.slice(0, k), linea.slice(k)] : [linea, ''];
  }
  const deQue = $derived(w.fuente.codigo ? 'del listado' : 'de la figura');
  const etiquetaLista = $derived(a ? (a.todas ? `Zonas ${deQue} (puede elegir varias)` : `Zonas ${deQue}: elija una`) : `Zonas ${deQue}`);
</script>

<div class="d12 d12-figura" data-figura={w.fuente.src || w.fuente.origen}>
  <div class="d12-zoom a12-fila" role="group" aria-label="Tamaño de la figura">
    <button type="button" class="a12-boton" onclick={() => cambiarZoom(1 / 1.5)} disabled={zoom <= 1} aria-label="Reducir la figura" data-reducir>−</button>
    <button type="button" class="a12-boton" onclick={() => cambiarZoom(1.5)} disabled={zoom >= ZOOM_MAX} aria-label="Ampliar la figura" data-ampliar>+</button>
    {#if zoom > 1}<button type="button" class="a12-boton" onclick={() => (zoom = 1)} data-entera>Ver entera</button>{/if}
  </div>
  <!-- (zoomed in, the frame scrolls: it takes the focus so the arrows scroll it, WCAG «scrollable region focusable») -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
  <div
    bind:this={marco}
    class="d12-marco"
    class:ampliada={zoom > 1}
    onpointerdown={abajo}
    onpointermove={mover}
    onpointerup={arriba}
    onpointercancel={arriba}
    role="region"
    aria-label={zoom > 1 ? 'Figura ampliada: desplácela con las flechas o con el dedo' : 'Figura'}
    tabindex={zoom > 1 ? 0 : undefined}
  >
    <div class="d12-lienzo" class:vectorial={w.fuente.vectorial} class:codigo={!!w.fuente.codigo} class:recortada={!!w.recorte} style:width={`${zoom * 100}%`} style:aspect-ratio={`${rw} / ${rh}`} data-zoom={zoom}>
      {#if w.fuente.codigo}
        {@const cod = w.fuente.codigo}
        <pre class="a12-solo-lector" data-listado>{w.fuente.alt}:
{cod.lineas.map((l, k) => `${k + 1}${cod.resaltar.includes(k + 1) ? ' (resaltada)' : ''}: ${l}`).join('\n')}</pre>
        <svg class="d12-codigo" viewBox={`${vx} ${vy} ${vw} ${vh}`} preserveAspectRatio="none" aria-hidden="true" data-codigo={cod.lenguaje}>
          {#each cod.resaltar as n (n)}
            <rect class="resalte" x="0" y={CODIGO_MARGEN + (n - 1) * CODIGO_LINEA} width={vw} height={CODIGO_LINEA} data-resaltada={n} />
          {/each}
          {#each cod.lineas as l, k (k)}
            {@const [c0, c1] = trozos(l)}
            <text x={CODIGO_MARGEN} y={CODIGO_MARGEN + k * CODIGO_LINEA + CODIGO_LINEA * 0.72} textLength={l.length ? [...l].length * CODIGO_COL : undefined} lengthAdjust="spacingAndGlyphs" xml:space="preserve">{c0}<tspan class="comentario">{c1}</tspan></text>
          {/each}
        </svg>
      {:else if w.recorte}
        <!-- (the whole picture, scaled and shifted so that the crop fills the frame) -->
        <img {src} alt={`${w.fuente.alt} (detalle)`} draggable="false" style:width={pct(vw / rw)} style:height={pct(vh / rh)} style:left={pct(-(rx - vx) / rw)} style:top={pct(-(ry - vy) / rh)} data-recorte={w.recorte.join(' ')} />
      {:else}
        <img {src} alt={w.fuente.alt} draggable="false" />
      {/if}
      <!-- the zones: pointer targets over the picture (the list below is the keyboard and screen reader way) -->
      <svg bind:this={svg} viewBox={`${rx} ${ry} ${rw} ${rh}`} preserveAspectRatio="none" aria-hidden="true" onclick={tocarEn} data-zonas>
        {#each w.zonas as z (z.id)}
          {@const st = estadoZona(z)}
          <g class={`d12-zona ${st}`} data-zona={z.id} data-estado={st || 'nada'}>
            <!-- (a light halo under the outline: it shows on dark photos too) -->
            {#each z.rects as r, k (k)}
              <rect class="halo" x={r[0]} y={r[1]} width={r[2]} height={r[3]} rx={Math.min(r[2], r[3]) * 0.06} vector-effect="non-scaling-stroke" />
              <rect x={r[0]} y={r[1]} width={r[2]} height={r[3]} rx={Math.min(r[2], r[3]) * 0.06} vector-effect="non-scaling-stroke" />
            {/each}
            {#if z.poligono}
              <polygon class="halo" points={puntosPoligono(z.poligono)} vector-effect="non-scaling-stroke" />
              <polygon points={puntosPoligono(z.poligono)} vector-effect="non-scaling-stroke" />
            {/if}
          </g>
        {/each}
      </svg>
    </div>
  </div>
  {#if w.fuente.credito}<p class="a12-suave d12-credito">{w.fuente.credito}</p>{/if}

  <ul class="d12-lista" aria-label={etiquetaLista} data-lista-zonas>
    {#each w.zonas as z (z.id)}
      {@const st = estadoZona(z)}
      <li>
        <button
          type="button"
          class="a12-boton"
          class:bien={st === 'bien'}
          class:mal={st === 'mal'}
          aria-pressed={st === 'elegida' || st === 'vista' || st === 'bien'}
          aria-disabled={a ? bloqueado || st === 'mal' : undefined}
          onclick={() => elegir(z.id)}
          data-boton-zona={z.id}>{#if a?.orden && ea?.elegidas.includes(z.id)}<span class="d12-orden" data-orden-zona={ea.elegidas.indexOf(z.id) + 1}>{ea.elegidas.indexOf(z.id) + 1}</span> {/if}<TextoVivo texto={z.rotulo} {valor} />{#if st === 'mal'}<span class="a12-solo-lector"> (descartada)</span>{/if}</button
        >
      </li>
    {/each}
  </ul>
  <p class="d12-info" aria-live="polite" id={`${prefijo}-zona`} data-info-zona>
    {#if zonaTexto}<strong><TextoVivo texto={zonaTexto.rotulo} {valor} /></strong>{#if zonaTexto.texto}: <TextoVivo texto={zonaTexto.texto} {valor} />{/if}{:else if mensaje}{mensaje}{/if}
  </p>
</div>
