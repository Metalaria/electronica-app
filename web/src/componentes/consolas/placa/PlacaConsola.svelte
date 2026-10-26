<script lang="ts">
  // «Placa en 3D» and «Placa en 2D» of a console: the mainboard drawn by the «Proyectos KiCad» viewer
  // (proyectos/Vista3D.svelte, proyectos/Placa2D.svelte, used unchanged), with the selection shared with the
  // console's other tabs: a reference (U1) or a net of the schematic selects the same part or net on the board,
  // and choosing on the board selects it in the schematic. Boards that are not the schematic's own (OpenGBC)
  // are shown but never linked.
  import { untrack } from 'svelte';
  import { app } from '../../../lib/estado.svelte';
  import { htmlKicad, nombreRed, type DatosMaquina } from '../datos';
  import type { Seleccion } from '../estado.svelte';
  import { construirGeometria, type Geometria, type Impacto2D, type Lado } from '../../proyectos/geometria';
  import { deHuella, dePad, deRed, padsDeRed, resolver } from '../../proyectos/seleccion';
  import type { Seleccion as SelPlaca } from '../../proyectos/estado';
  import type { Aspecto, CapasVisibles } from '../../proyectos/pintar';
  import { mm } from '../../proyectos/datos';
  import { opciones3d } from '../../proyectos/opciones3d.svelte';
  import Placa2D from '../../proyectos/Placa2D.svelte';
  import { soporteWebGL2 } from '../../tres/motor/soporte';
  import { cargarPlacaConsola, PLACAS_DE, redDePlaca, refEnlazada, type DatosPlacaConsola } from './datos';
  import { eleccion } from './eleccion.svelte';

  type Destino = 'foto' | 'esquema' | 'placa3d' | 'placa2d';

  let {
    datos,
    vista,
    sel,
    seleccionar,
    irA,
  }: {
    datos: DatosMaquina;
    vista: '3d' | '2d';
    sel: Seleccion | null;
    seleccionar: (s: Seleccion | null) => void;
    irA: (pestana: Destino, s: Seleccion) => void;
  } = $props();

  const placas = $derived(PLACAS_DE[datos.id] ?? []);
  const idPlaca = $derived(eleccion[datos.id] && placas.some((p) => p.id === eleccion[datos.id]) ? eleccion[datos.id]! : (placas[0]?.id ?? ''));
  let d = $state.raw<DatosPlacaConsola | null>(null);
  let geo = $state.raw<Geometria | null>(null);
  let error = $state('');
  let selPlaca = $state<SelPlaca | null>(null);
  let enfocar = $state(0);
  const oscuro = $derived(app.tema === 'oscuro');
  const webgl = soporteWebGL2();

  // options of the 2D view
  let lado: Lado = $state('F');
  let aspecto: Aspecto = $state('real');
  let visibles: CapasVisibles = $state({ F: true, B: true, mascara: true, serigrafia: true, fab: false, areas: true });
  let tensiones = $state(false);

  const res = $derived(d ? resolver(d, selPlaca) : { huella: null, red: null, pad: null });

  $effect(() => {
    const id = idPlaca;
    if (!id) return;
    let vivo = true;
    error = '';
    untrack(() => {
      if (d?.id !== id) {
        d = null;
        geo = null;
      }
    });
    cargarPlacaConsola(id)
      .then((x) => {
        if (!vivo) return;
        geo = construirGeometria(x);
        d = x;
      })
      .catch((e: unknown) => {
        if (vivo) error = e instanceof Error ? e.message : String(e);
      });
    return () => {
      vivo = false;
    };
  });

  /** Last selection sent to the console, so that its echo does not reset a finer board selection (a pad). */
  let emitida: Seleccion | null = null;

  function desdeConsola(s: Seleccion | null, x: DatosPlacaConsola): SelPlaca | null {
    // a board that is not the schematic's own takes no selection from the other tabs (same names, other parts),
    // except, on a partly linked one, its shared parts and their nets
    if (!s || (!x.consola.enlazada && !x.consola.parcial)) return null;
    if (s.tipo === 'componente') return refEnlazada(x, s.id) && x.huellas.some((h) => h.r === s.id) ? { tipo: 'huella', id: s.id } : null;
    if (s.tipo === 'red') {
      const n = redDePlaca(x, s.id);
      return n ? { tipo: 'red', id: n } : null;
    }
    return null;
  }

  function aConsola(s: SelPlaca | null, x: DatosPlacaConsola): Seleccion | null {
    if (!s) return null;
    if (s.tipo === 'huella') return { tipo: 'componente', id: s.id };
    if (s.tipo === 'pad') return { tipo: 'componente', id: s.id.slice(0, s.id.lastIndexOf('.')) };
    return { tipo: 'red', id: ((x.consola.enlazada || x.consola.parcial) && x.consola.redes[s.id]) || s.id };
  }

  // the console's selection (route, other tabs) → the board's
  $effect(() => {
    const s = sel;
    const x = d;
    if (!x) return;
    untrack(() => {
      if (emitida && s && emitida.tipo === s.tipo && emitida.id === s.id) return;
      selPlaca = desdeConsola(s, x);
      if (selPlaca) enfocar++;
    });
  });

  function elegir(s: SelPlaca | null): void {
    selPlaca = s;
    if (!d) return;
    emitida = aConsola(s, d);
    seleccionar(emitida);
  }

  function elegirEnfocando(s: SelPlaca | null): void {
    elegir(s);
    if (s) enfocar++;
  }

  function tocado2D(i: Impacto2D | null): void {
    if (!d) return;
    if (!i) return elegir(null);
    if (i.tipo === 'pad') return elegir(dePad(d, i.pad));
    if (i.tipo === 'huella') return elegir(deHuella(d, i.huella));
    if (i.red >= 0) return elegir(deRed(d, i.red));
    elegir(null);
  }

  function cambiarPlaca(id: string): void {
    eleccion[datos.id] = id;
    selPlaca = null;
  }

  const huella = $derived(d && res.huella != null ? d.huellas[res.huella]! : null);
  const red = $derived(d && res.red != null ? d.redes[res.red]! : null);
  const pad = $derived(d && res.pad != null ? d.pads[res.pad]! : null);
  const componente = $derived(huella && d && refEnlazada(d, huella.r) ? (datos.componentes[huella.r] ?? null) : null);
  const redEsquema = $derived(red && (d?.consola.enlazada || d?.consola.parcial) ? (d.consola.redes[red.n] ?? null) : null);
  const padsRed = $derived(d && res.red != null && !huella ? padsDeRed(d, res.red).slice(0, 120) : []);
  const padsHuella = $derived(d && huella ? d.pads.slice(huella.pads[0], huella.pads[0] + huella.pads[1]) : []);
  const enFoto = $derived(
    !!huella &&
      (datos.hotspots.some((h) => h.esquema.includes(huella.r)) ||
        !!datos.foto.posiciones?.[huella.r] ||
        (datos.fotos ?? []).some((f) => f.hotspots.some((h) => h.esquema.includes(huella.r)) || !!f.posiciones?.[huella.r])),
  );
  /** Parts placed by reconstruction (a Gerber board): counts for the board's note. */
  const reconstruidas = $derived.by(() => {
    if (!d) return null;
    const r = d.huellas.filter((h) => h.rec && h.t !== 'mec' && !h.dnp);
    if (!r.length) return null;
    return { cuerpo: r.length, huella: r.filter((h) => h.rec!.cuerpo === 'huella').length, aprox: r.filter((h) => h.rec!.cuerpo !== 'huella').length };
  });
  const otraVista: Destino = $derived(vista === '3d' ? 'placa2d' : 'placa3d');

  function nombre(n: string): string {
    return nombreRed(n).nombre;
  }
</script>

<div class="placa-consola" data-placa={idPlaca}>
  {#if placas.length > 1 || (placas[0] && !placas[0].enlazada)}
    <div class="placas" role="group" aria-label="Placa">
      {#each placas as p (p.id)}
        <button type="button" aria-pressed={p.id === idPlaca} onclick={() => cambiarPlaca(p.id)}>
          {p.corto}{#if !p.enlazada}<small>{p.parcial ? 'enlazada en parte' : 'no enlazada'}</small>{/if}
        </button>
      {/each}
    </div>
  {/if}

  {#if error}
    <div class="aviso"><p>No se pudo cargar la placa: {error}</p></div>
  {:else if !d || !geo || d.id !== idPlaca}
    <div class="cargando">Cargando la placa…</div>
  {:else}
    {@const x = d}
    {@const g = geo}
    <div class="cuerpo">
      <section class="vista" aria-label={vista === '3d' ? 'Placa en 3D' : 'Placa en 2D'}>
        {#if vista === '3d' && webgl}
          {#await import('../../proyectos/Vista3D.svelte')}
            <div class="cargando">Preparando la vista 3D…</div>
          {:then m}
            {#key x.id}<m.default datos={x} geo={g} {res} {oscuro} {enfocar} opciones={opciones3d} alElegir={(s) => elegir(s)} />{/key}
          {:catch e}
            <div class="aviso"><p>No se pudo abrir la vista 3D: {String(e)}</p></div>
          {/await}
        {:else}
          {#if vista === '3d'}<p class="nota-webgl">Este equipo no ofrece WebGL 2, así que la placa se muestra en 2D.</p>{/if}
          {#key x.id}<Placa2D datos={x} geo={g} {res} {oscuro} bind:lado bind:aspecto bind:visibles bind:tensiones {enfocar} alTocar={tocado2D} />{/key}
        {/if}
      </section>

      <aside class="lado" aria-label="Detalle">
        {#if huella}
          <p class="tipo">{huella.t === 'mec' && x.consola.tipo !== 'gerber' ? 'Pieza mecánica' : 'Componente'}</p>
          <h3 class="nombre">{huella.r} <span class="valor">{huella.v || componente?.v || ''}</span></h3>
          {#if huella.f}<p class="detalle">{huella.f}</p>{/if}
          <p class="detalle">
            {#if x.consola.tipo === 'gerber' && !huella.rec}
              {padsHuella.length} pad{padsHuella.length === 1 ? '' : 's'} en la cara {huella.lado === 'F' ? 'superior' : 'inferior'} (el Gerber no da la huella ni el cuerpo).
            {:else}
              Huella <code>{huella.l}</code> · cara {huella.lado === 'F' ? 'superior' : 'inferior'} · {padsHuella.length} pad{padsHuella.length === 1 ? '' : 's'}
            {/if}
          </p>
          {#if huella.rec}<p class="reconstruida" data-cuerpo={huella.rec.cuerpo}><strong>Posición reconstruida.</strong> {huella.rec.nota}</p>{/if}
          {#if huella.dnp}<p class="detalle">Sin montar en esta placa (DNP en el esquema).</p>{/if}
          {#if pad}
            {@const rp = pad[12] >= 0 ? x.redes[pad[12]]! : null}
            <p class="pad">Pad <strong>{pad[1]}</strong>{#if pad[13]} ({@html htmlKicad(pad[13])}){/if}{#if rp} · red <button type="button" class="enlace" onclick={() => elegirEnfocando({ tipo: 'red', id: rp.n })}>{@html htmlKicad(nombre(x.consola.redes[rp.n] ?? rp.n))}</button>{/if}</p>
          {/if}
          <div class="acciones">
            {#if componente}
              <button type="button" class="accion" onclick={() => irA('esquema', { tipo: 'componente', id: huella.r })}>Ver en el esquema</button>
              {#if enFoto}<button type="button" class="accion" onclick={() => irA('foto', { tipo: 'componente', id: huella.r })}>Ver en la foto</button>{/if}
            {/if}
            <button type="button" class="accion" onclick={() => irA(otraVista, { tipo: 'componente', id: huella.r })}>{vista === '3d' ? 'Ver en 2D' : 'Ver en 3D'}</button>
          </div>
          {#if x.consola.enlazada && !componente}<p class="detalle">No está en el esquema.</p>{/if}
          {#if x.consola.parcial && !componente}
            <p class="detalle">
              No se enlaza con el esquema{datos.componentes[huella.r] ? `: en la ${datos.placa}, ${huella.r} es otro componente (${datos.componentes[huella.r]!.v})` : ''}.
            </p>
          {/if}
          {#if padsHuella.length}
            <p class="sub">Pads:</p>
            <ul class="nodos">
              {#each padsHuella as p (p[1] + '·' + p[3] + '·' + p[4])}
                {@const rr = p[12] >= 0 ? x.redes[p[12]]! : null}
                <li>
                  <button type="button" disabled={!rr} onclick={() => rr && elegirEnfocando({ tipo: 'red', id: rr.n })}>
                    <strong>{p[1] || '·'}</strong>
                    {#if p[13]}<span class="func">{@html htmlKicad(p[13])}</span>{/if}
                    <span class="valor">{rr ? nombre(x.consola.redes[rr.n] ?? rr.n) : 'sin red'}</span>
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        {:else if red}
          <p class="tipo">Red</p>
          <h3 class="nombre">{@html htmlKicad(nombre(redEsquema ?? red.n))}</h3>
          <p class="detalle">Nombre en la placa: <code>{@html htmlKicad(red.n)}</code> · {red.p} pads</p>
          <div class="acciones">
            {#if redEsquema}<button type="button" class="accion" onclick={() => irA('esquema', { tipo: 'red', id: redEsquema })}>Ver en el esquema</button>{/if}
            <button type="button" class="accion" onclick={() => irA(otraVista, { tipo: 'red', id: redEsquema ?? red.n })}>{vista === '3d' ? 'Ver en 2D' : 'Ver en 3D'}</button>
          </div>
          {#if padsRed.length}
            <ul class="nodos">
              {#each padsRed as i (i)}
                {@const p = x.pads[i]!}
                {@const h = x.huellas[p[0]]!}
                <li>
                  <button type="button" onclick={() => elegirEnfocando({ tipo: 'pad', id: `${h.r}.${p[1]}` })}>
                    <strong>{h.r}.{p[1]}</strong>
                    {#if p[13]}<span class="func">{@html htmlKicad(p[13])}</span>{/if}
                    <span class="valor">{h.v}</span>
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        {:else}
          <p class="tipo">{x.consola.enlazada ? 'Enlazada con el esquema' : x.consola.parcial ? 'Enlazada en parte con el esquema' : 'No enlazada con el esquema'}</p>
          <h3 class="nombre">{x.titulo}</h3>
          <p class="detalle">
            {mm(x.placa.ancho, 1)} × {mm(x.placa.alto, 1)} mm · {x.consola.capas_cobre.length} capas de cobre ·
            {x.huellas.filter((h) => h.l !== 'NPTH').length} componentes · {x.redes.filter((r) => r.p >= 2).length} redes
          </p>
          <p class="aviso-placa">{x.consola.aviso}</p>
          {#if x.consola.parcial}<p class="reconstruida parcial">{x.consola.parcial.texto}</p>{/if}
          {#if reconstruidas}
            <p class="reconstruida nota-placa">
              <strong>Posiciones reconstruidas a partir de la serigrafía y los pads</strong>, no leídas de un fichero de colocación:
              {reconstruidas.cuerpo} componentes con cuerpo ({reconstruidas.huella} con la huella de KiCad del esquema,
              {reconstruidas.aprox} con medidas de la serigrafía o de las fotos). Cada componente dice de dónde sale.
            </p>
          {/if}
          <p class="ayuda">
            Toque un componente, un pad o una pista para ver sus conexiones{x.consola.enlazada
              ? '; lo elegido aquí queda elegido en el esquema y al revés'
              : x.consola.parcial
                ? `; ${x.consola.parcial.refs.join(', ')} y sus redes quedan elegidos en el esquema y al revés`
                : ''}.
          </p>
          {#if x.comprobaciones.length}
            <p class="sub">Comprobaciones con el esquema:</p>
            <ul class="comprobaciones">
              {#each x.comprobaciones as c, i (i)}<li class={c.tipo}>{c.texto}</li>{/each}
            </ul>
          {/if}
          <p class="credito">
            {x.consola.fuente.autor} · <a href={x.consola.fuente.url} target="_blank" rel="noopener noreferrer">{x.consola.fuente.url.replace(/^https?:\/\//, '')}</a><br />
            Licencia: {x.consola.fuente.licencia}
          </p>
        {/if}
      </aside>
    </div>
  {/if}
</div>

<style>
  .placa-consola {
    display: grid;
    gap: 10px;
    min-width: 0;
  }
  .placas {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .placas button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 40px;
    padding: 0 14px;
    border: 1px solid var(--linea);
    border-radius: 999px;
    background: var(--superficie);
    color: var(--tinta-suave);
    font-weight: 600;
  }
  .placas button[aria-pressed='true'] {
    border-color: var(--acento);
    color: var(--acento);
    background: var(--acento-tinte);
  }
  .placas small {
    padding: 1px 6px;
    border-radius: 6px;
    background: var(--superficie-2);
    color: var(--tinta-tenue);
    font-size: 11.5px;
    font-weight: 700;
  }
  .cuerpo {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 330px;
    gap: 14px;
    align-items: start;
  }
  .vista {
    min-width: 0;
    height: clamp(420px, calc(100dvh - 290px), 1000px);
  }
  .nota-webgl {
    margin: 0 0 6px;
    color: var(--tinta-suave);
    font-size: 14px;
  }
  .lado {
    position: sticky;
    top: 70px;
    max-height: calc(100dvh - 90px);
    overflow: auto;
    padding: 12px 14px;
    border: 1px solid var(--linea);
    border-radius: 14px;
    background: var(--superficie);
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
    font-size: 19px;
    overflow-wrap: anywhere;
  }
  .nombre .valor {
    color: var(--tinta-suave);
    font-size: 15px;
    font-weight: 600;
  }
  .detalle,
  .ayuda,
  .pad {
    margin: 6px 0;
    color: var(--tinta-suave);
    line-height: 1.45;
  }
  .aviso-placa {
    margin: 8px 0;
    padding: 8px 10px;
    border-left: 3px solid var(--c-importante);
    border-radius: 6px;
    background: color-mix(in srgb, var(--c-importante) 8%, transparent);
    line-height: 1.45;
  }
  .reconstruida {
    margin: 8px 0;
    padding: 8px 10px;
    border-left: 3px solid var(--acento);
    border-radius: 6px;
    background: var(--acento-tinte);
    color: var(--tinta-suave);
    line-height: 1.45;
  }
  .sub {
    margin: 10px 0 4px;
    color: var(--tinta-suave);
    font-weight: 700;
  }
  code {
    font-family: var(--mono);
    font-size: 0.9em;
    overflow-wrap: anywhere;
  }
  .acciones {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 8px 0;
  }
  .accion {
    min-height: 36px;
    padding: 0 12px;
    border: 1px solid var(--acento-borde);
    border-radius: 999px;
    background: var(--superficie);
    color: var(--acento);
    font-weight: 600;
  }
  .enlace {
    padding: 0;
    border: 0;
    background: none;
    color: var(--acento);
    font-weight: 600;
  }
  .nodos {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 2px;
  }
  .nodos button {
    display: flex;
    gap: 8px;
    align-items: baseline;
    width: 100%;
    min-height: 32px;
    padding: 4px 6px;
    border: 0;
    border-radius: 8px;
    background: none;
    text-align: left;
  }
  .nodos button:hover:not(:disabled) {
    background: var(--hover);
  }
  .nodos button:disabled {
    cursor: default;
    opacity: 0.7;
  }
  .nodos .func {
    color: var(--tinta-suave);
    font-size: 13px;
  }
  .nodos .valor {
    margin-left: auto;
    color: var(--tinta-tenue);
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 55%;
  }
  .comprobaciones {
    margin: 0;
    padding-left: 18px;
    line-height: 1.4;
  }
  .comprobaciones li + li {
    margin-top: 4px;
  }
  .comprobaciones .ok::marker {
    color: var(--c-ejemplo);
  }
  .comprobaciones .aviso::marker {
    color: var(--c-importante);
  }
  .credito {
    margin: 12px 0 0;
    padding-top: 10px;
    border-top: 1px solid var(--linea-suave);
    color: var(--tinta-tenue);
    font-size: 13px;
    line-height: 1.45;
    overflow-wrap: anywhere;
  }
  .cargando,
  .aviso {
    padding: 30px;
    color: var(--tinta-suave);
  }
  @media (max-width: 999px) {
    .cuerpo {
      grid-template-columns: minmax(0, 1fr);
    }
    .vista {
      height: clamp(340px, 58dvh, 820px);
    }
    .lado {
      position: static;
      max-height: none;
    }
  }
</style>
