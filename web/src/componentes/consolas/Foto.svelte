<script lang="ts">
  // «Foto» tab: the board photos with a hotspot on every identified part. Tap (or hover with a mouse) to see
  // what it is; a tap picks the nearest hotspot within a finger's width, and the list below the photo gives
  // every part a full-size button. Machines with several photos (other face, another revision, a bare board)
  // get a photo switcher; a photo with traces (Game Boy) lights up the copper of a net or a whole bus, and a
  // photo aligned with a PCB (Mega Drive) marks where any schematic part sits.
  import { untrack } from 'svelte';
  import { cargarTrazas, fotosDe, htmlKicad, nombreRed, type DatosMaquina, type Hotspot, type Trazas } from './datos';
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
  const fotos = $derived(fotosDe(datos));
  let indice = $state(0);
  const foto = $derived(fotos[Math.min(indice, fotos.length - 1)]!);
  const hotspots = $derived(foto.hotspots);

  // The selection picks the photo that shows it (a hotspot, a part, a traced net); otherwise the photo stays.
  $effect(() => {
    const s = sel;
    const lista = fotos;
    if (!s) return;
    let i = -1;
    const actual = untrack(() => indice);
    const enActual = (f: (typeof lista)[number]): boolean =>
      s.tipo === 'foto' ? f.hotspots.some((h) => h.id === s.id)
        : s.tipo === 'componente' ? f.hotspots.some((h) => h.esquema.includes(s.id)) || !!f.posiciones?.[s.id]
          : s.tipo === 'bloque' ? f.hotspots.some((h) => h.bloque === s.id)
            : s.tipo === 'red' ? !!f.trazas_redes?.includes(s.id) : false;
    if (lista[actual] && enActual(lista[actual]!)) return;
    if (s.tipo === 'componente') i = lista.findIndex((f) => f.hotspots.some((h) => h.esquema.includes(s.id)));
    if (i < 0) i = lista.findIndex(enActual);
    if (i >= 0) indice = i;
  });

  const elegido = $derived.by((): Hotspot | null => {
    if (!sel) return null;
    if (sel.tipo === 'foto') return hotspots.find((h) => h.id === sel.id) ?? null;
    if (sel.tipo === 'componente') return hotspots.find((h) => h.esquema.includes(sel.id)) ?? null;
    if (sel.tipo === 'bloque') return hotspots.find((h) => h.bloque === sel.id) ?? null;
    return null;
  });

  // A schematic part without a hotspot on a PCB-aligned photo: a marker at its footprint.
  const marcador = $derived.by((): { ref: string; x: number; y: number } | null => {
    if (sel?.tipo !== 'componente' || elegido) return null;
    const p = foto.posiciones?.[sel.id];
    return p ? { ref: sel.id, x: p[0], y: p[1] } : null;
  });

  // ------------------------------------------------------------------ copper traces

  let trazas: Trazas | null = $state(null);
  let grupo = $state('');
  $effect(() => {
    const ruta = foto.trazas;
    trazas = null;
    if (!ruta) return;
    let vivo = true;
    cargarTrazas(ruta)
      .then((t) => {
        if (vivo) trazas = t;
      })
      .catch(() => {
        /* the photo still works without its traces */
      });
    return () => {
      vivo = false;
    };
  });
  const redSel = $derived(sel?.tipo === 'red' && foto.trazas_redes?.includes(sel.id) ? sel.id : null);
  const grupoDe = $derived(new Map(datos.redes.map((r) => [r.n, r.g])));
  const gruposTrazados = $derived.by(() => {
    const out: { g: string; nombre: string; redes: string[] }[] = [];
    for (const n of foto.trazas_redes ?? []) {
      const g = grupoDe.get(n) ?? 'otras';
      let e = out.find((x) => x.g === g);
      if (!e) out.push((e = { g, nombre: datos.grupos[g] ?? 'Otras redes', redes: [] }));
      e.redes.push(n);
    }
    for (const e of out) e.redes.sort((a, b) => nombreRed(a).nombre.localeCompare(nombreRed(b).nombre, 'es', { numeric: true }));
    return out;
  });
  const redesGrupo = $derived(gruposTrazados.find((x) => x.g === grupo)?.redes ?? []);
  const resaltadas = $derived.by(() => {
    if (!trazas) return [] as { n: string; d: string[]; propia: boolean }[];
    const set = new Set(redesGrupo);
    if (redSel) set.add(redSel);
    return [...set].map((n) => ({ n, d: trazas!.redes[n] ?? [], propia: n === redSel }));
  });

  // ------------------------------------------------------------------ pointer

  function cercano(ev: PointerEvent, radioCss: number): Hotspot | null {
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    const kx = foto.ancho / r.width;
    const x = (ev.clientX - r.left) * kx;
    const y = (ev.clientY - r.top) * kx;
    const tol = radioCss * kx;
    let mejor: Hotspot | null = null;
    let dmin = Infinity;
    let area = Infinity;
    for (const h of hotspots) {
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

  function cambiarFoto(i: number): void {
    indice = i;
    encima = null;
    grupo = '';
    if (sel && sel.tipo !== 'componente' && sel.tipo !== 'red') seleccionar(null);
  }

  const mostrado = $derived(elegido ?? null);
  const grupos = $derived(datos.grupos);
  const figura = $derived(datos.foto.figura ? (datos.id === 'nes' ? '36.16' : '36.22') : null);
</script>

<div class="foto-vista">
  <div class="foto-col">
    {#if fotos.length > 1}
      <div class="fotos" role="tablist" aria-label="Foto">
        {#each fotos as f, i (f.id)}
          <button type="button" role="tab" aria-selected={i === indice} class:activo={i === indice} data-foto={f.id} onclick={() => cambiarFoto(i)}>{f.titulo}</button>
        {/each}
      </div>
    {/if}
    <div class="herramientas">
      <span class="pista">Toca un chip o un conector. {hotspots.length} puntos identificados.</span>
      <span class="zoom">
        <button type="button" class="boton-icono" aria-label="Reducir la foto" disabled={ampliacion <= 1} onclick={() => (ampliacion = Math.max(1, ampliacion - 0.5))}><ZoomOut size={19} /></button>
        <button type="button" class="boton-icono" aria-label="Ampliar la foto" disabled={ampliacion >= 3} onclick={() => (ampliacion = Math.min(3, ampliacion + 0.5))}><ZoomIn size={19} /></button>
      </span>
    </div>
    <div class="desplazable">
      <div class="foto" style:width={`${ampliacion * 100}%`} style:aspect-ratio={`${foto.ancho} / ${foto.alto}`}>
        {#key foto.src}<img src={foto.src} alt={`Placa ${datos.placa}: ${foto.titulo ?? ''}`} draggable="false" />{/key}
        <svg
          bind:this={svg}
          viewBox={`0 0 ${foto.ancho} ${foto.alto}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`Puntos interactivos sobre la placa ${datos.placa}`}
          onpointerup={tocar}
          onpointermove={mover}
          onpointerleave={() => (encima = null)}
        >
          {#if resaltadas.length}
            <g class="pistas" data-redes={resaltadas.length}>
              {#each resaltadas as r (r.n)}
                {#each r.d as d, i (i)}<path {d} class:propia={r.propia} />{/each}
              {/each}
            </g>
          {/if}
          {#each hotspots as h (h.id)}
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
          {#if marcador}
            <g class="marcador" data-ref={marcador.ref}>
              <circle cx={marcador.x} cy={marcador.y} r="26" />
              <line x1={marcador.x - 44} y1={marcador.y} x2={marcador.x - 14} y2={marcador.y} />
              <line x1={marcador.x + 14} y1={marcador.y} x2={marcador.x + 44} y2={marcador.y} />
              <line x1={marcador.x} y1={marcador.y - 44} x2={marcador.x} y2={marcador.y - 14} />
              <line x1={marcador.x} y1={marcador.y + 14} x2={marcador.x} y2={marcador.y + 44} />
              <text class="rotulo" x={marcador.x + 32} y={Math.max(marcador.y - 32, 28)}>{marcador.ref}</text>
            </g>
          {/if}
          {#if encima && encima.id !== mostrado?.id}
            {@const c = encima.cajas[0]!}
            <text class="rotulo" x={c[0]} y={Math.max(c[1] - 10, 28)}>{encima.nombre}</text>
          {/if}
        </svg>
      </div>
    </div>
    {#if foto.credito || foto.nota}
      <p class="credito">{foto.titulo}{foto.revision ? ` · ${foto.revision}` : ''}{foto.credito ? ` · ${foto.credito}` : ''}{foto.nota ? `. ${foto.nota}` : ''}</p>
    {/if}
    {#if foto.trazas_redes?.length}
      <section class="trazas" aria-label="Pistas de cobre">
        <div class="cab-trazas">
          <strong>Pistas de cobre</strong>
          <label>
            <span class="solo-lector">Bus o grupo de redes</span>
            <select bind:value={grupo} aria-label="Resaltar un grupo de redes">
              <option value="">Ningún grupo</option>
              {#each gruposTrazados as g (g.g)}<option value={g.g}>{g.nombre} ({g.redes.length})</option>{/each}
            </select>
          </label>
          {#if !trazas}<span class="cargando-trazas">cargando…</span>{/if}
        </div>
        <p class="ayuda">Elige un grupo para ver todas sus pistas, o una red para verla sola (en rojo). El dibujo de las pistas es de Gekkio y está alineado con el escaneo.</p>
        {#if redesGrupo.length}
          <div class="chips-redes">
            {#each redesGrupo as n (n)}
              <button type="button" class:activo={n === redSel} onclick={() => seleccionar(n === redSel ? null : { tipo: 'red', id: n })}>{@html htmlKicad(nombreRed(n).nombre)}</button>
            {/each}
          </div>
        {/if}
        {#if redSel}
          <p class="red-sel">Red <strong>{@html htmlKicad(nombreRed(redSel).nombre)}</strong> resaltada.</p>
          <button type="button" class="accion" onclick={() => irA('esquema', { tipo: 'red', id: redSel })}>Ver la red en el esquema</button>
        {/if}
      </section>
    {/if}
    <ul class="lista" aria-label="Componentes identificados">
      {#each hotspots as h (h.id)}
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
      <p class="funcion">{mostrado.funcion}</p>
      {#if mostrado.buses.length}
        <p class="sub">Buses y señales</p>
        <div class="chips">
          {#each mostrado.buses as b (b)}<span class="chip">{grupos[b] ?? b}</span>{/each}
        </div>
      {/if}
      <p class="confianza">
        {mostrado.confianza === 'marca'
          ? 'Identificado por la marca o la serigrafía legibles en la foto.'
          : 'Identificado por su posición (mapa de la placa); la marca no se lee en la foto.'}
      </p>
      {#if mostrado.verificacion}
        <p class="verificado"><strong>Comprobado con documentos de SNK:</strong> {mostrado.verificacion}</p>
      {/if}
      <div class="acciones">
        {#if mostrado.esquema.length}
          <button type="button" class="accion" onclick={() => irA('esquema', { tipo: 'componente', id: mostrado.esquema[0]! })}>
            Ver en el esquema{datos.id === 'neogeo' ? ` (${mostrado.esquema[0]})` : ''}
          </button>
        {/if}
        <button type="button" class="accion" onclick={() => irA('arquitectura', { tipo: 'bloque', id: mostrado.bloque })}>Ver en la arquitectura</button>
      </div>
      {#if foto.trazas_redes?.length && mostrado.esquema.length}
        <p class="nota">Para ver por dónde van sus pistas, elige abajo un bus o una red.</p>
      {/if}
      {#if datos.id === 'neogeo' && mostrado.esquema.length}
        <p class="nota">El esquema es el de la NEO-AES3-5 (2.ª generación): {mostrado.esquema.map((r) => `${r} = ${datos.componentes[r]?.v ?? '?'}`).join(', ')}.</p>
      {/if}
    {:else if marcador}
      <p class="tipo">Componente del esquema</p>
      <h3>{marcador.ref} <span class="valor">{datos.componentes[marcador.ref]?.v ?? ''}</span></h3>
      <p class="confianza">{foto.posiciones_nota ?? 'Posición de su huella en la placa'}. No tiene recuadro propio en la foto.</p>
      <div class="acciones">
        <button type="button" class="accion" onclick={() => irA('esquema', { tipo: 'componente', id: marcador.ref })}>Ver en el esquema</button>
      </div>
    {:else}
      <p class="tipo">{datos.placa}</p>
      <h3>{datos.titulo}</h3>
      {#if figura}
        <p>Figura {figura} del libro. Los recuadros continuos marcan piezas cuya serigrafía o marca se lee en la foto; los discontinuos, piezas identificadas por su posición.</p>
      {:else}
        <p>{foto.titulo}. Los recuadros continuos marcan piezas cuya serigrafía o marca se lee en la foto; los discontinuos, piezas identificadas por su posición.</p>
      {/if}
      {#if foto.posiciones}<p class="confianza">Desde el esquema, cualquier componente se puede situar en esta foto: su huella se ha alineado con la de la PCB de la recreación.</p>{/if}
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
  .fotos {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-bottom: 8px;
  }
  .fotos button,
  .chips-redes button {
    min-height: 34px;
    padding: 3px 12px;
    border: 1px solid var(--linea);
    border-radius: 999px;
    background: var(--superficie);
    color: var(--tinta);
    font: inherit;
    font-size: 14px;
    cursor: pointer;
  }
  @media (max-width: 640px) {
    /* one scrollable row instead of a stack of pills on phones */
    .fotos {
      flex-wrap: nowrap;
      overflow-x: auto;
      scrollbar-width: none;
      margin-inline: -12px;
      padding-inline: 12px;
    }
    .fotos button {
      flex: none;
      white-space: nowrap;
    }
  }
  .fotos button.activo,
  .chips-redes button.activo {
    border-color: var(--acento);
    background: var(--acento-tinte);
    color: var(--acento);
    font-weight: 700;
  }
  .credito {
    margin: 6px 0 0;
    color: var(--tinta-suave);
    font-size: 13px;
  }
  .trazas {
    margin-top: 10px;
    padding: 10px 12px;
    border-radius: 12px;
    background: var(--superficie);
    box-shadow:
      0 0 0 1px var(--linea),
      var(--sombra);
  }
  .cab-trazas {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
  }
  .cab-trazas select {
    height: 38px;
    max-width: 100%;
    padding: 0 8px;
    border: 1px solid var(--linea);
    border-radius: 10px;
    background: var(--superficie);
    color: var(--tinta);
    font: inherit;
    font-size: 14px;
  }
  .trazas .ayuda,
  .red-sel {
    margin: 6px 0;
    color: var(--tinta-suave);
    font-size: 13.5px;
  }
  .cargando-trazas {
    color: var(--tinta-suave);
    font-size: 13px;
  }
  .chips-redes {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }
  .chips-redes button {
    min-height: 30px;
    padding: 2px 9px;
    font-size: 13px;
  }
  .chips-redes :global(.sobre),
  .red-sel :global(.sobre) {
    text-decoration: overline;
  }
  .pistas path {
    fill: #ffb000;
    fill-opacity: 0.78;
    stroke: #3a2500;
    stroke-width: 1.2;
    stroke-opacity: 0.6;
    pointer-events: none;
  }
  .pistas path.propia {
    fill: #ff2d55;
    fill-opacity: 0.9;
  }
  .marcador circle,
  .marcador line {
    fill: none;
    stroke: #ff2d55;
    stroke-width: 4;
    vector-effect: non-scaling-stroke;
    pointer-events: none;
  }
  .valor {
    color: var(--tinta-suave);
    font-size: 15px;
    font-weight: 600;
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
  .funcion,
  .verificado {
    white-space: pre-line;
  }
  .verificado {
    padding: 6px 9px;
    border-left: 3px solid var(--c-ejemplo);
    border-radius: 0 8px 8px 0;
    background: var(--superficie-2);
    font-size: 13.5px;
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
    .fotos button,
    .chips-redes button,
    .cab-trazas select,
    .accion {
      min-height: 44px;
    }
    .zoom :global(.boton-icono) {
      width: 44px;
      height: 44px;
    }
  }
</style>
