<script lang="ts">
  // 1.2 widget «figura» (GUIA §11.1): a book figure or photo, or a console photo of the «Consolas» explorer, with
  // tappable zones in the picture's own coordinates. On an explore card a touch shows what the zone is; on a «tocar»
  // card it is the answer (one zone, or several with `todas`), marked right or wrong after the check. The zones are
  // also a labelled list of buttons (keyboard and screen reader); the picture zooms with «+ / −» and with two fingers
  // (the frame then scrolls), and keeps the book's figure plate in the three themes.
  import './digital12.css';
  import { url } from '../../lib/datos';
  import type { EstadoTarjeta } from '../../lib/leccion11/motor';
  import type { Tarjeta } from '../../lib/leccion11/tipos';
  import type { EstadoTocar, Tocar, WidgetFigura, ZonaFigura } from '../../lib/leccion12/digital/tipos';
  import TextoVivo from '../leccion11/TextoVivo.svelte';

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
  // (answer locked while a verdict is on show or once right)
  const bloqueado = $derived(!!a && (e.comprobado || e.resuelta));

  let zoom = $state(1);
  const ZOOM_MAX = 4;
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
  function tocarEn(ev: MouseEvent) {
    if (!svg) return;
    const m = svg.getScreenCTM();
    if (!m) return;
    const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m.inverse());
    // (overlapping zones: the smallest one under the finger)
    const z = w.zonas.filter((q) => dentro(q, p.x, p.y)).sort((q, r) => area(q) - area(r))[0];
    if (z) elegir(z.id);
    else mensaje = 'Ahí no hay ninguna zona: toque una de las marcadas.';
  }

  function elegir(id: string) {
    mensaje = '';
    const movidos = e.movidos.includes(id) ? e.movidos : [...e.movidos, id];
    const w12 = e.widget12 ?? { zona: null, niveles: {}, logica: null, pulsos: 0, tramo: 0 };
    if (a && ea) {
      if (bloqueado || ea.descartadas.includes(id)) return;
      const elegidas = a.todas ? (ea.elegidas.includes(id) ? ea.elegidas.filter((z) => z !== id) : [...ea.elegidas, id]) : [id];
      cambiar({ actividad: { ...ea, elegidas }, movidos, widget12: { ...w12, zona: id } });
    } else cambiar({ movidos, widget12: { ...w12, zona: id } });
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
  const etiquetaLista = $derived(a ? (a.todas ? 'Zonas de la figura (puede elegir varias)' : 'Zonas de la figura: elija una') : 'Zonas de la figura');
</script>

<div class="d12 d12-figura" data-figura={w.fuente.src}>
  <div class="d12-zoom a12-fila" role="group" aria-label="Tamaño de la figura">
    <button type="button" class="a12-boton" onclick={() => cambiarZoom(1 / 1.5)} disabled={zoom <= 1} aria-label="Reducir la figura" data-reducir>−</button>
    <button type="button" class="a12-boton" onclick={() => cambiarZoom(1.5)} disabled={zoom >= ZOOM_MAX} aria-label="Ampliar la figura" data-ampliar>+</button>
    {#if zoom > 1}<button type="button" class="a12-boton" onclick={() => (zoom = 1)} data-entera>Ver entera</button>{/if}
  </div>
  <!-- (zoomed in, the frame scrolls: it takes the focus so the arrows scroll it, WCAG «scrollable region focusable») -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
  <div
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
    <div class="d12-lienzo" class:vectorial={w.fuente.vectorial} style:width={`${zoom * 100}%`} style:aspect-ratio={`${vw} / ${vh}`}>
      <img {src} alt={w.fuente.alt} draggable="false" />
      <!-- the zones: pointer targets over the picture (the list below is the keyboard and screen reader way) -->
      <svg bind:this={svg} viewBox={`${vx} ${vy} ${vw} ${vh}`} preserveAspectRatio="none" aria-hidden="true" onclick={tocarEn} data-zonas>
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
          data-boton-zona={z.id}><TextoVivo texto={z.rotulo} {valor} />{#if st === 'mal'}<span class="a12-solo-lector"> (descartada)</span>{/if}</button
        >
      </li>
    {/each}
  </ul>
  <p class="d12-info" aria-live="polite" id={`${prefijo}-zona`} data-info-zona>
    {#if zonaTexto}<strong><TextoVivo texto={zonaTexto.rotulo} {valor} /></strong>{#if zonaTexto.texto}: <TextoVivo texto={zonaTexto.texto} {valor} />{/if}{:else if mensaje}{mensaje}{/if}
  </p>
</div>
