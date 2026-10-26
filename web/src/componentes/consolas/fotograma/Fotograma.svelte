<script lang="ts">
  // «Un fotograma» tab: how the signals travel from reading the game's code to a finished frame, replayed from a
  // cycle-level trace recorded offline (contenido/fotograma/), with the journey drawn on the schematic, the board or
  // the photo. Programs: «Paso a paso» (the app's own demo) and «Un juego de verdad» (a free homebrew game, when
  // one has been chosen). The adapter of each console is in maquinas/<maquina>.ts (see ESQUEMA.md).
  import { onMount, untrack } from 'svelte';
  import Play from '@lucide/svelte/icons/play';
  import Pause from '@lucide/svelte/icons/pause';
  import SkipBack from '@lucide/svelte/icons/skip-back';
  import SkipForward from '@lucide/svelte/icons/skip-forward';
  import ChevronLeft from '@lucide/svelte/icons/chevron-left';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import ChevronsDown from '@lucide/svelte/icons/chevrons-down';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import { app } from '../../../lib/estado.svelte';
  import type { DatosMaquina } from '../datos';
  import { PLACAS_DE } from '../placa/datos';
  import { fotosDe } from '../datos';
  import { GRUPOS, colorGrupo } from './colores';
  import { cargarAdaptador } from './maquinas';
  import { NIVELES, Reproductor, type FotoEstado, type Nivel } from './reproductor';
  import { cargarIndiceFotograma, cargarTraza, type Traza } from './traza';
  import type { Adaptador, IndicePrograma } from './tipos';
  import Pantalla from './Pantalla.svelte';
  import Linea from './Linea.svelte';
  import Desensamblado from './Desensamblado.svelte';
  import Lecturas from './Lecturas.svelte';
  import EsquemaRecorrido from './EsquemaRecorrido.svelte';

  let { datos }: { datos: DatosMaquina } = $props();

  const oscuro = $derived(app.tema === 'oscuro');
  let programas: IndicePrograma[] = $state([]);
  let tipo: 'demo' | 'juego' = $state('demo');
  let ad: Adaptador | null = $state.raw(null);
  let traza: Traza | null = $state.raw(null);
  let rep: Reproductor | null = $state.raw(null);
  let foto: FotoEstado | null = $state.raw(null);
  let segId = $state('fotograma');
  let nivel: Nivel = $state('linea');
  let jugando = $state(false);
  let error = $state('');
  let vistaRecorrido: 'esquema' | 'placa' | 'foto' = $state('esquema');
  let hoja = $state(0);

  // a machine may have one trace per video standard (Mega Drive): PAL by default, as in «Arquitectura»
  let norma: 'pal' | 'ntsc' = $state('pal');
  const normas = $derived([...new Set(programas.filter((p) => p.tipo === tipo && p.norma).map((p) => p.norma!))]);
  const programa = $derived(programas.find((p) => p.tipo === tipo && (!p.norma || p.norma === norma)) ?? programas.find((p) => p.tipo === tipo) ?? null);
  const hayJuego = $derived(programas.some((p) => p.tipo === 'juego'));
  const conPlaca = $derived(!!PLACAS_DE[datos.id]?.some((p) => p.enlazada));
  const conFoto = $derived(fotosDe(datos).some((f) => f.trazas));

  $effect(() => {
    const id = datos.id;
    let vivo = true;
    error = '';
    Promise.all([cargarIndiceFotograma(id), cargarAdaptador(id)])
      .then(([ind, a]) => {
        if (!vivo) return;
        programas = ind.programas;
        ad = a;
        hoja = a.hojaInicial ?? 0;
        vistaRecorrido = conPlaca ? 'placa' : conFoto ? 'foto' : 'esquema';
      })
      .catch((e: unknown) => {
        if (vivo) error = e instanceof Error ? e.message : String(e);
      });
    return () => {
      vivo = false;
    };
  });

  $effect(() => {
    const p = programa;
    const a = ad;
    if (!p || !a) {
      traza = null;
      rep = null;
      return;
    }
    let vivo = true;
    cargarTraza(datos.id, p.archivo)
      .then((t) => {
        if (!vivo) return;
        traza = t;
        const seg = t.m.segmentos.find((s) => s.id === untrack(() => segId)) ?? t.m.segmentos.at(-1)!;
        segId = seg.id;
        const r = new Reproductor(t, a, seg);
        r.nivel = untrack(() => nivel);
        rep = r;
        foto = r.foto();
        // hooks for the end-to-end tests (tests/fotograma.spec.ts)
        (globalThis as unknown as { __epaFotograma?: unknown }).__epaFotograma = {
          rep: r,
          traza: t,
          ir: (x: number) => {
            r.jugando = false;
            r.irA(x);
            despertar();
          },
        };
      })
      .catch((e: unknown) => {
        if (vivo) error = e instanceof Error ? e.message : String(e);
      });
    return () => {
      vivo = false;
    };
  });

  // ---------------------------------------------------------------- animation loop
  let raf = 0;
  let ultimo = 0;
  let quietoDesde = 0;
  let ultimaFoto = 0;

  function bucle(ts: number): void {
    const r = rep;
    if (!r) {
      raf = 0;
      return;
    }
    const dt = ultimo ? Math.min(0.1, (ts - ultimo) / 1000) : 0;
    ultimo = ts;
    const c0 = performance.now();
    r.tick(dt);
    // cost of one animation frame (state + every canvas), for tests/fotograma-rendimiento
    const st = ((globalThis as unknown as { __epaFotogramaMs?: number[] }).__epaFotogramaMs ??= []);
    st.push(performance.now() - c0);
    if (st.length > 600) st.splice(0, 300);
    if (!r.jugando || ts - ultimaFoto > 110) {
      ultimaFoto = ts;
      foto = r.foto();
    }
    if (jugando !== r.jugando) jugando = r.jugando;
    if (r.jugando || ts - quietoDesde < 2600) raf = requestAnimationFrame(bucle);
    else {
      raf = 0;
      ultimo = 0;
    }
  }

  function despertar(): void {
    quietoDesde = performance.now();
    if (rep) foto = rep.foto();
    if (!raf) {
      ultimo = 0;
      raf = requestAnimationFrame(bucle);
    }
  }

  function alternar(): void {
    const r = rep;
    if (!r) return;
    if (!r.jugando && r.t >= r.seg.t1) r.irA(r.seg.t0);
    r.jugando = !r.jugando;
    jugando = r.jugando;
    despertar();
  }

  function paso(f: (r: Reproductor) => void): void {
    const r = rep;
    if (!r) return;
    r.jugando = false;
    jugando = false;
    f(r);
    despertar();
  }

  function elegirNivel(n: Nivel): void {
    nivel = n;
    if (rep) rep.nivel = n;
    despertar();
  }

  function elegirSegmento(id: string): void {
    const s = traza?.m.segmentos.find((x) => x.id === id);
    if (!s || !rep) return;
    segId = id;
    rep.cambiarSegmento(s);
    jugando = false;
    despertar();
  }

  function teclas(ev: KeyboardEvent): void {
    if ((ev.target as HTMLElement)?.closest('input, select, textarea')) return;
    if (ev.key === ' ') alternar();
    else if (ev.key === 'ArrowRight') paso((r) => (ev.shiftKey ? r.pasoInstruccion(1) : r.pasoCiclo(1)));
    else if (ev.key === 'ArrowLeft') paso((r) => (ev.shiftKey ? r.pasoInstruccion(-1) : r.pasoCiclo(-1)));
    else return;
    ev.preventDefault();
  }

  const ralentizado = $derived.by(() => {
    if (!rep || !foto) return '';
    void nivel;
    const f = rep.ralentizacion();
    const e = Math.floor(Math.log10(f));
    const m = f / 10 ** e;
    return `1 : ${m.toFixed(1).replace('.', ',')} · 10${String(e).replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]!)}`;
  });

  onMount(() => {
    return () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      (globalThis as unknown as { __epaFotograma?: unknown }).__epaFotograma = undefined;
    };
  });
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div class="fotograma" tabindex="0" role="region" aria-label="Un fotograma" onkeydown={teclas}>
  {#if !rep || !traza || !ad || !foto || (tipo === 'juego' && !hayJuego)}
  <div class="programas" role="tablist" aria-label="Programa">
    <button type="button" role="tab" aria-selected={tipo === 'demo'} class:activo={tipo === 'demo'} onclick={() => (tipo = 'demo')}>Paso a paso</button>
    <button type="button" role="tab" aria-selected={tipo === 'juego'} class:activo={tipo === 'juego'} onclick={() => (tipo = 'juego')}>Un juego de verdad</button>
  </div>

  {/if}
  {#if error}
    <p class="aviso">No se pudo cargar la animación: {error}</p>
  {:else if tipo === 'juego' && !hayJuego && programas.length}
    <div class="aviso">
      <p><strong>Todavía no hay un juego de verdad para esta consola.</strong></p>
      <p>
        Se elegirá un juego homebrew con licencia libre (CC0, MIT, zlib, BSD o GPL con su código) entre los candidatos propuestos; en cuanto se
        añada a <code>contenido/fotograma/juegos.json</code> y se genere su traza, aparecerá aquí con el mismo reproductor. Mientras, «Paso a paso»
        enseña el mismo recorrido con un programa corto escrito para la aplicación.
      </p>
    </div>
  {:else if !rep || !traza || !ad || !foto}
    <p class="aviso">Cargando la traza…</p>
  {:else}
    {@const r = rep}
    {@const tr = traza}
    {@const a = ad}
    <div class="barra">
      <div class="programas" role="tablist" aria-label="Programa">
    <button type="button" role="tab" aria-selected={tipo === 'demo'} class:activo={tipo === 'demo'} onclick={() => (tipo = 'demo')}>Paso a paso</button>
    <button type="button" role="tab" aria-selected={tipo === 'juego'} class:activo={tipo === 'juego'} onclick={() => (tipo = 'juego')}>Un juego de verdad</button>
  </div>


      <div class="segmentos" role="group" aria-label="Tramo">
        {#each tr.m.segmentos as s (s.id)}
          <button type="button" aria-pressed={segId === s.id} class:activo={segId === s.id} onclick={() => elegirSegmento(s.id)}>{s.titulo}</button>
        {/each}
      </div>
      {#if normas.length > 1}
        <div class="niveles" role="group" aria-label="Norma de vídeo">
          {#each normas as n (n)}
            <button type="button" aria-pressed={norma === n} class:activo={norma === n} onclick={() => (norma = n)}>{n === 'pal' ? 'PAL · 50 Hz' : 'NTSC · 60 Hz'}</button>
          {/each}
        </div>
      {/if}
      <div class="niveles" role="group" aria-label="Velocidad">
        {#each NIVELES as n (n.id)}
          <button type="button" aria-pressed={nivel === n.id} class:activo={nivel === n.id} title={n.ayuda} onclick={() => elegirNivel(n.id)}>{n.titulo}</button>
        {/each}
      </div>
    </div>

    <div class="controles">
      <button type="button" class="boton-icono" aria-label="Al principio del tramo" title="Al principio" onclick={() => paso((x) => x.irA(x.seg.t0))}><RotateCcw size={17} /></button>
      <button type="button" class="boton-icono" aria-label="Instrucción anterior" title="Instrucción anterior (Mayús + ←)" onclick={() => paso((x) => x.pasoInstruccion(-1))}><SkipBack size={18} /></button>
      <button type="button" class="boton-icono" aria-label="Ciclo anterior" title="Ciclo anterior (←)" onclick={() => paso((x) => x.pasoCiclo(-1))}><ChevronLeft size={20} /></button>
      <button type="button" class="play" aria-label={jugando ? 'Pausar' : 'Reproducir'} onclick={alternar}>
        {#if jugando}<Pause size={20} />{:else}<Play size={20} />{/if}
      </button>
      <button type="button" class="boton-icono" aria-label="Ciclo siguiente" title="Ciclo siguiente (→)" onclick={() => paso((x) => x.pasoCiclo(1))}><ChevronRight size={20} /></button>
      <button type="button" class="boton-icono" aria-label="Instrucción siguiente" title="Instrucción siguiente (Mayús + →)" onclick={() => paso((x) => x.pasoInstruccion(1))}><SkipForward size={18} /></button>
      <button type="button" class="boton-icono" aria-label="Línea siguiente" title="Línea siguiente" onclick={() => paso((x) => x.pasoLinea(1))}><ChevronsDown size={18} /></button>
      <span class="factor" title="Cuánto se ha ralentizado respecto a la consola">{ralentizado}</span>
      <span class="cuenta" data-prueba="cuenta">Instrucción {Math.max(0, foto.ins - (tr.ins.t.findIndex((x) => x >= r.seg.t0)) + 1)} · {foto.pixeles} píxeles</span>
    </div>

    <!-- a new trace (other program) gets new canvases: they subscribe to their player once -->
    {#key r}
    <div class="rejilla">
      <div class="col-pantalla">
        <Pantalla rep={r} />
        {#if r.seg.pixel1 === r.seg.pixel0}
          <p class="nota">Tras el reset la PPU aún no dibuja: lo que se ve es el cuadro que dejará la animación, atenuado.</p>
        {/if}
      </div>

      <section class="recorrido" aria-label="Recorrido por la placa">
        <div class="vistas" role="tablist" aria-label="Dónde ver el recorrido">
          {#if conPlaca}<button type="button" role="tab" aria-selected={vistaRecorrido === 'placa'} class:activo={vistaRecorrido === 'placa'} onclick={() => (vistaRecorrido = 'placa')}>Placa</button>{/if}
          {#if conFoto}<button type="button" role="tab" aria-selected={vistaRecorrido === 'foto'} class:activo={vistaRecorrido === 'foto'} onclick={() => (vistaRecorrido = 'foto')}>Cobre (foto)</button>{/if}
          <button type="button" role="tab" aria-selected={vistaRecorrido === 'esquema'} class:activo={vistaRecorrido === 'esquema'} onclick={() => (vistaRecorrido = 'esquema')}>Esquema</button>
        </div>
        <div class="lienzo-recorrido" data-vista={vistaRecorrido}>
          {#if vistaRecorrido === 'esquema'}
            <EsquemaRecorrido {datos} rep={r} {oscuro} bind:hoja />
          {:else if vistaRecorrido === 'placa'}
            {#await import('./PlacaRecorrido.svelte') then m}<m.default {datos} rep={r} {oscuro} />{/await}
          {:else}
            {#await import('./FotoRecorrido.svelte') then m}<m.default {datos} rep={r} />{/await}
          {/if}
        </div>
        <ul class="leyenda" aria-label="Colores de las señales">
          {#each GRUPOS as g (g.id)}
            <li><span style:background={colorGrupo(g.id, oscuro)}></span>{g.titulo}</li>
          {/each}
        </ul>
        {#if a.avisoPlaca}<p class="nota">{a.avisoPlaca}</p>{/if}
      </section>

      <div class="col-codigo">
        <Desensamblado rep={r} ad={a} {foto} alMover={despertar} />
      </div>

      <div class="col-lecturas">
        <Lecturas rep={r} ad={a} {foto} />
      </div>
    </div>

    <Linea rep={r} alMover={despertar} />

    <p class="resumen">{programa?.resumen} {tr.m.segmentos.find((s) => s.id === segId)?.descripcion}</p>

    {/key}

    <details class="fidelidad">
      <summary>Qué es exacto y de dónde sale</summary>
      <p>{a.fidelidad}</p>
      <p>Traza generada sin conexión por <code>{tr.m.generador.emulador}</code>: {tr.m.generador.detalle} Programa: {tr.m.programa.autor} ({tr.m.programa.licencia}), fuente en <code>{tr.m.programa.fuente}</code>. Traza de {(tr.bytes / 1024).toFixed(0)} kB.{#if tr.m.tipo === 'juego'} <a href="consolas/fotograma/{datos.id}/{tr.m.idPrograma}-LICENCIA.txt" target="_blank" rel="noreferrer">Texto de la licencia</a> · <a href={tr.m.programa.url} target="_blank" rel="noreferrer">código fuente</a>.{/if}</p>
      <ul>
        {#each a.fuentes as f (f.titulo)}
          <li><a href={f.url} target="_blank" rel="noreferrer">{f.titulo}</a>: {f.uso}</li>
        {/each}
      </ul>
    </details>
  {/if}
</div>

<style>
  .fotograma {
    display: grid;
    gap: 10px;
    outline: none;
  }
  .programas,
  .segmentos,
  .niveles,
  .vistas {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 3px;
    border-radius: 12px;
    background: var(--superficie-2);
    justify-self: start;
  }
  .programas button,
  .segmentos button,
  .niveles button,
  .vistas button {
    min-height: 36px;
    padding: 3px 12px;
    border: 0;
    border-radius: 9px;
    background: transparent;
    color: var(--tinta-suave);
    font: inherit;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
  }
  .programas button.activo,
  .segmentos button.activo,
  .niveles button.activo,
  .vistas button.activo {
    background: var(--superficie);
    box-shadow: var(--sombra);
    color: var(--acento);
  }
  .barra {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 14px;
  }
  .resumen,
  .nota {
    margin: 0;
    color: var(--tinta-suave);
    font-size: 13.5px;
    line-height: 1.4;
  }
  .aviso {
    padding: 16px 18px;
    border-radius: 14px;
    background: var(--superficie-2);
    color: var(--tinta);
  }
  .aviso p {
    margin: 0 0 6px;
  }
  .controles {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }
  .play {
    display: inline-grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border: 0;
    border-radius: 50%;
    background: var(--banda);
    color: #fff;
    box-shadow: var(--sombra);
    cursor: pointer;
  }
  .factor,
  .cuenta {
    color: var(--tinta-suave);
    font-size: 13.5px;
    font-variant-numeric: tabular-nums;
  }
  .cuenta {
    margin-left: auto;
  }
  .rejilla {
    display: grid;
    grid-template-columns: 320px minmax(0, 1fr) 340px;
    grid-template-areas:
      'pantalla recorrido codigo'
      'lecturas recorrido codigo';
    gap: 12px;
    align-items: start;
  }
  .col-pantalla {
    grid-area: pantalla;
    display: grid;
    gap: 6px;
  }
  .recorrido {
    grid-area: recorrido;
    display: grid;
    gap: 6px;
    min-width: 0;
  }
  .col-codigo {
    grid-area: codigo;
    min-width: 0;
  }
  .col-lecturas {
    grid-area: lecturas;
    min-width: 0;
  }
  .lienzo-recorrido {
    height: 560px;
    min-height: 0;
  }
  .leyenda {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: 12.5px;
    color: var(--tinta-suave);
  }
  .leyenda li {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  .leyenda span {
    width: 18px;
    height: 4px;
    border-radius: 2px;
  }
  .fidelidad {
    padding: 8px 12px;
    border: 1px solid var(--linea);
    border-radius: 12px;
    font-size: 14px;
  }
  .fidelidad summary {
    font-weight: 700;
    cursor: pointer;
  }
  .fidelidad p {
    line-height: 1.45;
  }
  @media (max-width: 1239px) {
    .rejilla {
      grid-template-columns: minmax(0, 300px) minmax(0, 1fr);
      grid-template-areas:
        'pantalla codigo'
        'recorrido recorrido'
        'lecturas lecturas';
    }
    .lienzo-recorrido {
      height: 460px;
    }
  }
  @media (max-width: 640px) {
    .rejilla {
      grid-template-columns: minmax(0, 1fr);
      grid-template-areas:
        'pantalla'
        'codigo'
        'recorrido'
        'lecturas';
    }
    .lienzo-recorrido {
      height: 380px;
    }
    .cuenta {
      margin-left: 0;
      width: 100%;
    }
  }
</style>
