<script lang="ts">
  // «Esquema» tab: the real KiCad sheets with interactive nets. Sheets are loaded lazily (drawing + electrical
  // layer); a selected net stays highlighted when moving to another sheet.
  import { untrack } from 'svelte';
  import { app } from '../../../lib/estado.svelte';
  import { cargarCapa, cargarDibujo, htmlKicad, nombreRed, normalizar, textoKicad, type CapaHoja, type DatosMaquina } from '../datos';
  import { decodificar, type Dibujo } from './dibujo';
  import type { Impacto } from './capa';
  import type { Seleccion } from '../estado.svelte';
  import Lienzo from './Lienzo.svelte';
  import ZoomIn from '@lucide/svelte/icons/zoom-in';
  import ZoomOut from '@lucide/svelte/icons/zoom-out';
  import Maximize from '@lucide/svelte/icons/maximize';
  import Search from '@lucide/svelte/icons/search';
  import X from '@lucide/svelte/icons/x';

  let {
    datos,
    sel,
    seleccionar,
    irA,
  }: {
    datos: DatosMaquina;
    sel: Seleccion | null;
    seleccionar: (s: Seleccion | null) => void;
    irA: (pestana: 'foto' | 'arquitectura', s: Seleccion) => void;
  } = $props();

  let hoja = $state(0);
  let dibujo: Dibujo | null = $state(null);
  let capa: CapaHoja | null = $state(null);
  let cargando = $state(false);
  let error = $state('');
  let pasa: { i: Impacto; x: number; y: number } | null = $state(null);
  let enfocar = $state(0);
  let lienzo: Lienzo | undefined = $state();
  let busqueda = $state('');
  let abiertaBusqueda = $state(false);
  let desdeLienzo = 0;

  const indiceRed = $derived(new Map(datos.redes.map((r, i) => [r.n, i])));
  // a photo hotspot or a diagram block selected in another tab becomes its schematic component
  const selE = $derived.by((): Seleccion | null => {
    if (sel?.tipo === 'foto' || sel?.tipo === 'bloque') {
      const h = datos.hotspots.find((x) => (sel.tipo === 'foto' ? x.id === sel.id : x.bloque === sel.id));
      const ref = h?.esquema.find((r) => datos.componentes[r]?.h.length);
      return ref ? { tipo: 'componente', id: ref } : null;
    }
    return sel;
  });
  const red = $derived(selE?.tipo === 'red' ? (indiceRed.get(selE.id) ?? null) : null);
  const comp = $derived(selE?.tipo === 'componente' && datos.componentes[selE.id] ? selE.id : null);
  const hojaActual = $derived(datos.hojas[hoja]!);

  // The selection decides the sheet: stay when it is on this one, else go to its first sheet.
  $effect(() => {
    const s = selE;
    let h: number[] = [];
    if (s?.tipo === 'componente') h = datos.componentes[s.id]?.h ?? [];
    else if (s?.tipo === 'red') {
      const i = indiceRed.get(s.id);
      if (i !== undefined) h = datos.redes[i]!.h;
    }
    const otra = h.length > 0 && !h.includes(untrack(() => hoja));
    if (otra) hoja = h[0]!;
    // a tap on the canvas keeps the view; a search, a list or another tab frames the selection
    if (otra || performance.now() - desdeLienzo > 150) untrack(() => enfocar++);
  });

  // Lazy load of the sheet.
  $effect(() => {
    const hj = datos.hojas[hoja];
    if (!hj) return;
    let vivo = true;
    cargando = true;
    error = '';
    Promise.all([cargarDibujo(hj), cargarCapa(hj)])
      .then(([b, c]) => {
        if (!vivo) return;
        dibujo = decodificar(b);
        capa = c;
        cargando = false;
      })
      .catch((e: unknown) => {
        if (vivo) {
          error = e instanceof Error ? e.message : String(e);
          cargando = false;
        }
      });
    return () => {
      vivo = false;
    };
  });

  function tocar(i: Impacto | null): void {
    desdeLienzo = performance.now();
    if (!i) {
      seleccionar(null);
      return;
    }
    if (i.tipo === 'pin' || i.tipo === 'etiqueta' || i.tipo === 'hilo') {
      if (i.red >= 0) seleccionar({ tipo: 'red', id: datos.redes[i.red]!.n });
    } else if (i.tipo === 'simbolo') seleccionar({ tipo: 'componente', id: i.ref });
    else if (i.tipo === 'subhoja' && i.hoja >= 0) {
      hoja = i.hoja;
    } else if (i.tipo === 'bus') {
      busqueda = textoKicad(i.texto).replace(/\[.*$/, '');
      abiertaBusqueda = true;
    }
  }

  function pasar(i: Impacto | null, x: number, y: number): void {
    pasa = i ? { i, x, y } : null;
  }

  const rojo = $derived.by((): number | null => {
    const i: Impacto | undefined = pasa?.i;
    if (i && (i.tipo === 'pin' || i.tipo === 'etiqueta' || i.tipo === 'hilo') && i.red >= 0) return i.red;
    return null;
  });

  function textoImpacto(i: Impacto): string {
    switch (i.tipo) {
      case 'pin': {
        const c = datos.componentes[i.ref];
        return `${i.ref}.${i.pin}${i.nombre && i.nombre !== i.pin ? ` (${textoKicad(i.nombre)})` : ''}${c ? ` · ${c.v}` : ''} — red ${nombreRed(datos.redes[i.red]?.n ?? '').nombre}`;
      }
      case 'etiqueta':
        return `Etiqueta ${textoKicad(i.texto)} — red ${nombreRed(datos.redes[i.red]?.n ?? '').nombre}`;
      case 'hilo':
        return `Red ${nombreRed(datos.redes[i.red]?.n ?? '').nombre}`;
      case 'simbolo':
        return `${i.ref} · ${datos.componentes[i.ref]?.v ?? ''}`;
      case 'subhoja':
        return `Hoja ${i.nombre}: toca para abrirla`;
      case 'bus':
        return `Bus ${textoKicad(i.texto)}`;
    }
  }

  // ------------------------------------------------------------------ search

  interface Resultado {
    tipo: 'componente' | 'red';
    id: string;
    texto: string;
    detalle: string;
  }

  const resultados = $derived.by((): Resultado[] => {
    const q = normalizar(busqueda.trim());
    if (!q) return [];
    const out: Resultado[] = [];
    for (const [ref, c] of Object.entries(datos.componentes)) {
      const n = normalizar(`${ref} ${c.v}`);
      if (n.includes(q)) out.push({ tipo: 'componente', id: ref, texto: ref, detalle: c.v });
    }
    for (const r of datos.redes) {
      const n = normalizar(textoKicad(r.n));
      if (n.includes(q)) {
        const nr = nombreRed(r.n);
        out.push({ tipo: 'red', id: r.n, texto: nr.nombre, detalle: `red${nr.hoja ? ` · hoja ${nr.hoja}` : ''} · ${r.nodos.length} pines` });
      }
    }
    out.sort((a, b) => {
      const ea = normalizar(a.texto) === q ? 0 : normalizar(a.texto).startsWith(q) ? 1 : 2;
      const eb = normalizar(b.texto) === q ? 0 : normalizar(b.texto).startsWith(q) ? 1 : 2;
      return ea - eb || a.texto.length - b.texto.length || a.texto.localeCompare(b.texto, 'es', { numeric: true });
    });
    return out.slice(0, 40);
  });

  function elegir(r: Resultado): void {
    abiertaBusqueda = false;
    seleccionar({ tipo: r.tipo, id: r.id });
  }

  // ------------------------------------------------------------------ panel

  const redSel = $derived(red !== null ? datos.redes[red]! : null);
  const pinesComp = $derived.by(() => {
    if (!comp) return [];
    const out: { pin: string; func: string; red: string }[] = [];
    for (const r of datos.redes) for (const n of r.nodos) if (n[0] === comp) out.push({ pin: n[1], func: n[2], red: r.n });
    out.sort((a, b) => a.pin.localeCompare(b.pin, 'es', { numeric: true }));
    return out;
  });
  const fotoDe = $derived(comp ? datos.componentes[comp]?.f : undefined);
  const hotspotNombre = $derived(fotoDe ? datos.hotspots.find((h) => h.id === fotoDe)?.nombre : undefined);
  const bloqueDe = $derived(fotoDe ? datos.hotspots.find((h) => h.id === fotoDe)?.bloque : undefined);
  const grupoRedes = $derived(redSel?.g ? datos.redes.filter((r) => r.g === redSel.g) : []);
</script>

<div class="esquema">
  <div class="cabecera">
    <label class="hoja-sel">
      <span>Hoja</span>
      <select bind:value={hoja} aria-label="Hoja del esquema">
        {#each datos.hojas as h (h.id)}
          <option value={h.id}>{h.id + 1}. {h.nombre}</option>
        {/each}
      </select>
    </label>
    <div class="buscador">
      <Search size={17} />
      <input
        type="search"
        placeholder="Buscar red, referencia o chip (A13, U6, NMI, 74LS139…)"
        bind:value={busqueda}
        onfocus={() => (abiertaBusqueda = true)}
        onkeydown={(e) => {
          if (e.key === 'Enter' && resultados[0]) elegir(resultados[0]);
          if (e.key === 'Escape') abiertaBusqueda = false;
        }}
        aria-label="Buscar en el esquema"
      />
      {#if abiertaBusqueda && resultados.length}
        <ul class="resultados" role="listbox">
          {#each resultados as r (r.tipo + r.id)}
            <li>
              <button type="button" onclick={() => elegir(r)}>
                <strong>{r.texto}</strong>
                <span>{r.tipo === 'componente' ? `componente · ${r.detalle}` : r.detalle}</span>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
    <div class="zoom">
      <button type="button" class="boton-icono" aria-label="Alejar" title="Alejar (−)" onclick={() => lienzo?.zoom(1 / 1.5)}><ZoomOut size={19} /></button>
      <button type="button" class="boton-icono" aria-label="Acercar" title="Acercar (+)" onclick={() => lienzo?.zoom(1.5)}><ZoomIn size={19} /></button>
      <button type="button" class="boton-icono" aria-label="Ver la hoja entera" title="Ver la hoja entera (0)" onclick={() => lienzo?.ajustar()}><Maximize size={18} /></button>
    </div>
  </div>

  <div class="cuerpo">
    <div class="marco" data-hoja={hoja} data-red={red ?? ''} data-simbolo={comp ?? ''}>
      {#if dibujo && capa}
        <Lienzo
          bind:this={lienzo}
          {dibujo}
          {capa}
          oscuro={app.tema === 'oscuro'}
          acento="#2e6ea6"
          {red}
          {rojo}
          simbolo={comp}
          {enfocar}
          alTocar={tocar}
          alPasar={pasar}
        />
      {/if}
      {#if cargando}<div class="estado">Cargando la hoja {hojaActual.nombre}…</div>{/if}
      {#if error}<div class="estado error">{error}</div>{/if}
      {#if pasa}
        <div class="globo" style:left={`${Math.min(pasa.x + 14, 9999)}px`} style:top={`${pasa.y + 14}px`}>{textoImpacto(pasa.i)}</div>
      {/if}
      <div class="nombre-hoja">{hojaActual.nombre}{#if hojaActual.padre !== null} · <button type="button" class="enlace" onclick={() => (hoja = hojaActual.padre ?? 0)}>subir a la raíz</button>{/if}</div>
    </div>

    <aside class="ficha" aria-live="polite">
      {#if redSel}
        {@const nr = nombreRed(redSel.n)}
        <p class="tipo">Red</p>
        <h3 class="nombre">{@html htmlKicad(nr.nombre)}</h3>
        <p class="detalle">
          Nombre en KiCad: <code>{@html htmlKicad(redSel.n)}</code>{#if redSel.g}<br />Grupo: <strong>{datos.grupos[redSel.g] ?? redSel.g}</strong>{/if}
        </p>
        {#if redSel.h.length > 1 || (redSel.h.length === 1 && redSel.h[0] !== hoja)}
          <p class="sub">Está en {redSel.h.length === 1 ? 'la hoja' : `${redSel.h.length} hojas`}:</p>
          <div class="chips">
            {#each redSel.h as h (h)}
              <button type="button" class="chip" class:activo={h === hoja} onclick={() => {
                hoja = h;
                enfocar++;
              }}>{datos.hojas[h]?.nombre}</button>
            {/each}
          </div>
        {/if}
        <p class="sub">{redSel.nodos.length} pines conectados:</p>
        <ul class="nodos">
          {#each redSel.nodos as n (n[0] + '.' + n[1])}
            <li>
              <button type="button" onclick={() => seleccionar({ tipo: 'componente', id: n[0] })}>
                <strong>{n[0]}.{n[1]}</strong>
                {#if n[2] && n[2] !== n[1]}<span class="func">{@html htmlKicad(n[2])}</span>{/if}
                <span class="valor">{datos.componentes[n[0]]?.v ?? ''}</span>
              </button>
            </li>
          {/each}
        </ul>
        {#if grupoRedes.length > 1}
          <details class="grupo">
            <summary>Otras redes del grupo «{datos.grupos[redSel.g ?? ''] ?? redSel.g}» ({grupoRedes.length})</summary>
            <div class="chips">
              {#each grupoRedes.slice(0, 80) as r (r.n)}
                <button type="button" class="chip" class:activo={r.n === redSel.n} onclick={() => seleccionar({ tipo: 'red', id: r.n })}>{@html htmlKicad(nombreRed(r.n).nombre)}</button>
              {/each}
            </div>
          </details>
        {/if}
      {:else if comp}
        {@const c = datos.componentes[comp]!}
        <p class="tipo">Componente</p>
        <h3 class="nombre">{comp} <span class="valor">{c.v}</span></h3>
        <p class="detalle">Símbolo <code>{c.l}</code> · hoja{c.h.length > 1 ? 's' : ''} {c.h.map((h) => datos.hojas[h]?.nombre).join(', ')}</p>
        {#if fotoDe || bloqueDe}
          <div class="acciones">
            {#if fotoDe}<button type="button" class="accion" onclick={() => irA('foto', { tipo: 'foto', id: fotoDe })}>Ver en la foto{hotspotNombre ? `: ${hotspotNombre}` : ''}</button>{/if}
            {#if bloqueDe}<button type="button" class="accion" onclick={() => irA('arquitectura', { tipo: 'bloque', id: bloqueDe })}>Ver en la arquitectura</button>{/if}
          </div>
        {:else}
          <p class="detalle">No tiene punto en la foto.</p>
        {/if}
        {#if pinesComp.length}
          <p class="sub">{pinesComp.length} pines:</p>
          <ul class="nodos">
            {#each pinesComp as p (p.pin + p.red)}
              <li>
                <button type="button" onclick={() => seleccionar({ tipo: 'red', id: p.red })}>
                  <strong>{p.pin}</strong>
                  {#if p.func && p.func !== p.pin}<span class="func">{@html htmlKicad(p.func)}</span>{/if}
                  <span class="valor">{@html htmlKicad(nombreRed(p.red).nombre)}</span>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      {:else}
        <p class="tipo">Esquema</p>
        <h3 class="nombre">{datos.esquema_titulo}</h3>
        <p class="detalle">{datos.aviso}</p>
        <p class="detalle">Toca o pasa el ratón por un hilo, un pin o una etiqueta para resaltar toda su red, en esta hoja y en las demás. Toca un símbolo para ver sus pines.{#if datos.hojas.length > 1}{' '}En la hoja raíz, toca un bloque para abrir su hoja.{/if}</p>
      {/if}
      {#if sel}
        <button type="button" class="limpiar" onclick={() => seleccionar(null)}><X size={15} /> Quitar la selección</button>
      {/if}
    </aside>
  </div>
</div>

<style>
  .esquema {
    display: grid;
    gap: 10px;
  }
  .cabecera {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }
  .hoja-sel {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
    color: var(--tinta-suave);
  }
  select,
  input[type='search'] {
    height: 40px;
    border: 1px solid var(--linea);
    border-radius: 10px;
    background: var(--superficie);
    color: var(--tinta);
    font: inherit;
    font-size: 15px;
  }
  select {
    padding: 0 8px;
    max-width: 62vw;
  }
  .buscador {
    position: relative;
    flex: 1 1 260px;
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    color: var(--tinta-suave);
  }
  .buscador :global(svg) {
    position: absolute;
    left: 10px;
    pointer-events: none;
  }
  input[type='search'] {
    width: 100%;
    padding: 0 10px 0 34px;
  }
  .resultados {
    position: absolute;
    z-index: 20;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    max-height: 50vh;
    overflow: auto;
    margin: 0;
    padding: 4px;
    list-style: none;
    border: 1px solid var(--linea);
    border-radius: 10px;
    background: var(--superficie);
    box-shadow: var(--sombra-alta);
  }
  .resultados button {
    display: flex;
    width: 100%;
    gap: 8px;
    align-items: baseline;
    min-height: 40px;
    padding: 6px 10px;
    border: 0;
    border-radius: 7px;
    background: none;
    color: var(--tinta);
    font: inherit;
    text-align: left;
  }
  .resultados button:hover {
    background: var(--hover);
  }
  .resultados span {
    color: var(--tinta-suave);
    font-size: 13.5px;
  }
  .zoom {
    display: inline-flex;
    gap: 4px;
  }
  .cuerpo {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 320px;
    gap: 12px;
  }
  .marco {
    position: relative;
    height: min(72vh, 760px);
    min-height: 340px;
    border-radius: 12px;
    overflow: hidden;
    box-shadow:
      0 0 0 1px var(--linea),
      var(--sombra);
    background: var(--superficie-2);
  }
  .estado {
    position: absolute;
    inset: auto 12px 12px auto;
    padding: 6px 10px;
    border-radius: 8px;
    background: var(--superficie);
    color: var(--tinta-suave);
    font-size: 14px;
    box-shadow: var(--sombra);
  }
  .estado.error {
    color: var(--c-precaucion);
  }
  .globo {
    position: absolute;
    z-index: 5;
    max-width: 340px;
    padding: 5px 9px;
    border-radius: 8px;
    background: var(--superficie);
    color: var(--tinta);
    font-size: 13.5px;
    pointer-events: none;
    box-shadow: var(--sombra-alta);
  }
  .nombre-hoja {
    position: absolute;
    left: 10px;
    top: 8px;
    padding: 3px 9px;
    border-radius: 999px;
    background: var(--superficie);
    color: var(--tinta-suave);
    font-size: 13px;
    font-weight: 600;
    box-shadow: var(--sombra);
  }
  .enlace {
    border: 0;
    padding: 0;
    background: none;
    color: var(--acento);
    font: inherit;
    text-decoration: underline;
    cursor: pointer;
  }
  .ficha {
    align-self: start;
    max-height: min(72vh, 760px);
    overflow: auto;
    padding: 14px;
    border-radius: 12px;
    background: var(--superficie);
    box-shadow:
      0 0 0 1px var(--linea),
      var(--sombra);
    font-size: 14.5px;
  }
  .tipo {
    margin: 0;
    color: var(--tinta-tenue);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .nombre {
    margin: 2px 0 6px;
    color: var(--titulos);
    font-size: 20px;
    overflow-wrap: anywhere;
  }
  .nombre .valor {
    color: var(--tinta-suave);
    font-size: 15px;
    font-weight: 600;
  }
  .detalle {
    margin: 0 0 8px;
    color: var(--tinta-suave);
  }
  .sub {
    margin: 10px 0 4px;
    font-weight: 700;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chip {
    min-height: 32px;
    padding: 2px 10px;
    border: 1px solid var(--linea);
    border-radius: 999px;
    background: var(--superficie-2);
    color: var(--tinta);
    font: inherit;
    font-size: 13.5px;
    cursor: pointer;
  }
  .chip.activo {
    border-color: var(--acento);
    background: var(--acento-tinte);
    color: var(--acento);
    font-weight: 700;
  }
  .nodos {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .nodos button {
    display: flex;
    width: 100%;
    gap: 8px;
    align-items: baseline;
    min-height: 34px;
    padding: 4px 6px;
    border: 0;
    border-radius: 6px;
    background: none;
    color: var(--tinta);
    font: inherit;
    font-size: 14px;
    text-align: left;
    cursor: pointer;
  }
  .nodos button:hover {
    background: var(--hover);
  }
  .func {
    color: var(--acento);
    font-weight: 600;
  }
  .nodos .valor {
    margin-left: auto;
    color: var(--tinta-suave);
    font-size: 13px;
    text-align: right;
  }
  .acciones {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 6px 0;
  }
  .accion,
  .limpiar {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 36px;
    padding: 4px 12px;
    border: 1px solid var(--acento-borde);
    border-radius: 999px;
    background: var(--acento-tinte);
    color: var(--acento);
    font: inherit;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
  }
  .limpiar {
    margin-top: 12px;
    border-color: var(--linea);
    background: none;
    color: var(--tinta-suave);
  }
  .grupo {
    margin-top: 10px;
  }
  .grupo summary {
    cursor: pointer;
    font-weight: 600;
    min-height: 32px;
  }
  :global(.sobre) {
    text-decoration: overline;
  }
  code {
    font-size: 13px;
  }
  @media (max-width: 1023px) {
    .cuerpo {
      grid-template-columns: minmax(0, 1fr);
    }
    .marco {
      height: min(62vh, 640px);
    }
    .ficha {
      max-height: none;
    }
  }
  @media (pointer: coarse) {
    .chip,
    .nodos button,
    .accion,
    .limpiar,
    select,
    input[type='search'],
    .resultados button {
      min-height: 44px;
    }
    .zoom :global(.boton-icono) {
      width: 44px;
      height: 44px;
    }
  }
</style>
