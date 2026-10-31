<script lang="ts">
  // «Cursos» (0.11, #/cursos[/<curso>[/prueba]]): the book's chapters grouped by subject. The list shows each
  // course with its progress and «Continuar» (the next lesson not completed nor passed); a course shows its
  // chapters and their lessons (completed ✓, passed by the placement test, started, pending) and its placement
  // test; /prueba runs the test (PruebaNivel.svelte).
  import { onMount } from 'svelte';
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import Check from '@lucide/svelte/icons/check';
  import Compass from '@lucide/svelte/icons/compass';
  import FastForward from '@lucide/svelte/icons/fast-forward';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import { app } from '../../lib/estado.svelte';
  import { ruta } from '../../lib/ruta.svelte';
  import { tonoBloque } from '../../lib/color';
  import { rotuloParte } from '../../lib/datos';
  import { corto } from '../../lib/navegacion.svelte';
  import { cargarLecciones } from '../../lib/lecciones.svelte';
  import { cargarCursos, estadoCursos } from '../../lib/aprendizaje/cursos-estado.svelte';
  import { CURSOS, CURSO } from '../../lib/aprendizaje/cursos';
  import { avanceCurso, type LeccionConEstado } from './avance.svelte';
  import Insignia from '../Insignia.svelte';
  import PruebaNivel from './PruebaNivel.svelte';
  // 0.11 group B: mastery of each course, chapter and lesson (only once something has been practised)
  import { cargarDominio, dominioDe, dominioDeClaves, estadoDominio } from '../../lib/aprendizaje/dominio.svelte';
  import { cargarPracticables, conceptosPracticables } from '../../lib/aprendizaje/catalogo';
  import BarraDominio from '../dominio/BarraDominio.svelte';
  import MedidorDominio from '../dominio/MedidorDominio.svelte';

  const indice = $derived(app.indice!);
  const partesRuta = $derived(ruta.ancla.split('/').filter(Boolean));
  const curso = $derived(partesRuta[0] ? (CURSO.get(partesRuta[0]) ?? null) : null);
  const enPrueba = $derived(!!curso && partesRuta[1] === 'prueba');

  const avances = $derived(CURSOS.map((c) => ({ c, a: avanceCurso(c, indice) })));
  const avance = $derived(curso ? avanceCurso(curso, indice) : null);
  const prueba = $derived(curso ? estadoCursos.pruebas[curso.id] : undefined);

  function tonoDe(partes: string[]) {
    return tonoBloque(indice.partes[partes[0] ?? '']?.color, app.tema);
  }

  const porCapitulo = $derived.by(() => {
    if (!curso || !avance) return [];
    return curso.partes.map((p) => ({ parte: p, lecciones: avance.lecciones.filter((l) => l.parte === p) }));
  });

  // Chapters unfolded: the one with the next lesson by default.
  let abiertos = $state<Record<string, boolean>>({});
  const abierto = (p: string) => abiertos[p] ?? avance?.siguiente?.parte === p;

  const pct = (f: number) => `${Math.round(f * 100)} %`;
  const fecha = (t: number) => new Date(t).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

  const ESTADO: Record<LeccionConEstado['estado'], string> = {
    hecha: 'Completada',
    superada: 'Superada por la prueba',
    'en-curso': 'Empezada',
    pendiente: 'Pendiente',
  };

  let practicables = $state(false);
  /** Mastery of some chapters (null until the data are in, or when nothing there has been practised). */
  function dominioPartes(partes: string[]) {
    if (!practicables || !estadoDominio.listo) return null;
    const a = dominioDeClaves(partes.flatMap((p) => conceptosPracticables(p)));
    return a.practicados ? a : null;
  }

  onMount(() => {
    void cargarLecciones();
    void cargarCursos();
    void cargarDominio();
    void cargarPracticables().then(() => (practicables = true));
  });

  $effect(() => {
    void ruta.n;
    window.scrollTo({ top: ruta.y ?? 0, behavior: 'instant' });
  });
</script>

<svelte:head><title>{curso ? `${curso.nombre} · Cursos` : 'Cursos'} · Electrónica Práctica Avanzada</title></svelte:head>

{#if curso && enPrueba}
  {#key ruta.n}
    <PruebaNivel {curso} />
  {/key}
{:else if curso && avance}
  {@const tono = tonoDe(curso.partes)}
  <div class="cursos" data-curso={curso.id} style:--c09={tono.relleno} style:--sobre09={tono.sobre}>
    <a class="volver" href="#/cursos"><ArrowLeft size={18} aria-hidden="true" /> Todos los cursos</a>
    <header class="cab-curso t09-tarjeta t09-grande t09-banda">
      <h1>{curso.nombre}</h1>
      <p class="desc">{curso.descripcion}</p>
      <div class="avance-curso">
        <span class="barra" aria-hidden="true"><span style:transform={`scaleX(${avance.fraccion})`}></span></span>
        <span class="cifras" data-avance={`${avance.hechas}/${avance.superadas}/${avance.total}`}>
          {avance.hechas} de {avance.total} lecciones completadas{#if avance.superadas}{` · ${avance.superadas} ${avance.superadas === 1 ? 'superada' : 'superadas'} por la prueba`}{/if}
        </span>
      </div>
      <div class="botones">
        {#if avance.href && avance.siguiente}
          <a class="t09-boton" href={avance.href} data-continuar-curso>
            {avance.empezado ? 'Continuar' : 'Empezar'}
            <ArrowRight size={20} aria-hidden="true" />
          </a>
        {:else}
          <span class="terminado"><Check size={18} aria-hidden="true" /> Curso terminado</span>
        {/if}
        <a class="t09-boton t09-contorno" href={`#/cursos/${curso.id}/prueba`} data-prueba-nivel><Compass size={18} aria-hidden="true" /> Prueba de nivel</a>
      </div>
      {#if dominioPartes(curso.partes)}
        {@const dc = dominioPartes(curso.partes)!}
        <div class="dominio-curso" data-dominio-curso={curso.id}>
          <span class="rot-dominio">Dominio</span>
          <BarraDominio a={dc} />
        </div>
      {/if}
      {#if avance.siguiente}
        <p class="sig">Siguiente: <strong>{avance.siguiente.num ? `${avance.siguiente.num} ` : ''}{avance.siguiente.titulo}</strong></p>
      {/if}
      {#if prueba}
        <p class="ultima-prueba" data-ultima-prueba>
          Prueba de nivel del {fecha(prueba.t)}: {prueba.aciertos} de {prueba.total} bien{#if prueba.recomendado}{`; le recomendamos empezar por el ${rotuloParte(prueba.recomendado).toLowerCase()}`}{/if}.
        </p>
      {/if}
    </header>

    <ol class="capitulos">
      {#each porCapitulo as cap (cap.parte)}
        {@const info = indice.partes[cap.parte]}
        {@const hechas = cap.lecciones.filter((l) => l.estado === 'hecha' || l.estado === 'superada').length}
        {@const abre = abierto(cap.parte)}
        <li class="capitulo" data-capitulo={cap.parte}>
          <button type="button" class="cab-cap" aria-expanded={abre} onclick={() => (abiertos[cap.parte] = !abre)}>
            <Insignia parte={cap.parte} grande />
            <span class="tit">
              <span class="rot">{rotuloParte(cap.parte)}</span>
              <span class="nombre">{corto(info?.titulo ?? cap.parte)}</span>
              {#if dominioPartes([cap.parte])}<span class="dom-cap" data-dominio-capitulo={cap.parte}><BarraDominio a={dominioPartes([cap.parte])!} resumen={false} /></span>{/if}
            </span>
            <span class="cuenta">{hechas}/{cap.lecciones.length}</span>
            <span class="flecha" class:girada={abre} aria-hidden="true"><ChevronDown size={20} /></span>
          </button>
          {#if abre}
            <ul class="lecciones">
              {#each cap.lecciones as l (l.label)}
                <li>
                  <a class="leccion" href={`#/leccion/${l.parte}/${encodeURIComponent(l.label)}`} data-leccion-curso={`${l.parte}/${l.label}`} data-estado={l.estado}>
                    <span class="marca {l.estado}" aria-hidden="true">
                      {#if l.estado === 'hecha'}<Check size={15} strokeWidth={3} />{:else if l.estado === 'superada'}<FastForward size={14} strokeWidth={2.4} />{/if}
                    </span>
                    <span class="txt">{l.num ? `${l.num} ` : ''}{l.titulo}</span>
                    {#if estadoDominio.listo}{@const dl = dominioDe(`${l.parte}/${l.label}`)}{#if dl.nivel !== 'nuevo'}<MedidorDominio nivel={dl.nivel} valor={dl.valor} repasar={dl.repasar} />{/if}{/if}
                    <span class="estado" class:solo-lector={l.estado === 'pendiente'}>{ESTADO[l.estado]}</span>
                  </a>
                </li>
              {/each}
            </ul>
          {/if}
        </li>
      {/each}
    </ol>
  </div>
{:else}
  <div class="cursos" data-cursos>
    <header class="cab">
      <h1>Cursos</h1>
      <p>Los capítulos del libro agrupados por temas. Cada curso sigue un orden de lo más sencillo a lo más avanzado; si ya domina una parte, la prueba de nivel le dice por dónde empezar.</p>
    </header>
    <ul class="lista">
      {#each avances as { c, a } (c.id)}
        {@const tono = tonoDe(c.partes)}
        <li class="t09-tarjeta t09-banda curso" style:--c09={tono.relleno} style:--sobre09={tono.sobre} data-curso-tarjeta={c.id}>
          <h2><a class="toque-44" href={`#/cursos/${c.id}`}>{c.nombre}</a></h2>
          <p class="desc">{c.descripcion}</p>
          <p class="meta">{c.partes.length} capítulos · {a.total} lecciones</p>
          <div class="avance-curso">
            <span class="barra" aria-hidden="true"><span style:transform={`scaleX(${a.fraccion})`}></span></span>
            <span class="cifras">{pct(a.fraccion)}</span>
          </div>
          {#if dominioPartes(c.partes)}<div class="dominio-lista" data-dominio-curso={c.id}><BarraDominio a={dominioPartes(c.partes)!} /></div>{/if}
          <div class="botones">
            {#if a.href}
              <a class="t09-boton t09-contorno" href={a.href} data-continuar-curso={c.id}>{a.empezado ? 'Continuar' : 'Empezar'} <ArrowRight size={18} aria-hidden="true" /></a>
            {:else}
              <span class="terminado"><Check size={18} aria-hidden="true" /> Terminado</span>
            {/if}
            {#if !a.empezado}
              <a class="enlace" href={`#/cursos/${c.id}/prueba`}>Prueba de nivel</a>
            {:else}
              <a class="enlace" href={`#/cursos/${c.id}`}>Ver el curso</a>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
    <p class="pie"><a class="enlace" href="#/progreso">Progreso y logros</a></p>
  </div>
{/if}

<style>
  .dominio-curso {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .rot-dominio {
    align-self: flex-start;
    color: var(--tinta-suave);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .dom-cap {
    display: block;
    width: min(220px, 100%);
    margin-top: 4px;
  }
  .dominio-lista {
    margin-top: -2px;
  }
  .cursos {
    display: flex;
    flex-direction: column;
    gap: 20px;
    max-width: 1120px;
    margin: 0 auto;
    padding: 32px 32px 64px;
    font-family: var(--sans);
  }
  .cursos[data-curso] {
    max-width: 760px;
  }
  @media (max-width: 600px) {
    .cursos {
      padding: 16px 16px 48px;
    }
  }
  h1 {
    margin: 0;
    color: var(--titulos);
    font-family: var(--serif);
    font-size: 30px;
    line-height: 1.2;
  }
  .cab p {
    max-width: 46em;
    margin: 6px 0 0;
    color: var(--tinta-suave);
    font-size: 16px;
    line-height: 1.45;
  }
  .lista {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 16px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .curso {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .curso h2 {
    margin: 0;
    font-family: var(--serif);
    font-size: 21px;
    line-height: 1.25;
  }
  .curso h2 a {
    color: var(--titulos);
    text-decoration: none;
  }
  .curso h2 a:hover {
    text-decoration: underline;
  }
  .desc {
    margin: 0;
    color: var(--tinta-suave);
    font-size: 15px;
    line-height: 1.4;
  }
  .meta {
    margin: 0;
    color: var(--tinta-suave);
    font-size: 13.5px;
    font-weight: 600;
  }
  .avance-curso {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .barra {
    flex: 1;
    height: 8px;
    overflow: hidden;
    border-radius: 999px;
    background: var(--linea);
  }
  .barra span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--c09, var(--acento));
    transform-origin: left center;
  }
  .cifras {
    color: var(--tinta-suave);
    font-size: 14px;
    font-variant-numeric: tabular-nums;
  }
  .botones {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px 16px;
    margin-top: auto;
    padding-top: 4px;
  }
  .enlace {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    color: var(--acento);
    font-size: 15px;
    font-weight: 600;
  }
  .terminado {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    color: var(--c-ejemplo);
    font-weight: 700;
  }
  .pie {
    margin: 0;
    font-size: 15px;
  }
  .volver {
    display: inline-flex;
    align-self: flex-start;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    color: var(--acento);
    font-size: 15px;
    font-weight: 600;
    text-decoration: none;
  }
  .cab-curso {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .cab-curso .desc {
    font-size: 16px;
  }
  /* the course's bar on its own line, its figures under it */
  .cab-curso .avance-curso {
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
  }
  .cab-curso .barra {
    flex: none;
  }
  .sig,
  .ultima-prueba {
    margin: 0;
    color: var(--tinta-suave);
    font-size: 14.5px;
    line-height: 1.4;
  }
  .sig strong {
    color: var(--tinta);
  }
  .capitulos {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .capitulo {
    border: 1px solid var(--linea);
    border-radius: var(--radio-tarjeta-p);
    background: var(--superficie);
    overflow: hidden;
  }
  .cab-cap {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 64px;
    padding: 10px 14px;
    border: 0;
    background: none;
    color: var(--tinta);
    font-family: var(--sans);
    text-align: left;
  }
  .cab-cap:hover {
    background: var(--hover);
  }
  .tit {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }
  .tit .rot {
    color: var(--tinta-suave);
    font-size: 12.5px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .tit .nombre {
    color: var(--titulos);
    font-family: var(--serif);
    font-size: 17px;
    font-weight: 600;
    line-height: 1.3;
  }
  .cuenta {
    color: var(--tinta-suave);
    font-size: 14px;
    font-variant-numeric: tabular-nums;
  }
  .flecha {
    display: grid;
    color: var(--tinta-suave);
    transition: transform 0.15s;
  }
  .flecha.girada {
    transform: rotate(180deg);
  }
  .lecciones {
    margin: 0;
    padding: 0 0 6px;
    list-style: none;
    border-top: 1px solid var(--linea-suave);
  }
  .leccion {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 48px;
    padding: 6px 14px;
    color: var(--tinta);
    font-size: 15px;
    line-height: 1.35;
    text-decoration: none;
  }
  .leccion:hover {
    background: var(--hover);
  }
  .marca {
    display: grid;
    flex: none;
    place-items: center;
    width: 24px;
    height: 24px;
    border: 2px solid var(--linea);
    border-radius: 50%;
  }
  .marca.hecha {
    border-color: var(--c09, var(--acento));
    background: var(--c09, var(--acento));
    color: var(--sobre09, #fff);
  }
  .marca.superada {
    border-style: dashed;
    border-color: var(--tinta-suave);
    color: var(--tinta-suave);
  }
  .marca.en-curso {
    border-color: var(--ambar-relleno);
    background: linear-gradient(90deg, var(--ambar-relleno) 50%, transparent 50%);
  }
  .leccion .txt {
    flex: 1;
    min-width: 0;
  }
  .leccion .estado {
    flex: none;
    color: var(--tinta-suave);
    font-size: 13px;
  }
  .leccion[data-estado='superada'] .estado {
    font-style: italic;
  }
  @media (max-width: 600px) {
    .leccion .estado:not(.solo-lector) {
      max-width: 9em;
      text-align: right;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .flecha {
      transition: none;
    }
  }
</style>
