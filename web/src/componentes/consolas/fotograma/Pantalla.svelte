<script lang="ts">
  // «Un fotograma»: the small example screen. It shows how far the frame has got at the current step: the previous
  // frame dimmed while the CPU works, the followed tile placed by the map, the bits of the followed row, its colour
  // indices and colours, the pixel leaving for the screen and, at the end, the finished frame. A zoom of the tile
  // and a strip with the arithmetic of the followed row sit next to the screen.
  import { ETAPAS, type Ejemplo, type Etapa } from './tipos';
  import { byteDe, filaSeguida, hex2, indiceSeguido, nibbles, planos, puntoSeguido, ventana } from './ejemplo';

  let { ejemplo: e, etapa, nota }: { ejemplo: Ejemplo; etapa: Etapa; nota?: string } = $props();

  const nivel = $derived(ETAPAS.indexOf(etapa));
  const [px, py] = $derived(puntoSeguido(e));
  const idx = $derived(indiceSeguido(e));
  const maxIndice = $derived(Math.max(1, ...e.indices.flat()));
  const [v0, v1] = $derived(ventana(e));
  const fila = $derived(filaSeguida(e));
  const bits = $derived(planos(e));
  const bytes = $derived(e.formato === 'nibbles' ? nibbles(e) : bits.map(byteDe));
  const digito = (i: number) => i.toString(16).toUpperCase();

  /** Colour of a tile pixel on screen (index 0 shows the backdrop). */
  const colorDe = (i: number) => (i === 0 ? e.fondo : (e.colores[i] ?? e.fondo));
  /** Light colours get dark digits on them. */
  function claro(c: string): boolean {
    const m = /^#([0-9a-f]{6})$/i.exec(c);
    if (!m) return false;
    const n = parseInt(m[1]!, 16);
    return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 150;
  }
  /** Grey used before the palette is applied. */
  const grisDe = (i: number) => `color-mix(in srgb, var(--tinta) ${Math.round(18 + (62 * i) / maxIndice)}%, var(--superficie))`;

  // Pixels of the tile with the part of the new frame already drawn (stage «punto»: rows above the followed one
  // and the followed row up to the followed pixel).
  function dibujado(f: number, c: number): boolean {
    if (nivel >= 8) return true;
    if (nivel < 7) return false;
    return f < e.fila || (f === e.fila && c <= e.columna);
  }

  function colorZoom(f: number, c: number): string {
    const i = e.indices[f]![c]!;
    if (nivel === 0) return 'var(--superficie-2)';
    const enColor = nivel >= 8 || (nivel === 7 && dibujado(f, c)) || (nivel >= 6 && f === e.fila && c >= v0 && c < v1);
    if (enColor) return colorDe(i);
    return i === 0 ? 'transparent' : grisDe(i);
  }

  const titulo = $derived(
    nivel === 0
      ? 'Cuadro anterior'
      : nivel >= 8
        ? 'Cuadro terminado'
        : nivel === 7
          ? `Cuadro nuevo · línea ${py}`
          : 'Preparando el cuadro',
  );

  const notaAuto = $derived.by(() => {
    const coord = `(${px}, ${py})`;
    switch (etapa) {
      case 'cuadro-anterior':
        return 'En pantalla sigue el cuadro anterior: este todavía no ha empezado a dibujarse.';
      case 'vram':
        return `El dibujo de la tesela ${e.numero} ya está en la memoria de vídeo: ${e.tesela} × ${e.tesela} puntos de ${e.bpp} bits.`;
      case 'mapa':
        return `La tesela ${e.numero} ocupa los puntos ${e.x}–${e.x + e.tesela - 1} de las líneas ${e.y}–${e.y + e.tesela - 1}.`;
      case 'patron':
        return e.formato === 'nibbles'
          ? `Fila ${e.fila} de la tesela: ${bytes.length} bytes, dos puntos en cada uno.`
          : `Fila ${e.fila} de la tesela: cada plano guarda un bit de cada uno de sus ${v1 - v0} puntos.`;
      case 'mezcla':
      case 'prioridad':
        return `El punto ${e.columna} de la fila vale ${digito(idx)}: es el punto ${coord} de la pantalla.`;
      case 'paleta':
        return `Índice ${digito(idx)} → color ${e.color}.`;
      case 'punto':
        return `Sale el punto ${coord}; lo anterior a él en este cuadro ya está dibujado.`;
      default:
        return 'Cuadro terminado. El siguiente empieza igual.';
    }
  });
</script>

<div class="pantalla" data-etapa={etapa}>
  <div class="cab">
    <span class="t09-rotulo">{e.pantalla ?? 'Pantalla'}</span>
    <span class="estado">{titulo}</span>
  </div>

  <div class="vistas">
    <!-- the whole screen -->
    <svg class="mini" viewBox={`0 0 ${e.ancho} ${e.alto}`} style:aspect-ratio={`${e.ancho} / ${e.alto}`} role="img" aria-label={`${titulo}: pantalla de ${e.ancho} × ${e.alto} puntos`}>
      <!-- previous frame, dimmed -->
      <rect x="0" y="0" width={e.ancho} height={e.alto} fill={e.fondo} />
      {#each e.indices as f, r (r)}
        {#each f as i, c (c)}
          {#if i}<rect x={e.x + c} y={e.y + r} width="1" height="1" fill={colorDe(i)} />{/if}
        {/each}
      {/each}
      {#if nivel < 8}
        <rect class="velo" x="0" y="0" width={e.ancho} height={e.alto} />
        {#if nivel === 7}
          <!-- the new frame up to the followed pixel -->
          <rect x="0" y="0" width={e.ancho} height={py} fill={e.fondo} />
          <rect x="0" y={py} width={px + 1} height="1" fill={e.fondo} />
          {#each e.indices as f, r (r)}
            {#each f as i, c (c)}
              {#if i && dibujado(r, c)}<rect x={e.x + c} y={e.y + r} width="1" height="1" fill={colorDe(i)} />{/if}
            {/each}
          {/each}
          <line class="haz" x1={px + 1} y1={py + 0.5} x2={e.ancho} y2={py + 0.5} />
        {/if}
      {/if}
      {#if nivel >= 2}
        <rect class="marco" x={e.x - 1} y={e.y - 1} width={e.tesela + 2} height={e.tesela + 2} />
      {/if}
      {#if nivel >= 7}
        <circle class="anillo" cx={px + 0.5} cy={py + 0.5} r={Math.max(4, e.ancho / 40)} />
      {/if}
    </svg>

    <!-- the tile, enlarged -->
    <svg class="zoom" viewBox={`-0.1 -0.1 ${e.tesela + 0.2} ${e.tesela + 0.2}`} role="img" aria-label={`Tesela ${e.numero} ampliada`}>
      <rect class="cuadros" x="0" y="0" width={e.tesela} height={e.tesela} />
      {#each e.indices as f, r (r)}
        {#each f as _, c (c)}
          <rect x={c} y={r} width="1" height="1" fill={colorZoom(r, c)} />
        {/each}
      {/each}
      {#each { length: e.tesela + 1 }, k (k)}
        <line class="rejilla" x1={k} y1="0" x2={k} y2={e.tesela} />
        <line class="rejilla" x1="0" y1={k} x2={e.tesela} y2={k} />
      {/each}
      {#if nivel >= 3}
        <rect class="fila" x={v0} y={e.fila} width={v1 - v0} height="1" />
      {/if}
      {#if nivel >= 4}
        <rect class="celda" x={e.columna} y={e.fila} width="1" height="1" />
      {/if}
    </svg>
  </div>

  {#if nivel >= 3}
    <!-- the arithmetic of the followed row -->
    <div class="cuentas" style:--n={v1 - v0} data-cuentas>
      {#if e.formato === 'planos'}
        {#each bits as b, p (p)}
          <span class="nombre">Plano {p}</span>
          {#each b as x, c (c)}<span class="bit" class:seguido={v0 + c === e.columna}>{x}</span>{/each}
          <span class="byte">{e.sinHex ? '' : hex2(bytes[p]!)}</span>
        {/each}
      {:else}
        <span class="nombre">Bytes</span>
        {#each bytes as b, k (k)}<span class="bit doble" class:seguido={v0 + 2 * k === e.columna || v0 + 2 * k + 1 === e.columna}>{hex2(b)}</span>{/each}
        <span class="byte"></span>
      {/if}
      {#if nivel >= 4 || e.formato === 'nibbles'}
        <span class="nombre">Índice</span>
        {#each fila as i, c (c)}
          {@const color = nivel >= 6}
          <span class="bit indice" class:seguido={v0 + c === e.columna} class:color class:sobre-claro={color && claro(colorDe(i))} style:--fondo-celda={color ? colorDe(i) : undefined}
            >{digito(i)}</span
          >
        {/each}
        <span class="byte"></span>
      {/if}
    </div>
  {/if}

  <p class="nota">{nota ?? notaAuto}</p>
</div>

<style>
  .pantalla {
    display: grid;
    gap: 12px;
    min-width: 0;
  }
  .cab {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 4px 12px;
  }
  .estado {
    color: var(--tinta-suave);
    font-size: 14px;
    font-weight: 600;
  }
  .vistas {
    display: grid;
    grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
    align-items: center;
    gap: 14px;
  }
  .mini {
    display: block;
    width: 100%;
    height: auto;
    border: 3px solid var(--tinta);
    border-radius: 6px;
    shape-rendering: crispEdges;
    background: #000;
  }
  .velo {
    fill: #000;
    fill-opacity: 0.55;
  }
  .haz {
    stroke: #fff;
    stroke-opacity: 0.5;
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }
  .marco {
    fill: none;
    stroke: var(--ambar-relleno);
    stroke-width: 2;
    vector-effect: non-scaling-stroke;
  }
  .anillo {
    fill: none;
    stroke: #fff;
    stroke-width: 2;
    vector-effect: non-scaling-stroke;
  }
  .zoom {
    display: block;
    width: 100%;
    max-width: 200px;
    height: auto;
    justify-self: center;
    aspect-ratio: 1;
  }
  .cuadros {
    fill: var(--superficie-2);
  }
  .rejilla {
    stroke: var(--linea);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }
  .fila {
    fill: none;
    stroke: var(--ambar-relleno);
    stroke-width: 2.5;
    vector-effect: non-scaling-stroke;
  }
  .celda {
    fill: none;
    stroke: var(--tinta);
    stroke-width: 3;
    vector-effect: non-scaling-stroke;
  }
  .cuentas {
    display: grid;
    grid-template-columns: auto repeat(var(--n), minmax(0, 26px)) auto;
    align-items: center;
    gap: 4px 3px;
    font-family: var(--mono);
    font-size: 14px;
  }
  .nombre {
    padding-right: 6px;
    color: var(--tinta-suave);
    font-family: var(--sans);
    font-size: 13px;
    font-weight: 700;
    white-space: nowrap;
  }
  .bit {
    display: grid;
    place-items: center;
    height: 26px;
    border-radius: 5px;
    background: var(--superficie-2);
    color: var(--tinta);
  }
  .bit.doble {
    grid-column: span 2;
  }
  .bit.seguido {
    outline: 2px solid var(--tinta);
    outline-offset: -2px;
    font-weight: 700;
  }
  .bit.indice.color {
    background: var(--fondo-celda);
    color: #fff;
    text-shadow: 0 0 2px #000, 0 0 2px #000;
  }
  .bit.indice.color.sobre-claro {
    color: #111;
    text-shadow: none;
  }
  .byte {
    padding-left: 6px;
    color: var(--tinta-suave);
    white-space: nowrap;
  }
  .nota {
    margin: 0;
    color: var(--tinta);
    font-size: 15px;
    line-height: 1.45;
  }
</style>
