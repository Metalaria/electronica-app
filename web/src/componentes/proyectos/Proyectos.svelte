<script lang="ts">
  // «Proyectos KiCad»: the boards of the four KiCad projects of the book (printed chapters 48-51) in linked
  // views — 3D, flat 2D, schematic, simulation and checks — sharing one selection (a part, a pad or a net).
  // Route: #/proyectos[/<placa>/<vista>[/<seleccion>]] (estado.ts).
  import { untrack } from 'svelte';
  import { app } from '../../lib/estado.svelte';
  import { ruta, prepararSalto } from '../../lib/ruta.svelte';
  import type { CapaHoja } from '../consolas/datos';
  import { decodificar as decodificarHoja, type Dibujo } from '../consolas/esquema/dibujo';
  import { cargarCapaEsquema, cargarDibujoEsquema, cargarIndice, cargarPlaca, mm, type DatosPlaca, type IndiceProyectos } from './datos';
  import { enlace, leerAncla, VISTAS, type Seleccion, type Vista } from './estado';
  import { construirGeometria, type Geometria, type Impacto2D, type Lado } from './geometria';
  import type { Aspecto, CapasVisibles } from './pintar';
  import { deHuella, dePad, deRed, resolver } from './seleccion';
  import Ficha from './Ficha.svelte';
  import Placa2D from './Placa2D.svelte';
  import EsquemaPlaca from './EsquemaPlaca.svelte';
  import Simulacion from './Simulacion.svelte';
  import Comprobaciones from './Comprobaciones.svelte';
  import { opciones3d } from './opciones3d.svelte';
  import { soporteWebGL2 } from '../tres/motor/soporte';

  const actual = $derived(leerAncla(ruta.ancla));
  let indice = $state.raw<IndiceProyectos | null>(null);
  let datos = $state.raw<DatosPlaca | null>(null);
  let geo = $state.raw<Geometria | null>(null);
  let esquema = $state.raw<{ dibujo: Dibujo; capa: CapaHoja } | null>(null);
  let error = $state('');
  let sel = $state<Seleccion | null>(null);
  let enfocar = $state(0);
  const oscuro = $derived(app.tema === 'oscuro');

  // options of the 2D view, kept while switching views
  let lado: Lado = $state('F');
  let aspecto: Aspecto = $state('real');
  let visibles: CapasVisibles = $state({ F: true, B: true, mascara: true, serigrafia: true, fab: false, areas: true });
  let tensiones = $state(false);

  const res = $derived(datos ? resolver(datos, sel) : { huella: null, red: null, pad: null });
  const proyecto = $derived(indice && datos ? indice.proyectos.find((p) => p.id === datos!.proyecto) ?? null : null);
  // WebGL2 or the 2D fallback (tests force it off with window.__epaSinWebGL)
  const webgl = soporteWebGL2();

  $effect(() => {
    cargarIndice()
      .then((i) => (indice = i))
      .catch((e: unknown) => (error = e instanceof Error ? e.message : String(e)));
  });

  // the route sets the selection (and frames it); selections inside a view only replace the URL
  $effect(() => {
    void ruta.n;
    const s = actual.sel;
    untrack(() => {
      sel = s;
      if (s) enfocar++;
    });
  });

  $effect(() => {
    const id = actual.placa;
    if (!id) return;
    let vivo = true;
    error = '';
    untrack(() => {
      if (datos?.id !== id) {
        datos = null;
        geo = null;
        esquema = null;
      }
    });
    cargarPlaca(id)
      .then((d) => {
        if (!vivo) return;
        geo = construirGeometria(d);
        datos = d;
      })
      .catch((e: unknown) => {
        if (vivo) error = e instanceof Error ? e.message : String(e);
      });
    return () => {
      vivo = false;
    };
  });

  // the schematic (also used for the symbol thumbnails), fetched once the board is up
  $effect(() => {
    const d = datos;
    if (!d) return;
    let vivo = true;
    Promise.all([cargarDibujoEsquema(d), cargarCapaEsquema(d)])
      .then(([b, c]) => {
        if (vivo && datos?.id === d.id) esquema = { dibujo: decodificarHoja(b), capa: c };
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  });

  function elegir(s: Seleccion | null, enfoca = true): void {
    sel = s;
    if (enfoca && s) enfocar++;
    if (datos) history.replaceState(history.state, '', enlace(datos.id, actual.vista, s));
  }

  function irA(v: Vista, s: Seleccion | null): void {
    if (datos) location.hash = enlace(datos.id, v, s);
  }

  function tocado2D(i: Impacto2D | null): void {
    if (!datos) return;
    if (!i) return elegir(null, false);
    if (i.tipo === 'pad') return elegir(dePad(datos, i.pad), false);
    if (i.tipo === 'huella') return elegir(deHuella(datos, i.huella), false);
    if (i.red >= 0) return elegir(deRed(datos, i.red), false);
    elegir(null, false);
  }

  const grupos = $derived(indice?.proyectos ?? []);
  const CORTOS: Record<string, string> = {
    estacion_iot: 'Estación IoT',
    fuente_laboratorio: 'Fuente de laboratorio',
    'hifi-potencia': 'Hi-Fi · potencia',
    'hifi-preamplificador': 'Hi-Fi · preamplificador',
    'hifi-fuente': 'Hi-Fi · fuente',
    'hifi-proteccion': 'Hi-Fi · protección',
    sdr: 'Receptor SDR',
  };
</script>

<svelte:head><title>Proyectos KiCad · Electrónica Práctica Avanzada</title></svelte:head>

<div class="proyectos" class:con-placa={!!actual.placa}>
  <header>
    <div class="titulo">
      <h1>Proyectos KiCad</h1>
      <p class:oculto={!!actual.placa}>Las placas de los cuatro proyectos detallados del libro, en 3D y en 2D, con su esquema, sus redes y sus comprobaciones.</p>
    </div>
    {#if indice}
      <nav class="placas" aria-label="Placa">
        {#each grupos as p (p.id)}
          {#each p.placas as pl (pl.id)}
            <a href={enlace(pl.id, actual.placa ? actual.vista : webgl ? '3d' : 'placa')} aria-current={actual.placa === pl.id ? 'page' : undefined} style:--c={`#${p.color}`} title={`${p.titulo} · ${pl.titulo} (capítulo ${p.capitulo})`}>
              <small>{p.capitulo}</small>{CORTOS[pl.id] ?? pl.titulo}
            </a>
          {/each}
        {/each}
      </nav>
    {/if}
  </header>

  {#if error}
    <div class="aviso"><p>No se pudieron cargar los datos: {error}</p></div>
  {:else if !actual.placa}
    {#if indice}
      <div class="portada">
        {#each indice.proyectos as p (p.id)}
          <article style:--c={`#${p.color}`}>
            <p class="cap">Capítulo {p.capitulo} · {p.capitulo_titulo.replace(/^Proyecto Detallado [IV]+: /, '')}</p>
            <h2>{p.titulo}</h2>
            <p>{p.resumen}</p>
            <ul>
              {#each p.placas as pl (pl.id)}
                <li>
                  <a href={enlace(pl.id, webgl ? '3d' : 'placa')}>
                    <strong>{p.placas.length > 1 ? pl.titulo : 'Abrir la placa'}</strong>
                    <span>{String(pl.ancho).replace('.', ',')} × {String(pl.alto).replace('.', ',')} mm · {pl.componentes} componentes · {pl.redes} redes{pl.tensiones ? ` · ${pl.tensiones} tensiones` : ''}</span>
                  </a>
                </li>
              {/each}
            </ul>
            {#if app.refs[p.figura]}
              <a class="libro" href={`#/${p.parte}/${p.figura}`} onclick={() => prepararSalto({ texto: 'Volver a los proyectos' })}>Figura {app.refs[p.figura]!.num} en el libro</a>
            {/if}
          </article>
        {/each}
      </div>
    {:else}
      <div class="cargando">Cargando…</div>
    {/if}
  {:else}
    <nav class="pestanas" aria-label="Vista">
      {#each VISTAS as v (v.id)}
        <a href={datos ? enlace(datos.id, v.id, sel) : enlace(actual.placa, v.id, sel)} aria-current={actual.vista === v.id ? 'page' : undefined}>{v.titulo}</a>
      {/each}
    </nav>
    {#if !datos || !geo || datos.id !== actual.placa}
      <div class="cargando">Cargando la placa…</div>
    {:else}
      {@const d = datos}
      {@const g = geo}
      <div class="cuerpo" class:ancha={actual.vista === 'simulacion' || actual.vista === 'comprobaciones'}>
        <section class="vista" aria-label={VISTAS.find((v) => v.id === actual.vista)?.titulo}>
          {#if actual.vista === '3d'}
            {#if webgl}
              {#await import('./Vista3D.svelte')}
                <div class="cargando">Preparando la vista 3D…</div>
              {:then m}
                {#key d.id}<m.default datos={d} geo={g} {res} {oscuro} {enfocar} opciones={opciones3d} alElegir={(s) => elegir(s, false)} />{/key}
              {:catch e}
                <div class="aviso"><p>No se pudo abrir la vista 3D: {String(e)}</p></div>
              {/await}
            {:else}
              <div class="aviso">
                <p>Este equipo no ofrece WebGL 2, así que la placa se muestra en 2D.</p>
              </div>
              <Placa2D datos={d} geo={g} {res} {oscuro} bind:lado bind:aspecto bind:visibles bind:tensiones {enfocar} alTocar={tocado2D} />
            {/if}
          {:else if actual.vista === 'placa'}
            <Placa2D datos={d} geo={g} {res} {oscuro} bind:lado bind:aspecto bind:visibles bind:tensiones {enfocar} alTocar={tocado2D} />
          {:else if actual.vista === 'esquema'}
            {#if esquema}
              <EsquemaPlaca datos={d} dibujo={esquema.dibujo} capa={esquema.capa} {res} {oscuro} {enfocar} alElegir={(s) => elegir(s, false)} />
            {:else}
              <div class="cargando">Cargando el esquema…</div>
            {/if}
          {:else if actual.vista === 'simulacion' && proyecto}
            <Simulacion datos={d} {proyecto} elegir={(s, v) => { if (v === 'placa') tensiones = true; else opciones3d.tensiones = true; irA(v, s); }} />
          {:else if actual.vista === 'comprobaciones' && proyecto && indice}
            <Comprobaciones datos={d} {proyecto} {indice} />
          {/if}
        </section>
        {#if actual.vista !== 'simulacion' && actual.vista !== 'comprobaciones'}
          <aside class="lado">
            <Ficha datos={d} {res} vista={actual.vista} {esquema} {oscuro} {elegir} {irA} />
          </aside>
        {/if}
      </div>
      <p class="pie">
        {d.proyecto_titulo} · {d.titulo} · {mm(d.placa.ancho, 1)} × {mm(d.placa.alto, 1)} mm · <code>{d.archivo}</code>
      </p>
    {/if}
  {/if}
</div>

<style>
  .proyectos > :global(*) {
    min-width: 0;
  }
  .proyectos {
    max-width: 1600px;
    margin: 0 auto;
    padding: 16px 20px 40px;
    display: grid;
    gap: 10px;
  }
  header {
    display: grid;
    gap: 8px;
  }
  .con-placa h1 {
    font-size: 22px;
  }
  h1 {
    margin: 0;
    color: var(--titulos);
    font-size: 28px;
  }
  .titulo p {
    margin: 2px 0 0;
    color: var(--tinta-suave);
  }
  .placas {
    display: flex;
    gap: 4px;
    padding: 4px;
    border-radius: 14px;
    background: var(--superficie-2);
    overflow-x: auto;
    scrollbar-width: thin;
  }
  .placas a {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 40px;
    padding: 0 12px;
    border-radius: 10px;
    color: var(--tinta);
    font-weight: 600;
    font-size: 14px;
    text-decoration: none;
    white-space: nowrap;
  }
  .placas a small {
    display: inline-grid;
    place-items: center;
    min-width: 24px;
    height: 20px;
    padding: 0 4px;
    border-radius: 6px;
    background: var(--c);
    color: #fff;
    font-size: 11px;
    font-weight: 800;
  }
  .placas a[aria-current='page'] {
    background: var(--superficie);
    box-shadow: var(--sombra);
    color: var(--acento);
  }
  .oculto {
    display: none;
  }
  .pestanas {
    display: flex;
    gap: 2px;
    border-bottom: 1px solid var(--linea);
    overflow-x: auto;
  }
  .pestanas a {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0 16px;
    border-bottom: 3px solid transparent;
    color: var(--tinta-suave);
    font-weight: 700;
    text-decoration: none;
    white-space: nowrap;
  }
  .pestanas a[aria-current='page'] {
    border-bottom-color: var(--acento);
    color: var(--acento);
  }
  .cuerpo {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 340px;
    gap: 14px;
    align-items: start;
  }
  .cuerpo.ancha {
    grid-template-columns: minmax(0, 1fr);
  }
  .vista {
    min-width: 0;
    height: clamp(420px, calc(100dvh - 230px), 1100px);
  }
  .cuerpo.ancha .vista {
    height: auto;
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
  }
  .portada {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 14px;
  }
  .portada article {
    display: grid;
    align-content: start;
    gap: 8px;
    padding: 16px;
    border: 1px solid var(--linea);
    border-top: 5px solid var(--c);
    border-radius: 14px;
    background: var(--superficie);
  }
  .portada .cap {
    margin: 0;
    color: var(--tinta-suave);
    font-size: 13px;
    font-weight: 700;
  }
  .portada h2 {
    margin: 0;
    color: var(--titulos);
    font-size: 20px;
  }
  .portada p {
    margin: 0;
    line-height: 1.45;
  }
  .portada ul {
    display: grid;
    gap: 6px;
    margin: 4px 0 0;
    padding: 0;
    list-style: none;
  }
  .portada li a {
    display: grid;
    gap: 2px;
    min-height: 44px;
    padding: 8px 12px;
    border-radius: 10px;
    background: var(--superficie-2);
    color: var(--tinta);
    text-decoration: none;
  }
  .portada li a:hover {
    outline: 2px solid var(--acento-borde);
  }
  .portada li span {
    color: var(--tinta-suave);
    font-size: 13px;
  }
  .libro {
    color: var(--acento);
    font-weight: 700;
    font-size: 14px;
  }
  .pie {
    margin: 0;
    color: var(--tinta-tenue);
    font-size: 12px;
  }
  .cargando,
  .aviso {
    padding: 24px;
    color: var(--tinta-suave);
  }
  @media (max-width: 999px) {
    .cuerpo {
      grid-template-columns: minmax(0, 1fr);
    }
    .vista {
      height: clamp(360px, 62dvh, 900px);
    }
    .lado {
      position: static;
      max-height: none;
    }
  }
  @media (max-width: 599px) {
    .proyectos {
      padding: 12px 12px 30px;
    }
    h1 {
      font-size: 24px;
    }
  }
  @media (pointer: coarse) {
    .placas a {
      min-height: 44px;
    }
  }
</style>
