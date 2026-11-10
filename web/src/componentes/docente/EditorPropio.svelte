<script lang="ts">
  // Creates or edits an own course (an ordered list of book sections, exercises and questions) or exam (book items
  // with their points, total time, variants with changing values, shuffled order and options, room to answer on
  // paper). Nothing is stored until «Guardar».
  import { onMount } from 'svelte';
  import ArrowUp from '@lucide/svelte/icons/arrow-up';
  import ArrowDown from '@lucide/svelte/icons/arrow-down';
  import X from '@lucide/svelte/icons/x';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  import { rotuloParte } from '../../lib/datos';
  import { app } from '../../lib/estado.svelte';
  import { confirmar } from '../../lib/confirmar';
  import { actualizarPropio, cargarDocente, crearCurso, crearExamen, docente, propio } from '../../lib/docente/estado.svelte';
  import { cargarBanco } from '../../lib/docente/fuentes';
  import { bancoDe, elegirPorFiltros, entradaDe, FILTROS_VACIOS, puntosPorDefecto, type EntradaBanco } from '../../lib/docente/banco';
  import { nuevaSemilla, textoPuntos } from '../../lib/docente/examen';
  import type { ElementoCurso, EspacioRespuesta, FiltrosExamen, ItemExamen } from '../../lib/docente/tipos';
  import Selector from './Selector.svelte';
  import { leerBorrador } from './borrador';
  import { registrarGuardaSalida } from '../../lib/salida';

  let { tipo: tipoNuevo, id }: { tipo?: 'curso' | 'examen'; id?: string } = $props();

  let banco = $state.raw<EntradaBanco[]>([]);
  let error = $state('');
  let listo = $state(false);
  let guardando = $state(false);
  let cambiado = $state(false);

  let tipo = $state<'curso' | 'examen'>('examen');
  let titulo = $state('');
  let notas = $state('');
  let elementos = $state<ElementoCurso[]>([]);
  let items = $state<ItemExamen[]>([]);
  let minutos = $state(60);
  let variantes = $state(true);
  let barajar = $state(true);
  let espacio = $state<EspacioRespuesta>('corto');
  let semilla = $state(0);
  let filtros = $state<FiltrosExamen>({ ...FILTROS_VACIOS });
  let aviso = $state('');

  onMount(() => {
    void (async () => {
      try {
        await cargarDocente();
        const datos = await cargarBanco();
        banco = bancoDe(datos);
        if (id) {
          const p = propio(id);
          if (!p) throw new Error('Este curso o examen ya no existe (se ha borrado).');
          tipo = p.tipo;
          titulo = p.titulo;
          notas = p.notas;
          if (p.tipo === 'curso') elementos = structuredClone($state.snapshot(p.curso?.elementos ?? []));
          else if (p.examen) {
            items = structuredClone($state.snapshot(p.examen.items));
            minutos = p.examen.minutos;
            variantes = p.examen.variantes;
            barajar = p.examen.barajar;
            espacio = p.examen.espacio;
            semilla = p.examen.semilla;
            if (p.examen.filtros) filtros = { ...FILTROS_VACIOS, ...p.examen.filtros };
          }
        } else {
          tipo = tipoNuevo ?? 'examen';
          semilla = nuevaSemilla();
        }
        listo = true;
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }
    })();
    // (review 10c) unsaved changes: the app's dialog before leaving through one of its links or its failure notice
    // (review 10f: the router asks this guard on every route change — the rail's buttons, the search, «Atrás» —; the
    // clicks on links are still taken here first, so that they leave no extra history entry)
    const quitarGuarda = registrarGuardaSalida(
      () => (cambiado ? descartar() : Promise.resolve(true)),
      () => cambiado,
    );
    const alClic = (ev: MouseEvent) => {
      if (!cambiado || ev.defaultPrevented || ev.button !== 0 || ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey) return;
      const a = (ev.target as Element | null)?.closest?.('a[href^="#"]') as HTMLAnchorElement | null;
      if (!a || a.getAttribute('href') === location.hash) return;
      ev.preventDefault();
      ev.stopPropagation();
      const destino = a.getAttribute('href')!;
      void descartar().then((ok) => {
        if (!ok) return;
        cambiado = false;
        location.hash = destino;
      });
    };
    document.addEventListener('click', alClic, true);
    return () => {
      quitarGuarda();
      document.removeEventListener('click', alClic, true);
    };
  });

  // (seguirEnRuta: it is also the guard of route changes — review 10h: it stays open if «Atrás» is pressed again)
  const descartar = () => confirmar({ titulo: '¿Descartar los cambios?', mensaje: 'Lo que ha cambiado desde la última vez que guardó se perderá.', aceptar: 'Descartar', seguirEnRuta: true });

  /** An attempt at this exam is in progress on this device (review 10c: the editor says what an edit does to it). */
  const enCurso = $derived(id && tipo === 'examen' && listo ? leerBorrador(id) : null);
  let fallo = $state('');

  const clave = (e: ElementoCurso) => (e.k === 'seccion' ? `seccion:${e.parte}/${e.label}` : e.k === 'ejercicio' ? `ejercicio:${e.label}` : `pregunta:${e.id}`);
  const elegidos = $derived(new Set(tipo === 'curso' ? elementos.map(clave) : items.map((i) => `${i.k}:${i.ref}`)));
  const total = $derived(items.reduce((a, i) => a + (Number(i.puntos) || 0), 0));

  function anadir(e: EntradaBanco) {
    cambiado = true;
    if (tipo === 'curso') elementos.push(e.k === 'ejercicio' ? { k: 'ejercicio', label: e.ref } : { k: 'pregunta', id: e.ref });
    else items.push({ k: e.k, ref: e.ref, puntos: puntosPorDefecto(e) });
    aviso = `Añadido: ${nombreDe(e.k, e.ref)}.`;
  }
  function anadirSeccion(parte: string, label: string) {
    cambiado = true;
    elementos.push({ k: 'seccion', parte, label });
    const s = app.indice?.partes[parte]?.secciones?.find((x) => x.label === label);
    aviso = `Añadida la sección ${s?.num ?? ''}.`;
  }
  function azar() {
    const nuevos = elegirPorFiltros(banco, filtros, nuevaSemilla(), elegidos);
    items.push(...nuevos);
    cambiado = true;
    aviso = nuevos.length ? `Añadidos ${nuevos.length} al azar.` : 'No queda nada más con estos filtros.';
  }

  function mover<T>(l: T[], i: number, d: number) {
    const j = i + d;
    if (j < 0 || j >= l.length) return;
    [l[i], l[j]] = [l[j]!, l[i]!];
    cambiado = true;
    queueMicrotask(() => document.getElementById(`mover-${j}-${d < 0 ? 'sube' : 'baja'}`)?.focus());
  }
  function quitar<T>(l: T[], i: number) {
    l.splice(i, 1);
    cambiado = true;
  }

  function nombreDe(k: 'ejercicio' | 'pregunta', ref: string): string {
    const e = entradaDe(banco, k, ref);
    if (!e) return `${ref} (ya no está en el libro)`;
    if (e.tipo === 'pregunta') return `Pregunta de test ${e.num} · ${rotuloParte(e.parte)}`;
    return `${e.tipo === 'problema' ? 'Problema' : 'Ejercicio'} ${e.num}`;
  }
  function nombreElemento(el: ElementoCurso): string {
    if (el.k === 'seccion') {
      const s = app.indice?.partes[el.parte]?.secciones?.find((x) => x.label === el.label);
      return `Sección ${s?.num ?? el.label} · ${s?.titulo ?? ''}`;
    }
    return el.k === 'ejercicio' ? nombreDe('ejercicio', el.label) : nombreDe('pregunta', el.id);
  }
  const resumenDe = (k: 'ejercicio' | 'pregunta', ref: string) => {
    const r = entradaDe(banco, k, ref)?.resumen ?? '';
    return r.length > 120 ? `${r.slice(0, 117).trimEnd()}…` : r;
  };

  async function guardar(ev: Event) {
    ev.preventDefault();
    if (guardando) return;
    guardando = true;
    fallo = '';
    try {
      const t = titulo.trim() || (tipo === 'curso' ? 'Curso sin título' : 'Examen sin título');
      const n = notas.trim();
      let destino = id;
      let r: 'guardado' | 'igual' | 'borrado' = 'guardado';
      if (tipo === 'curso') {
        const curso = { elementos: $state.snapshot(elementos) as ElementoCurso[] };
        if (id) r = await actualizarPropio(id, { titulo: t, notas: n, curso });
        if (!id || (r === 'borrado' && (await comoNuevo()))) destino = await crearCurso(t, n, curso);
        else if (r === 'borrado') return;
      } else {
        const examen = {
          items: ($state.snapshot(items) as ItemExamen[]).map((i) => ({ ...i, puntos: Math.max(0, Math.round((Number(i.puntos) || 0) * 100) / 100) })),
          minutos: Math.max(0, Math.round(Number(minutos) || 0)),
          variantes,
          barajar,
          semilla,
          espacio,
          filtros: $state.snapshot(filtros) as FiltrosExamen,
        };
        if (id) r = await actualizarPropio(id, { titulo: t, notas: n, examen });
        if (!id || (r === 'borrado' && (await comoNuevo()))) destino = await crearExamen(t, n, examen);
        else if (r === 'borrado') return;
      }
      cambiado = false;
      location.hash = `#/docente/${tipo}/${destino}`;
    } catch (e) {
      // (review 10c: a failed write is said, and the page stays with its changes; nothing is taken as saved)
      fallo = `No se ha podido guardar en este dispositivo (${e instanceof Error ? e.message : String(e)}). Sus cambios siguen en esta página: pulse «Guardar» otra vez.`;
    } finally {
      guardando = false;
    }
  }

  /** It was deleted meanwhile (here or on another device): keep it as a new one, or stay on the page. */
  async function comoNuevo(): Promise<boolean> {
    const ok = await confirmar({
      titulo: tipo === 'curso' ? 'Este curso se ha borrado' : 'Este examen se ha borrado',
      mensaje: 'Se borró mientras lo editaba (quizá en otro dispositivo). ¿Lo guarda como uno nuevo con lo que hay en esta página?',
      aceptar: 'Guardar como nuevo',
    });
    if (!ok) fallo = 'No se ha guardado: se había borrado. Sus cambios siguen en esta página.';
    return ok;
  }

  async function cancelar() {
    if (cambiado && !(await descartar())) return;
    cambiado = false;
    location.hash = id ? `#/docente/${tipo}/${id}` : '#/docente';
  }
</script>

<div class="editor" data-editor={tipo}>
  <p class="volver"><a class="enlace toque-44" href="#/docente">← Modo docente</a></p>
  <h1>{id ? (tipo === 'curso' ? 'Editar el curso' : 'Editar el examen') : tipo === 'curso' ? 'Nuevo curso' : 'Nuevo examen'}</h1>
  {#if error}
    <p class="aviso" role="alert">{error}</p>
  {:else if !listo || docente.error === 'lectura'}
    <p class="cargando">Cargando los ejercicios y las preguntas del libro…</p>
  {:else}
    <form onsubmit={guardar}>
      <label class="campo">
        <span>Título</span>
        <input class="dc-entrada" bind:value={titulo} oninput={() => (cambiado = true)} maxlength="120" placeholder={tipo === 'curso' ? 'Por ejemplo: Diodos y rectificadores' : 'Por ejemplo: Examen del tema 5'} data-titulo />
      </label>
      <label class="campo">
        <span>Notas {tipo === 'examen' ? '(instrucciones que se imprimen en el examen)' : '(para quien siga el curso)'}</span>
        <textarea class="dc-entrada" rows="3" bind:value={notas} oninput={() => (cambiado = true)} maxlength="2000" data-notas></textarea>
      </label>

      {#if enCurso}
        <p class="aviso" role="status" data-intento-en-curso>
          Hay un intento de este examen sin entregar en este dispositivo: seguirá con las preguntas con las que se empezó. Lo que cambie aquí valdrá para el próximo intento.
        </p>
      {/if}
      {#if tipo === 'examen'}
        <fieldset class="ajustes">
          <legend>Ajustes</legend>
          <label class="campo corto">
            <span>Tiempo total (minutos; 0 sin límite)</span>
            <input class="dc-entrada" type="number" min="0" max="600" bind:value={minutos} oninput={() => (cambiado = true)} data-minutos />
          </label>
          <label class="campo corto">
            <span>Espacio para responder en el PDF</span>
            <select class="dc-entrada" bind:value={espacio} onchange={() => (cambiado = true)} data-espacio>
              <option value="no">Sin espacio</option>
              <option value="corto">Unas líneas</option>
              <option value="largo">Media página</option>
            </select>
          </label>
          <label class="casilla"><input type="checkbox" bind:checked={variantes} onchange={() => (cambiado = true)} data-variantes /> Variantes con otros valores (en los ejercicios que lo permiten)</label>
          <label class="casilla"><input type="checkbox" bind:checked={barajar} onchange={() => (cambiado = true)} data-barajar /> Barajar el orden de las preguntas y de las opciones</label>
          <button
            type="button"
            class="t09-boton t09-contorno"
            onclick={() => {
              semilla = nuevaSemilla();
              cambiado = true;
              aviso = 'Las variantes serán otras al guardar.';
            }}
            data-nuevas-variantes
          >
            <RefreshCw size={16} aria-hidden="true" /> Generar otras variantes
          </button>
        </fieldset>
      {/if}

      <section aria-labelledby="h-elegidos">
        <h2 id="h-elegidos">
          {tipo === 'curso' ? `Contenido del curso (${elementos.length})` : `Preguntas del examen (${items.length}) · ${textoPuntos(total)} puntos`}
        </h2>
        {#if (tipo === 'curso' ? elementos.length : items.length) === 0}
          <p class="vacio">Aún está vacío: añada {tipo === 'curso' ? 'secciones, ejercicios o preguntas' : 'ejercicios, problemas o preguntas'} con el buscador de abajo.</p>
        {/if}
        <ol class="elegidos">
          {#if tipo === 'curso'}
            {#each elementos as el, i (clave(el))}
              <li data-elegido={clave(el)}>
                <span class="n">{i + 1}.</span>
                <span class="nom">{nombreElemento(el)}</span>
                <span class="mover">
                  <button type="button" id={`mover-${i}-sube`} class="icono" disabled={i === 0} onclick={() => mover(elementos, i, -1)} aria-label={`Subir ${nombreElemento(el)}`}><ArrowUp size={18} aria-hidden="true" /></button>
                  <button type="button" id={`mover-${i}-baja`} class="icono" disabled={i === elementos.length - 1} onclick={() => mover(elementos, i, 1)} aria-label={`Bajar ${nombreElemento(el)}`}><ArrowDown size={18} aria-hidden="true" /></button>
                  <button type="button" class="icono" onclick={() => quitar(elementos, i)} aria-label={`Quitar ${nombreElemento(el)}`}><X size={18} aria-hidden="true" /></button>
                </span>
              </li>
            {/each}
          {:else}
            {#each items as it, i (`${it.k}:${it.ref}`)}
              <li data-elegido={`${it.k}:${it.ref}`}>
                <span class="n">{i + 1}.</span>
                <span class="nom">{nombreDe(it.k, it.ref)}<span class="res">{resumenDe(it.k, it.ref)}</span></span>
                <label class="puntos">
                  <span>Puntos</span>
                  <input class="dc-entrada" type="number" min="0" max="100" step="0.25" bind:value={it.puntos} oninput={() => (cambiado = true)} data-puntos />
                </label>
                <span class="mover">
                  <button type="button" id={`mover-${i}-sube`} class="icono" disabled={i === 0} onclick={() => mover(items, i, -1)} aria-label={`Subir ${nombreDe(it.k, it.ref)}`}><ArrowUp size={18} aria-hidden="true" /></button>
                  <button type="button" id={`mover-${i}-baja`} class="icono" disabled={i === items.length - 1} onclick={() => mover(items, i, 1)} aria-label={`Bajar ${nombreDe(it.k, it.ref)}`}><ArrowDown size={18} aria-hidden="true" /></button>
                  <button type="button" class="icono" onclick={() => quitar(items, i)} aria-label={`Quitar ${nombreDe(it.k, it.ref)}`}><X size={18} aria-hidden="true" /></button>
                </span>
              </li>
            {/each}
          {/if}
        </ol>
        <p class="solo-lector" aria-live="polite">{aviso}</p>
      </section>

      {#if fallo}<p class="aviso" role="alert" data-fallo-guardar>{fallo}</p>{/if}
      <div class="botones">
        <button type="submit" class="t09-boton" disabled={guardando} data-guardar>Guardar</button>
        <button type="button" class="t09-boton t09-contorno" onclick={() => void cancelar()}>Cancelar</button>
      </div>

    </form>
    <!-- outside the form: Intro in the search box must not save -->
    <section aria-labelledby="h-buscar" class="buscar">
      <h2 id="h-buscar">Añadir del libro</h2>
      <Selector {banco} modo={tipo} {elegidos} bind:filtros onanadir={anadir} onseccion={anadirSeccion} onazar={azar} />
    </section>
  {/if}
</div>

<style>
  .editor {
    display: flex;
    flex-direction: column;
    gap: 14px;
    max-width: 920px;
    margin: 0 auto;
    padding: 24px 32px 64px;
    font-family: var(--sans);
  }
  @media (max-width: 600px) {
    .editor {
      padding: 12px 16px 48px;
    }
  }
  .volver {
    margin: 0;
  }
  h1 {
    margin: 0;
    color: var(--titulos);
    font-family: var(--titular);
    font-size: 28px;
  }
  h2 {
    margin: 18px 0 8px;
    color: var(--titulos);
    font-size: 18px;
  }
  form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .campo {
    display: flex;
    flex-direction: column;
    gap: 4px;
    color: var(--tinta-suave);
    font-size: 13.5px;
    font-weight: 600;
  }
  .campo input,
  .campo select {
    min-height: 44px;
  }
  textarea {
    font: inherit;
    resize: vertical;
  }
  .ajustes {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 10px 16px;
    margin: 0;
    padding: 12px 14px;
    border: 1px solid var(--linea);
    border-radius: 14px;
  }
  .ajustes legend {
    padding: 0 4px;
    color: var(--titulos);
    font-weight: 700;
  }
  .campo.corto {
    flex: 1 1 220px;
  }
  .casilla {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    flex-basis: 100%;
    color: var(--tinta);
    font-size: 14.5px;
  }
  .casilla input {
    width: 20px;
    height: 20px;
    accent-color: var(--acento);
  }
  .elegidos {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .elegidos li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border: 1px solid var(--linea);
    border-radius: 12px;
    background: var(--superficie);
  }
  .n {
    min-width: 2em;
    color: var(--tinta-suave);
    font-weight: 700;
  }
  .nom {
    display: flex;
    flex: 1 1 200px;
    flex-direction: column;
    color: var(--titulos);
    font-size: 14.5px;
    font-weight: 700;
  }
  .res {
    color: var(--tinta-suave);
    font-size: 13px;
    font-weight: 400;
  }
  .puntos {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--tinta-suave);
    font-size: 13px;
  }
  .puntos input {
    width: 5.5em;
    min-height: 44px;
  }
  .mover {
    display: flex;
    gap: 2px;
  }
  .icono {
    display: grid;
    width: 44px;
    height: 44px;
    place-items: center;
    border: 1px solid var(--linea);
    border-radius: 10px;
    background: var(--fondo);
    color: var(--tinta);
  }
  .icono:disabled {
    opacity: 0.4;
  }
  .botones {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .t09-boton {
    min-height: 44px;
  }
  .vacio,
  .cargando {
    color: var(--tinta-suave);
  }
  .aviso {
    padding: 12px 14px;
    border: 1px solid var(--linea);
    border-radius: 12px;
  }
</style>
