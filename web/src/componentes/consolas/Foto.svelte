<script lang="ts">
  // «Foto» tab: the book's photo with a hotspot on every identified part. Tap (or hover with a mouse) to see
  // what it is; a tap picks the nearest hotspot within a finger's width, and the list below the photo gives
  // every part a full-size button.
  import type { DatosMaquina, Hotspot } from './datos';
  import type { Seleccion } from './estado.svelte';
  import ZoomIn from '@lucide/svelte/icons/zoom-in';
  import ZoomOut from '@lucide/svelte/icons/zoom-out';

  let {
    datos,
    sel,
    seleccionar,
    irA,
  }: {
    datos: DatosMaquina;
    sel: Seleccion | null;
    seleccionar: (s: Seleccion | null) => void;
    irA: (pestana: 'esquema' | 'arquitectura', s: Seleccion) => void;
  } = $props();

  let ampliacion = $state(1);
  let encima: Hotspot | null = $state(null);
  let svg: SVGSVGElement | undefined = $state();

  const elegido = $derived.by((): Hotspot | null => {
    if (!sel) return null;
    if (sel.tipo === 'foto') return datos.hotspots.find((h) => h.id === sel.id) ?? null;
    if (sel.tipo === 'componente') return datos.hotspots.find((h) => h.esquema.includes(sel.id)) ?? null;
    if (sel.tipo === 'bloque') return datos.hotspots.find((h) => h.bloque === sel.id) ?? null;
    return null;
  });

  function cercano(ev: PointerEvent, radioCss: number): Hotspot | null {
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    const kx = datos.foto.ancho / r.width;
    const x = (ev.clientX - r.left) * kx;
    const y = (ev.clientY - r.top) * kx;
    const tol = radioCss * kx;
    let mejor: Hotspot | null = null;
    let dmin = Infinity;
    let area = Infinity;
    for (const h of datos.hotspots) {
      for (const [x0, y0, x1, y1] of h.cajas) {
        const dx = Math.max(x0 - x, 0, x - x1);
        const dy = Math.max(y0 - y, 0, y - y1);
        const d = Math.hypot(dx, dy);
        const a = (x1 - x0) * (y1 - y0);
        // inside several boxes: the smallest wins (a chip on top of a board)
        if (d < dmin - 1e-9 || (d === 0 && dmin === 0 && a < area)) {
          dmin = d;
          area = a;
          mejor = h;
        }
      }
    }
    return dmin <= tol ? mejor : null;
  }

  function tocar(ev: PointerEvent): void {
    const h = cercano(ev, ev.pointerType === 'mouse' ? 4 : 22);
    seleccionar(h ? { tipo: 'foto', id: h.id } : null);
  }

  function mover(ev: PointerEvent): void {
    if (ev.pointerType !== 'mouse') return;
    encima = cercano(ev, 4);
  }

  const mostrado = $derived(elegido ?? null);
  const grupos = $derived(datos.grupos);
</script>

<div class="foto-vista">
  <div class="foto-col">
    <div class="herramientas">
      <span class="pista">Toca un chip o un conector. {datos.hotspots.length} puntos identificados.</span>
      <span class="zoom">
        <button type="button" class="boton-icono" aria-label="Reducir la foto" disabled={ampliacion <= 1} onclick={() => (ampliacion = Math.max(1, ampliacion - 0.5))}><ZoomOut size={19} /></button>
        <button type="button" class="boton-icono" aria-label="Ampliar la foto" disabled={ampliacion >= 3} onclick={() => (ampliacion = Math.min(3, ampliacion + 0.5))}><ZoomIn size={19} /></button>
      </span>
    </div>
    <div class="desplazable">
      <div class="foto" style:width={`${ampliacion * 100}%`} style:aspect-ratio={`${datos.foto.ancho} / ${datos.foto.alto}`}>
        <img src={datos.foto.src} alt={`Placa ${datos.placa}`} draggable="false" />
        <svg
          bind:this={svg}
          viewBox={`0 0 ${datos.foto.ancho} ${datos.foto.alto}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`Puntos interactivos sobre la placa ${datos.placa}`}
          onpointerup={tocar}
          onpointermove={mover}
          onpointerleave={() => (encima = null)}
        >
          {#each datos.hotspots as h (h.id)}
            {#each h.cajas as c, i (i)}
              <rect
                class="punto"
                class:elegido={mostrado?.id === h.id}
                class:encima={encima?.id === h.id}
                class:dudoso={h.confianza === 'posicion'}
                data-id={h.id}
                x={c[0]}
                y={c[1]}
                width={c[2] - c[0]}
                height={c[3] - c[1]}
                rx="6"
              />
            {/each}
          {/each}
          {#if encima && encima.id !== mostrado?.id}
            {@const c = encima.cajas[0]!}
            <text class="rotulo" x={c[0]} y={Math.max(c[1] - 10, 28)}>{encima.nombre}</text>
          {/if}
        </svg>
      </div>
    </div>
    <ul class="lista" aria-label="Componentes identificados">
      {#each datos.hotspots as h (h.id)}
        <li>
          <button type="button" class:activo={mostrado?.id === h.id} data-hotspot={h.id} onclick={() => seleccionar({ tipo: 'foto', id: h.id })}>
            {h.nombre}
          </button>
        </li>
      {/each}
    </ul>
  </div>

  <aside class="ficha" aria-live="polite">
    {#if mostrado}
      <p class="tipo">{mostrado.esquema.length ? mostrado.esquema.join(', ') : 'Sin referencia en el esquema'}</p>
      <h3>{mostrado.nombre}</h3>
      <p class="pieza">{mostrado.pieza}</p>
      <p>{mostrado.funcion}</p>
      {#if mostrado.buses.length}
        <p class="sub">Buses y señales</p>
        <div class="chips">
          {#each mostrado.buses as b (b)}<span class="chip">{grupos[b] ?? b}</span>{/each}
        </div>
      {/if}
      <p class="confianza">
        {mostrado.confianza === 'marca'
          ? 'Identificado por la marca legible en la foto.'
          : 'Identificado por su posición (serigrafía o mapa de la placa); la marca no se lee en la foto.'}
      </p>
      <div class="acciones">
        {#if mostrado.esquema.length}
          <button type="button" class="accion" onclick={() => irA('esquema', { tipo: 'componente', id: mostrado.esquema[0]! })}>
            Ver en el esquema{datos.id === 'neogeo' ? ` (${mostrado.esquema[0]})` : ''}
          </button>
        {/if}
        <button type="button" class="accion" onclick={() => irA('arquitectura', { tipo: 'bloque', id: mostrado.bloque })}>Ver en la arquitectura</button>
      </div>
      {#if datos.id === 'neogeo' && mostrado.esquema.length}
        <p class="nota">El esquema es el de la NEO-AES3-5 (2.ª generación): {mostrado.esquema.map((r) => `${r} = ${datos.componentes[r]?.v ?? '?'}`).join(', ')}.</p>
      {/if}
    {:else}
      <p class="tipo">{datos.placa}</p>
      <h3>{datos.titulo}</h3>
      <p>Figura {datos.id === 'nes' ? '36.16' : '36.22'} del libro. Los recuadros continuos marcan piezas cuya serigrafía o marca se lee en la foto; los discontinuos, piezas identificadas por su posición.</p>
      <p>Elige una pieza para ver qué hace, por qué buses pasa y saltar a su símbolo en el esquema o a su bloque en la arquitectura.</p>
    {/if}
  </aside>
</div>

<style>
  .foto-vista {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 320px;
    gap: 12px;
    align-items: start;
  }
  .herramientas {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
    color: var(--tinta-suave);
    font-size: 14px;
  }
  .zoom {
    display: inline-flex;
    gap: 4px;
  }
  .desplazable {
    overflow: auto;
    border-radius: 12px;
    box-shadow:
      0 0 0 1px var(--linea),
      var(--sombra);
    background: #000;
  }
  .foto {
    position: relative;
  }
  .foto img,
  .foto svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
  }
  .foto svg {
    touch-action: pan-x pan-y pinch-zoom;
    cursor: pointer;
  }
  .punto {
    fill: rgba(255, 196, 0, 0.06);
    stroke: rgba(255, 214, 90, 0.85);
    stroke-width: 3;
    vector-effect: non-scaling-stroke;
    transition:
      fill 0.15s,
      stroke 0.15s;
  }
  .punto.dudoso {
    stroke-dasharray: 7 5;
  }
  .punto.encima {
    fill: rgba(255, 196, 0, 0.22);
    stroke: #ffd65a;
  }
  .punto.elegido {
    fill: rgba(46, 160, 255, 0.25);
    stroke: #4fb3ff;
    stroke-width: 4;
  }
  .rotulo {
    fill: #fff;
    stroke: rgba(0, 0, 0, 0.75);
    stroke-width: 6px;
    paint-order: stroke;
    font: 700 28px var(--sans);
    pointer-events: none;
  }
  .lista {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 10px 0 0;
    padding: 0;
    list-style: none;
  }
  .lista button {
    min-height: 34px;
    padding: 3px 11px;
    border: 1px solid var(--linea);
    border-radius: 999px;
    background: var(--superficie);
    color: var(--tinta);
    font: inherit;
    font-size: 14px;
    cursor: pointer;
  }
  .lista button.activo {
    border-color: var(--acento);
    background: var(--acento-tinte);
    color: var(--acento);
    font-weight: 700;
  }
  .ficha {
    padding: 14px;
    border-radius: 12px;
    background: var(--superficie);
    box-shadow:
      0 0 0 1px var(--linea),
      var(--sombra);
    font-size: 15px;
  }
  .ficha h3 {
    margin: 2px 0 2px;
    color: var(--titulos);
    font-size: 20px;
  }
  .tipo {
    margin: 0;
    color: var(--tinta-tenue);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .pieza {
    margin: 0 0 8px;
    color: var(--acento);
    font-weight: 600;
  }
  .sub {
    margin: 10px 0 4px;
    font-weight: 700;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }
  .chip {
    padding: 2px 9px;
    border-radius: 999px;
    background: var(--superficie-2);
    font-size: 13px;
  }
  .confianza,
  .nota {
    color: var(--tinta-suave);
    font-size: 13.5px;
  }
  .acciones {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .accion {
    min-height: 38px;
    padding: 4px 13px;
    border: 1px solid var(--acento-borde);
    border-radius: 999px;
    background: var(--acento-tinte);
    color: var(--acento);
    font: inherit;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
  }
  @media (max-width: 1023px) {
    .foto-vista {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  @media (pointer: coarse) {
    .lista button,
    .accion {
      min-height: 44px;
    }
    .zoom :global(.boton-icono) {
      width: 44px;
      height: 44px;
    }
  }
</style>
