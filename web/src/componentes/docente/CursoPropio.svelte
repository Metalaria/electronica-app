<script lang="ts">
  // An own course (#/docente/curso/<id>[/<n>]), played like the thematic courses: the list of its sections, exercises
  // and questions with their state (from the progress the app already keeps: lessons, exercises, answers), the
  // progress bar and «Continuar» (the first thing not done). A section opens its lesson «Estudiar por pasos»; an
  // exercise or a question opens here, one per screen, with «Anterior» and «Siguiente».
  import { onMount } from 'svelte';
  import Check from '@lucide/svelte/icons/check';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import Pencil from '@lucide/svelte/icons/pencil';
  import { cargarLecciones, progresoLecciones, rutaLeccion } from '../../lib/lecciones.svelte';
  import { cargarCursos } from '../../lib/aprendizaje/cursos-estado.svelte';
  import { aprendizaje, cargarAprendizaje, estadoDe } from '../../lib/aprendizaje.svelte';
  import { cargarDominio, estadoDominio, ultimasRespuestas } from '../../lib/aprendizaje/dominio.svelte';
  import { cargarDocente, docente, propio } from '../../lib/docente/estado.svelte';
  import { libro, prepararItems } from '../../lib/docente/fuentes';
  import type { ElementoCurso } from '../../lib/docente/tipos';
  import { estadoLeccion } from '../cursos/avance.svelte';
  import { cargarRepaso, registrarRespuesta } from '../repaso/estado.svelte';
  import TarjetaEjercicio from '../aprender/TarjetaEjercicio.svelte';
  import Pregunta, { type Respuesta } from '../pregunta/Pregunta.svelte';
  import ExportarPdf from './ExportarPdf.svelte';
  // 1.0: the course as a path (lessons open one after another; exercises and questions open with the lesson before)
  import { calcularCamino, repasoDe, saltadas, type NodoEntrada } from '../../lib/aprendizaje/camino';
  import { dominioDe } from '../../lib/aprendizaje/dominio.svelte';
  import Camino, { type GrupoCamino } from '../cursos/Camino.svelte';
  import SaltarHasta from '../cursos/SaltarHasta.svelte';
  import { vistaCursos } from '../cursos/vista.svelte';
  import { ahoraMinuto } from '../../lib/aprendizaje/minuto.svelte';

  let { id, paso, salto = null }: { id: string; paso: number | null; salto?: number | null } = $props();

  let listo = $state(false);
  let error = $state('');
  let respuestas = $state<Record<number, Respuesta>>({});

  onMount(() => {
    void (async () => {
      try {
        await Promise.all([cargarDocente(), cargarLecciones(), cargarCursos(), cargarAprendizaje(), cargarDominio(), cargarRepaso()]);
        const p = propio(id);
        if (!p || p.tipo !== 'curso') throw new Error('Este curso ya no existe (se ha borrado).');
        await prepararItems((p.curso?.elementos ?? []).map((e) => (e.k === 'seccion' ? { k: 'seccion' as const, ref: e.label, parte: e.parte } : e.k === 'ejercicio' ? { k: 'ejercicio' as const, ref: e.label } : { k: 'pregunta' as const, ref: e.id })));
        listo = true;
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }
    })();
  });

  const p = $derived(docente.listo ? propio(id) : null);
  const elementos = $derived(p?.tipo === 'curso' ? (p.curso?.elementos ?? []) : []);

  type Estado = 'hecho' | 'empezado' | 'fallado' | 'pendiente';
  function estado(el: ElementoCurso): Estado {
    void progresoLecciones.secciones;
    void aprendizaje.ejercicios;
    void estadoDominio.version;
    if (el.k === 'seccion') {
      const e = estadoLeccion(el.parte, el.label);
      return e === 'hecha' || e === 'superada' ? 'hecho' : e === 'en-curso' ? 'empezado' : 'pendiente';
    }
    if (el.k === 'ejercicio') {
      const e = estadoDe(el.label);
      return e === 'resuelto' ? 'hecho' : e === 'fallado' ? 'fallado' : 'pendiente';
    }
    const u = ultimasRespuestas()[el.id];
    return !u ? 'pendiente' : u.p >= 60 ? 'hecho' : 'fallado';
  }
  const estados = $derived(listo ? elementos.map(estado) : []);
  const hechos = $derived(estados.filter((e) => e === 'hecho').length);
  const siguiente = $derived(estados.findIndex((e) => e !== 'hecho'));
  const NOMBRE_ESTADO: Record<Estado, string> = { hecho: 'Hecho', empezado: 'Empezado', fallado: 'Fallado', pendiente: 'Pendiente' };

  function nombre(el: ElementoCurso): string {
    if (el.k === 'seccion') {
      const s = libro.seccion(el.parte, el.label);
      return `${s?.num ?? ''} ${s?.titulo ?? el.label}`.trim();
    }
    if (el.k === 'ejercicio') {
      const e = libro.ejercicio(el.label);
      return e ? `${e.tipo === 'prob' ? 'Problema' : 'Ejercicio'} ${e.num}${e.titulo ? ` · ${e.titulo}` : ''}` : el.label;
    }
    return `Pregunta de test ${Number(/-(\d+)$/.exec(el.id)?.[1] ?? 0)} · ${libro.rotulo(el.id.replace(/-\d+$/, ''))}`;
  }
  function href(el: ElementoCurso, i: number): string {
    if (el.k === 'seccion') {
      const pr = progresoLecciones.secciones[`${el.parte}/${el.label}`];
      return rutaLeccion(el.parte, el.label, pr && !pr.c ? Math.min(pr.u, Math.max(0, pr.n - 1)) : undefined);
    }
    return `#/docente/curso/${id}/${i}`;
  }
  const TIPO: Record<ElementoCurso['k'], string> = { seccion: 'Lección', ejercicio: 'Ejercicio', pregunta: 'Pregunta' };

  const actual = $derived(paso != null && paso >= 0 && paso < elementos.length ? elementos[paso]! : null);

  // ---------------------------------------------------------------- 1.0: the path
  function entrada(el: ElementoCurso, e: Estado | undefined): NodoEntrada {
    if (el.k === 'seccion') {
      const l = estadoLeccion(el.parte, el.label);
      return { clave: `${el.parte}/${el.label}`, leccion: true, progreso: l === 'hecha' ? 'hecho' : l === 'superada' ? 'superado' : l === 'en-curso' ? 'empezado' : 'nada' };
    }
    return { clave: `${el.k}:${el.k === 'ejercicio' ? el.label : el.id}`, leccion: false, progreso: e === 'hecho' ? 'hecho' : e === 'fallado' || e === 'empezado' ? 'empezado' : 'nada' };
  }
  const entradas = $derived(elementos.map((el, i) => entrada(el, estados[i])));
  const camino = $derived(calcularCamino(entradas));
  // the review dates move into «Para repasar hoy» as time passes (a clock that ticks every minute)
  const ahora = $derived(ahoraMinuto());
  const grupos = $derived.by((): GrupoCamino[] => {
    if (!listo) return [];
    const nodos = elementos.map((el, i) => {
      const e = entradas[i]!;
      const est = camino.estados[i]!;
      const pr = el.k === 'seccion' ? progresoLecciones.secciones[e.clave] : undefined;
      const hecho = est === 'hecho' || est === 'superado';
      return {
        clave: `${i}:${e.clave}`,
        rotulo: `${TIPO[el.k]} ${i + 1}`,
        titulo: nombre(el),
        href: href(el, i),
        estado: est,
        progreso: hecho ? 1 : pr?.n ? Math.min(1, pr.h.length / pr.n) : est === 'en-curso' ? 0.5 : 0,
        repaso: el.k === 'seccion' && hecho && estadoDominio.listo ? repasoDe(dominioDe(e.clave), ahora) : null,
        tipo: el.k === 'seccion' ? ('leccion' as const) : el.k === 'ejercicio' ? ('ejercicio' as const) : ('pregunta' as const),
        // offered on the first locked node and on every locked lesson (an own course is short)
        saltar: est === 'bloqueado' && (camino.estados.indexOf('bloqueado') === i || el.k === 'seccion') ? `#/docente/curso/${id}/saltar/${i}` : undefined,
      };
    });
    return [{ clave: 'curso', titulo: 'El camino del curso', nodos }];
  });
  const siguienteClave = $derived(camino.siguiente >= 0 ? `${camino.siguiente}:${entradas[camino.siguiente]?.clave}` : null);
  const datosSalto = $derived.by(() => {
    if (salto == null || !listo || salto < 0 || salto >= elementos.length) return null;
    return { destino: nombre(elementos[salto]!), href: href(elementos[salto]!, salto), lecciones: saltadas(entradas, salto) };
  });
</script>

<div class="curso" data-curso-propio={id}>
  <p class="volver"><a class="enlace toque-44" href={paso != null ? `#/docente/curso/${id}` : '#/docente'}>← {paso != null ? 'El curso' : 'Modo docente'}</a></p>
  {#if error}
    <p class="aviso" role="alert">{error}</p>
  {:else if !listo || !p}
    <p class="cargando">Cargando el curso…</p>
  {:else if datosSalto}
    {#key salto}
      <SaltarHasta destino={datosSalto.destino} hrefDestino={datosSalto.href} lecciones={datosSalto.lecciones} volver={`#/docente/curso/${id}`} contexto={`Saltar · ${p.titulo}`} />
    {/key}
  {:else if actual && paso != null}
    <p class="contador">{TIPO[actual.k]} {paso + 1} de {elementos.length} · {p.titulo}</p>
    {#if actual.k === 'seccion'}
      <section class="t09-tarjeta">
        <h1>{nombre(actual)}</h1>
        <p>{libro.rotulo(actual.parte)}</p>
        <div class="botones">
          <a class="t09-boton" href={href(actual, paso)}>Estudiar por pasos <ArrowRight size={18} aria-hidden="true" /></a>
          <a class="t09-boton t09-contorno" href={`#/${actual.parte}/${encodeURIComponent(actual.label)}`}>Leer en el libro</a>
        </div>
      </section>
    {:else if actual.k === 'ejercicio'}
      {#key actual.label}<TarjetaEjercicio label={actual.label} />{/key}
    {:else}
      {@const q = libro.pregunta(actual.id)}
      {#if q}
        {#key actual.id}
          <Pregunta
            pregunta={q}
            parte={actual.id.replace(/-\d+$/, '')}
            respuesta={respuestas[paso] ?? null}
            etiqueta="Pregunta"
            rotulo={libro.rotulo(actual.id.replace(/-\d+$/, ''))}
            onresponder={(r) => {
              respuestas[paso] = r;
              registrarRespuesta(q.id, actual.id.replace(/-\d+$/, ''), r.bien);
            }}
          />
        {/key}
      {/if}
    {/if}
    <nav class="pasos" aria-label="Elementos del curso">
      {#if paso > 0}<a class="t09-boton t09-contorno" href={href(elementos[paso - 1]!, paso - 1)} data-anterior><ArrowLeft size={18} aria-hidden="true" /> Anterior</a>{/if}
      {#if paso < elementos.length - 1}
        <a class="t09-boton" href={href(elementos[paso + 1]!, paso + 1)} data-siguiente>Siguiente <ArrowRight size={18} aria-hidden="true" /></a>
      {:else}
        <a class="t09-boton" href={`#/docente/curso/${id}`}>Terminar</a>
      {/if}
    </nav>
  {:else}
    <header>
      <h1>{p.titulo}</h1>
      {#if p.notas}<p class="notas">{p.notas}</p>{/if}
      <div class="avance">
        <span class="barra" aria-hidden="true"><span style:transform={`scaleX(${elementos.length ? hechos / elementos.length : 0})`}></span></span>
        <span data-avance-curso>{hechos} de {elementos.length} hechos</span>
      </div>
      <div class="botones">
        {#if siguiente >= 0}
          <a class="t09-boton" href={href(elementos[siguiente]!, siguiente)} data-continuar>{hechos ? 'Continuar' : 'Empezar'} <ArrowRight size={18} aria-hidden="true" /></a>
        {:else if elementos.length}
          <span class="terminado"><Check size={18} aria-hidden="true" /> Terminado</span>
        {/if}
        <a class="t09-boton t09-contorno" href={`#/docente/editar/${id}`}><Pencil size={16} aria-hidden="true" /> Editar</a>
      </div>
    </header>
    <div class="vistas" role="group" aria-label="Cómo ver el curso">
      <button type="button" aria-pressed={vistaCursos.v === 'camino'} onclick={() => (vistaCursos.v = 'camino')} data-vista="camino">Camino</button>
      <button type="button" aria-pressed={vistaCursos.v === 'lista'} onclick={() => (vistaCursos.v = 'lista')} data-vista="lista">Lista</button>
    </div>
    {#if vistaCursos.v === 'camino'}
      <Camino {grupos} siguiente={siguienteClave} {ahora} />
    {:else}
    <ol class="elementos">
      {#each elementos as el, i (i)}
        <li>
          <a class="elemento" href={href(el, i)} data-elemento={i} data-estado={estados[i]}>
            <span class="marca {estados[i]}" aria-hidden="true">{#if estados[i] === 'hecho'}<Check size={15} strokeWidth={3} />{:else}{i + 1}{/if}</span>
            <span class="txt"><span class="tipo">{TIPO[el.k]}</span> {nombre(el)}</span>
            <span class="estado">{NOMBRE_ESTADO[estados[i] ?? 'pendiente']}</span>
          </a>
        </li>
      {/each}
    </ol>
    {/if}
    <ExportarPdf propio={p} />
  {/if}
</div>

<style>
  .vistas {
    display: inline-flex;
    align-self: flex-start;
    padding: 3px;
    border: 1px solid var(--linea);
    border-radius: 14px;
    background: var(--superficie);
  }
  .vistas button {
    min-width: 96px;
    min-height: 44px;
    padding: 0 16px;
    border: 0;
    border-radius: 11px;
    background: transparent;
    color: var(--tinta);
    font-size: 15px;
    font-weight: 600;
  }
  .vistas button[aria-pressed='true'] {
    background: var(--acento);
    color: var(--fondo);
  }
  .curso {
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-width: 820px;
    margin: 0 auto;
    padding: 24px 32px 64px;
    font-family: var(--sans);
  }
  @media (max-width: 600px) {
    .curso {
      padding: 12px 16px 48px;
    }
  }
  .volver,
  .contador {
    margin: 0;
  }
  .contador {
    color: var(--tinta-suave);
    font-size: 14px;
    font-weight: 600;
  }
  h1 {
    margin: 0;
    color: var(--titulos);
    font-family: var(--serif);
    font-size: 28px;
  }
  header,
  section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .notas {
    margin: 0;
    color: var(--tinta);
    white-space: pre-line;
  }
  section p {
    margin: 0;
    color: var(--tinta-suave);
  }
  .avance {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--tinta-suave);
    font-size: 14px;
  }
  .barra {
    flex: 1;
    max-width: 320px;
    height: 8px;
    overflow: hidden;
    border-radius: 99px;
    background: var(--linea);
  }
  .barra > span {
    display: block;
    height: 100%;
    background: var(--acento);
    transform-origin: left;
  }
  .botones,
  .pasos {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .pasos {
    justify-content: space-between;
  }
  .t09-boton {
    min-height: 44px;
  }
  .terminado {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--titulos);
    font-weight: 700;
  }
  .elementos {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .elemento {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 48px;
    padding: 6px 12px;
    border: 1px solid var(--linea);
    border-radius: 12px;
    background: var(--superficie);
    color: var(--tinta);
    text-decoration: none;
  }
  .elemento:hover {
    border-color: var(--acento);
  }
  .marca {
    display: grid;
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    place-items: center;
    border: 1.5px solid var(--linea);
    border-radius: 50%;
    color: var(--tinta-suave);
    font-size: 13px;
    font-weight: 700;
  }
  .marca.hecho {
    border-color: var(--acento);
    background: var(--acento);
    color: var(--sobre-acento);
  }
  .txt {
    flex: 1;
  }
  .tipo {
    color: var(--tinta-suave);
    font-size: 13px;
    font-weight: 700;
  }
  .estado {
    color: var(--tinta-suave);
    font-size: 13px;
  }
  .aviso {
    padding: 12px 14px;
    border: 1px solid var(--linea);
    border-radius: 12px;
  }
</style>
