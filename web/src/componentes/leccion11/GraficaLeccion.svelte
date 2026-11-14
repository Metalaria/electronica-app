<script lang="ts">
  // 1.1 lessons: a function graph whose parameters the reader drags — with the sliders under it, or with the handles
  // on the curve itself (a crest that sets the amplitude, a zero crossing that sets the phase…). A handle moves its
  // parameter to the position that brings it closest to the pointer, so any handle the author places works without an
  // inverse formula. Handles are role="slider" (arrows, Page Up/Down, Home/End, as the sliders: lib/teoria-viva.ts
  // teclaMando) and at least 44 px to touch. The curves are sampled from the lesson's model. Either axis may be
  // logarithmic (a frequency response); fixed marks (τ, the cut-off frequency) are dots with a label and guide lines.
  // A circuit's graph (CircuitoLeccion) is this same plot without its own controls (`conMandos: false`).
  // 1.2 (motor12e): parametric curves (x(p), y(p): Nyquist, the unit circle, an I/Q figure), discrete sequences as
  // stems, an equal-aspect plot (one unit as long on both axes), and curves or marks hidden in a prediction until it
  // is answered (`oculta`: the legend says «¿?» and a note in the plot says the curve comes out on answering).
  import { formatoValor } from '../calculadoras/unidades';
  import { ariaNumero, teclaMando } from '../../lib/teoria-viva';
  import { leerUnidades } from '../../lib/habla-matematicas';
  import { bajaY, baseX, fraccionEje as fr, geometriaGrafica, tamMarca } from '../../lib/leccion11/ejes';
  import { compilarModelo, posicionMasCercana, type Valores } from '../../lib/leccion11/modelo';
  import { textoPlano } from '../../lib/leccion11/texto';
  import type { Asa, Color, Leccion11, WidgetGrafica } from '../../lib/leccion11/tipos';
  import Mandos from './Mandos.svelte';
  import TextoSvg from './TextoSvg.svelte';
  import TextoVivo from './TextoVivo.svelte';

  let {
    leccion,
    widget,
    valores,
    propios,
    oculto,
    prefijo,
    valor,
    alMover,
    conMandos = true,
  }: {
    leccion: Leccion11;
    widget: WidgetGrafica;
    /** Draw the sliders under the plot (a circuit's graph leaves them to the circuit). */
    conMandos?: boolean;
    /** Values and calculations of the model for the card's current state. */
    valores: Valores;
    /** The input values (what a handle's search varies). */
    propios: Valores;
    oculto: boolean;
    prefijo: string;
    valor: (id: string) => string;
    alMover: (valor: string, x: number) => void;
  } = $props();

  const mc = $derived(compilarModelo(leccion.modelo));
  // margins, scales and the tick labels that fit (lib/leccion11/ejes.ts: thinned on long log axes)
  // (review 11c: the labels' size follows the drawing's width on screen, so they render at 11 px or more on a phone)
  let anchoPx = $state(0);
  const tam = $derived(tamMarca(anchoPx));
  const g = $derived(geometriaGrafica(widget.x, widget.y, tam, widget.aspecto));
  // the axes as drawn (an equal-aspect plot widens one of them)
  const ejeX = $derived(g.x);
  const ejeY = $derived(g.y);
  const W = $derived(g.W);
  const H = $derived(g.H);
  const M = $derived(g.M);
  const ancho = $derived(g.ancho);
  const alto = $derived(g.alto);
  const sx = (x: number) => g.sx(x);
  const sy = (y: number) => g.sy(y);
  const etqX = $derived(g.etqX);
  const etqY = $derived(g.etqY);
  /** The k-th of n points along the x axis (evenly spaced on its scale). */
  const enX = (k: number, n: number) => (ejeX.escala === 'log' ? ejeX.min * (ejeX.max / ejeX.min) ** (k / n) : ejeX.min + ((ejeX.max - ejeX.min) * k) / n);
  // (a parametric curve may run far outside the axes: its points are kept within a band around the drawing, where
  // the clip hides them, so the path's coordinates stay small)
  const cerca = (v: number, a: number, b: number) => Math.max(a - 2 * (b - a), Math.min(b + 2 * (b - a), v));
  const escondida = (c: { oculta?: boolean }) => oculto && !!c.oculta;
  const etX = (v: number) => (v === 0 ? '0' : formatoValor(v, widget.x.unidad, 2, true));

  const trazos = $derived(
    widget.curvas.map((c) => {
      if (escondida(c)) return { c, d: '', palitos: [] as { x: number; y: number }[] };
      const f = mc.funcion(c.expr);
      if (c.palitos) {
        // a sequence: one stem per k·paso along the axis
        const p = c.palitos.paso;
        const out: { x: number; y: number }[] = [];
        for (let k = Math.ceil(ejeX.min / p - 1e-9); k * p <= ejeX.max + 1e-9 * p; k++) {
          const y = f({ ...valores, [widget.x.id]: k * p });
          if (Number.isFinite(y)) out.push({ x: k * p, y });
        }
        return { c, d: '', palitos: out };
      }
      let d = '';
      if (c.param && c.x) {
        // parametric: x(p), y(p) over the parameter's range (a gap in the numbers starts a new stroke)
        const fx = mc.funcion(c.x);
        const p0 = mc.funcion(c.param.min)(valores);
        const p1 = mc.funcion(c.param.max)(valores);
        const n = c.param.muestras;
        let seguido = false;
        for (let k = 0; k <= n && Number.isFinite(p0) && Number.isFinite(p1); k++) {
          const v = { ...valores, [c.param.id]: p0 + ((p1 - p0) * k) / n };
          const px = fx(v);
          const py = f(v);
          if (!Number.isFinite(px) || !Number.isFinite(py) || (ejeX.escala === 'log' && !(px > 0)) || (ejeY.escala === 'log' && !(py > 0))) {
            seguido = false;
            continue;
          }
          const X = cerca(sx(px), M.izq, M.izq + ancho);
          const Y = cerca(sy(py), M.arr, M.arr + alto);
          d += `${seguido ? 'L' : 'M'}${X.toFixed(2)} ${Y.toFixed(2)}`;
          seguido = true;
        }
        return { c, d, palitos: [] as { x: number; y: number }[] };
      }
      // (esquemas12c: the x axis' «muestras», for a carrier; 240 by default)
      const n = widget.x.muestras ?? 240;
      for (let k = 0; k <= n; k++) {
        const x = enX(k, n);
        const y = f({ ...valores, [widget.x.id]: x });
        if (!Number.isFinite(y)) continue;
        d += `${d ? 'L' : 'M'}${sx(x).toFixed(2)} ${sy(y).toFixed(2)}`;
      }
      return { c, d, palitos: [] as { x: number; y: number }[] };
    }),
  );
  // the stems' foot: y = 0 if it is on the axis, else its nearer end
  const pie = $derived(ejeY.escala === 'log' ? ejeY.min : Math.max(ejeY.min, Math.min(ejeY.max, 0)));
  const hayOcultas = $derived(widget.curvas.some(escondida) || (widget.marcas ?? []).some(escondida));

  function puntoAsa(a: Pick<Asa, 'x' | 'y'>, v: Valores): [number, number] {
    return [mc.funcion(a.x)(v), mc.funcion(a.y)(v)];
  }
  const puntosMarca = $derived(
    (widget.marcas ?? [])
      .map((m) => ({ m, p: puntoAsa(m, valores) }))
      .filter(({ m, p }) => !escondida(m) && Number.isFinite(p[0]) && Number.isFinite(p[1]) && fr(ejeX, p[0]) >= 0 && fr(ejeX, p[0]) <= 1 && fr(ejeY, p[1]) >= 0 && fr(ejeY, p[1]) <= 1),
  );
  const mandoDe = (a: Asa) => widget.mandos.find((m) => m.valor === a.mueve)!;

  let svg: SVGSVGElement | undefined = $state();
  $effect(() => {
    const el = svg;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => (anchoPx = el.getBoundingClientRect().width));
    ro.observe(el);
    return () => ro.disconnect();
  });
  let arrastre: Asa | null = null;
  function aSvg(ev: PointerEvent): [number, number] | null {
    const m = svg?.getScreenCTM();
    if (!svg || !m) return null;
    const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m.inverse());
    return [p.x, p.y];
  }
  function moverAsa(a: Asa, ev: PointerEvent) {
    const q = aSvg(ev);
    if (!q) return;
    const md = mandoDe(a);
    let mejor = -1;
    let dist = Infinity;
    md.valores.forEach((x, k) => {
      const [px, py] = puntoAsa(a, mc.evaluar({ ...propios, [a.mueve]: x }));
      const d = (sx(px) - q[0]) ** 2 + (sy(py) - q[1]) ** 2;
      if (d < dist - 1e-9) {
        dist = d;
        mejor = k;
      }
    });
    if (mejor >= 0 && md.valores[mejor] !== propios[a.mueve]) alMover(a.mueve, md.valores[mejor]!);
  }
  function bajar(a: Asa, ev: PointerEvent) {
    if (ev.button !== 0) return;
    arrastre = a;
    (ev.currentTarget as Element).setPointerCapture(ev.pointerId);
    (ev.currentTarget as SVGGElement).focus();
    ev.preventDefault();
  }
  function soltar(ev: PointerEvent) {
    arrastre = null;
    const t = ev.currentTarget as Element;
    if (t.hasPointerCapture(ev.pointerId)) t.releasePointerCapture(ev.pointerId);
  }
  function tecla(a: Asa, ev: KeyboardEvent) {
    const md = mandoDe(a);
    const pos = posicionMasCercana(md.valores, propios[a.mueve] ?? 0);
    const k = teclaMando(ev.key, pos, md.valores.length);
    if (k == null) return;
    ev.preventDefault();
    if (k !== pos) alMover(a.mueve, md.valores[k]!);
  }

  const color = (): Color => 'azul';
  const nombre = (id: string) => leccion.modelo.valores[id]?.nombre ?? id;
  const descripcion = $derived(
    `Gráfica de ${widget.curvas.map((c) => textoPlano(c.rotulo) + (escondida(c) ? ' (sale al responder)' : '')).join(' y ')} frente a ${textoPlano(widget.x.rotulo)}, de ${etX(ejeX.min)} a ${etX(ejeX.max)}` +
      (widget.curvas.some((c) => c.param) ? '; curva paramétrica' : '') +
      (widget.curvas.some((c) => c.palitos) ? '; secuencia en palitos' : '') +
      (widget.aspecto === 'igual' ? `; misma escala en los dos ejes, vertical de ${formatoValor(ejeY.min, widget.y.unidad, 2, true)} a ${formatoValor(ejeY.max, widget.y.unidad, 2, true)}` : '') +
      (widget.mandos.length ? `; ${widget.mandos.map((m) => `${nombre(m.valor)} ${valor(m.valor)}`).join(', ')}` : '') +
      (widget.x.escala === 'log' ? '; eje horizontal logarítmico' : '') +
      puntosMarca.map(({ m }) => `; ${textoPlano(m.rotulo, ver)}`).join('') +
      (widget.lectura && !oculto ? `; ${textoPlano(widget.lectura.rotulo).toLowerCase()} ${valor(widget.lectura.valor)}` : ''),
  );
  const ver = (id: string) => {
    if (!oculto) return valor(id);
    const u = (leccion.modelo.valores[id] ?? leccion.modelo.calculos[id])?.unidad ?? '';
    return u ? `¿? ${u}` : '¿?';
  };
  let hablado = $state('');
  $effect(() => {
    const t = widget.lectura ? `${textoPlano(widget.lectura.rotulo)}: ${ver(widget.lectura.valor)}` : '';
    const id = setTimeout(() => (hablado = t), 700);
    return () => clearTimeout(id);
  });
</script>

<div class="grafica" data-grafica>
  <div class="panel">
    {#if widget.lectura}
      <div class="cabecera">
        <span class="rot"><TextoVivo texto={widget.lectura.rotulo} {valor} /></span>
        <span class="lectura" data-lectura={widget.lectura.valor}>{ver(widget.lectura.valor)}</span>
      </div>
    {/if}
    <svg bind:this={svg} viewBox={`0 0 ${W} ${H}`} width="100%" role="group" aria-label={descripcion} data-descripcion style:--tam-marca={`${tam}px`}>
      <defs>
        <clipPath id={`${prefijo}-recorte`}><rect x={M.izq} y={M.arr} width={ancho} height={alto}></rect></clipPath>
      </defs>
      {#each etqY as e (e.v)}
        <line class={e.v === 0 ? 'eje' : 'rejilla'} x1={M.izq} x2={W - M.der} y1={sy(e.v)} y2={sy(e.v)}></line>
        {#if e.visible}<text class="marca" data-marca-y x={M.izq - 6} y={sy(e.v) + bajaY(tam)} text-anchor="end">{e.texto}</text>{/if}
      {/each}
      {#each etqX as e (e.v)}
        <line class={e.v === 0 ? 'eje' : 'rejilla'} y1={M.arr} y2={H - M.aba} x1={sx(e.v)} x2={sx(e.v)}></line>
        {#if e.visible}<text class="marca" data-marca-x x={sx(e.v)} y={H - M.aba + baseX(tam)} text-anchor={e.ancla}>{e.texto}</text>{/if}
      {/each}
      <text class="marca nombre-eje" x={W - M.der} y={H - 2} text-anchor="end"><TextoSvg t={widget.x.rotulo} valor={ver} /></text>
      <g clip-path={`url(#${prefijo}-recorte)`}>
        {#each trazos as t, k (k)}
          {#if t.c.palitos}
            <g class={`palitos ${t.c.color}`} data-palitos={k}>
              {#each t.palitos as q (q.x)}
                <line x1={sx(q.x)} x2={sx(q.x)} y1={sy(pie)} y2={cerca(sy(q.y), M.arr, M.arr + alto)}></line>
                <circle cx={sx(q.x)} cy={cerca(sy(q.y), M.arr, M.arr + alto)} r="3.6"></circle>
              {/each}
            </g>
          {:else if !escondida(t.c)}
            <path class={`curva ${t.c.color}`} class:discontinua={t.c.discontinua} d={t.d} data-parametrica={t.c.param ? k : null}></path>
          {/if}
        {/each}
      </g>
      {#if hayOcultas}
        <text class="marca nota-oculta" x={M.izq + ancho / 2} y={M.arr + alto / 2} text-anchor="middle" data-curva-oculta>¿? La curva sale al responder</text>
      {/if}
      {#each puntosMarca as { m, p }, k (k)}
        {@const derecha = fr(ejeX, p[0]) > 0.62}
        <g class="marca-fija" data-marca={k}>
          {#if m.guias}<path class="guia" d={`M${sx(p[0]).toFixed(2)} ${H - M.aba} V${sy(p[1]).toFixed(2)} H${M.izq}`}></path>{/if}
          <circle class="punto-fijo" cx={sx(p[0])} cy={sy(p[1])} r="5"></circle>
          <text class="rotulo-marca" x={sx(p[0]) + (derecha ? -9 : 9)} y={sy(p[1]) - 8} text-anchor={derecha ? 'end' : 'start'}><TextoSvg t={m.rotulo} valor={ver} /></text>
        </g>
      {/each}
      {#each widget.asas as a (a.mueve + a.x)}
        {@const md = mandoDe(a)}
        {@const [px, py] = puntoAsa(a, valores)}
        {#if Number.isFinite(px) && Number.isFinite(py)}
          <g
            class="asa"
            role="slider"
            tabindex="0"
            aria-label={textoPlano(a.rotulo)}
            aria-valuemin={ariaNumero(md.valores[0] ?? 0)}
            aria-valuemax={ariaNumero(md.valores[md.valores.length - 1] ?? 0)}
            aria-valuenow={ariaNumero(propios[a.mueve] ?? 0)}
            aria-valuetext={leerUnidades(valor(a.mueve))}
            data-asa={a.mueve}
            transform={`translate(${sx(px).toFixed(2)} ${sy(py).toFixed(2)})`}
            onpointerdown={(ev) => bajar(a, ev)}
            onpointermove={(ev) => arrastre === a && moverAsa(a, ev)}
            onpointerup={soltar}
            onpointercancel={soltar}
            onkeydown={(ev) => tecla(a, ev)}
          >
            <circle class="toque" r="29"></circle>
            <circle class="aro" r="14"></circle>
            <circle class="punto" r="8"></circle>
          </g>
        {/if}
      {/each}
    </svg>
    {#if widget.curvas.length > 1 || hayOcultas}
      <div class="leyenda">
        {#each widget.curvas as c, k (k)}
          <span class="ley"><span class={`muestra ${c.color}`} class:discontinua={c.discontinua} class:palito={!!c.palitos} aria-hidden="true"></span><TextoVivo texto={c.rotulo} {valor} />{#if escondida(c)}<span class="ley-oculta">(¿?)</span>{/if}</span>
        {/each}
      </div>
    {/if}
    {#if widget.datos?.length}
      <div class="datos">
        {#each widget.datos as d (d.valor)}
          <span class="dato" data-dato={d.valor}><TextoVivo texto={d.rotulo} valor={ver} /></span>
        {/each}
      </div>
    {/if}
  </div>
  {#if conMandos && widget.mandos.length}
    <Mandos {leccion} mandos={widget.mandos} valores={propios} {prefijo} {color} {alMover} {valor} />
  {/if}
  <div class="solo-lector" aria-live="polite">{hablado}</div>
</div>

<style>
  .grafica {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .panel {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px 12px 12px;
    border-radius: var(--v11-radio-tarjeta);
    background: var(--v11-panel);
  }
  .cabecera {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 4px 12px;
  }
  .rot {
    color: var(--v11-tinta-suave);
    font-size: 14px;
    font-weight: 600;
  }
  .lectura {
    color: var(--v11-naranja-texto);
    font: 700 34px/1.1 var(--v11-titular);
    font-variant-numeric: tabular-nums;
  }
  svg {
    display: block;
    overflow: visible;
    touch-action: pan-y;
  }
  .rejilla {
    stroke: var(--v11-linea);
    stroke-width: 1;
  }
  .eje {
    stroke: var(--v11-tinta-suave);
    stroke-width: 1.5;
  }
  .marca {
    fill: var(--v11-tinta-suave);
    font: 500 var(--tam-marca, 12px) var(--v11-texto);
  }
  .curva {
    fill: none;
    stroke-width: 3;
    stroke-linejoin: round;
  }
  .curva.azul {
    stroke: var(--v11-azul);
  }
  .curva.naranja {
    stroke: var(--v11-naranja);
  }
  .curva.verde {
    stroke: var(--v11-verde);
  }
  .curva.tinta {
    stroke: var(--v11-tinta-suave);
    stroke-width: 2.5;
  }
  .curva.discontinua {
    stroke-dasharray: 7 6;
  }
  .palitos line {
    stroke-width: 2.5;
  }
  .palitos.azul {
    stroke: var(--v11-azul);
    fill: var(--v11-azul);
  }
  .palitos.naranja {
    stroke: var(--v11-naranja);
    fill: var(--v11-naranja);
  }
  .palitos.verde {
    stroke: var(--v11-verde);
    fill: var(--v11-verde);
  }
  .palitos.tinta {
    stroke: var(--v11-tinta-suave);
    fill: var(--v11-tinta-suave);
  }
  .nota-oculta {
    fill: var(--v11-tinta-suave);
    paint-order: stroke;
    stroke: var(--v11-panel);
    stroke-width: 4px;
  }
  .asa {
    cursor: grab;
    touch-action: none;
    outline: none;
  }
  .toque {
    fill: transparent;
  }
  .aro {
    fill: none;
    stroke: transparent;
    stroke-width: 3;
  }
  .asa:focus-visible .aro {
    stroke: var(--v11-foco);
  }
  .punto {
    fill: var(--v11-fondo);
    stroke: var(--v11-azul);
    stroke-width: 3;
  }
  .guia {
    fill: none;
    stroke: var(--v11-tinta-suave);
    stroke-width: 1.2;
    stroke-dasharray: 3 4;
  }
  .punto-fijo {
    fill: var(--v11-naranja);
  }
  .rotulo-marca {
    fill: var(--v11-tinta);
    font: 600 var(--tam-marca, 12px) var(--v11-texto);
    paint-order: stroke;
    stroke: var(--v11-panel);
    stroke-width: 4px;
    stroke-linejoin: round;
  }
  .leyenda,
  .datos {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 14px;
    font-size: 13px;
    font-weight: 500;
    color: var(--v11-tinta);
  }
  .ley {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .muestra {
    display: inline-block;
    width: 22px;
    height: 0;
    border-top: 3px solid var(--v11-azul);
  }
  .muestra.tinta {
    border-top-color: var(--v11-tinta-suave);
  }
  .muestra.naranja {
    border-top-color: var(--v11-naranja);
  }
  .muestra.verde {
    border-top-color: var(--v11-verde);
  }
  .muestra.discontinua {
    border-top-style: dashed;
  }
  .muestra.palito {
    width: 10px;
    height: 10px;
    border: none;
    border-radius: 50%;
    background: var(--v11-azul);
  }
  .muestra.palito.naranja {
    background: var(--v11-naranja);
  }
  .muestra.palito.verde {
    background: var(--v11-verde);
  }
  .muestra.palito.tinta {
    background: var(--v11-tinta-suave);
  }
  .dato {
    padding: 6px 12px;
    border: 1.5px solid var(--v11-borde);
    border-radius: 999px;
    background: var(--v11-fondo);
    font-size: 14px;
    font-weight: 600;
  }
  .solo-lector {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
