<script lang="ts">
  // «Protoboard», a tab of the simulator: own circuits built from an empty breadboard (#/protoboard: the
  // working board of this device; #/protoboard/<id>: a saved one, saved by itself on every change). The
  // saved ones are «Mis montajes», synchronised like the editor's circuits. A guided circuit («Monta este
  // circuito») is a sandbox: it never writes over the montage or the draft it replaced; when it ends keeping its
  // board, «Guardar» makes it a new montage and «Seguir con esta placa» goes on with it as the draft (a saved montage
  // stays as it was; a draft with own work is first kept in «Mis montajes»).
  import { onDestroy, onMount, untrack } from 'svelte';
  import PestanasSimulador from '../simulador/PestanasSimulador.svelte';
  import Protoboard from './Protoboard.svelte';
  import { Protoboard as EstadoProtoboard, montajeVacio } from './estado.svelte';
  import {
    actualizarMontaje,
    borrarMontaje,
    cargarMontajes,
    escribirBorradorMontaje,
    guardarMontaje,
    leerBorradorMontaje,
    listaMontajes,
    montaje,
    montajes,
    reintentarMontajes,
    renombrarMontaje,
  } from './circuitos.svelte';
  import AvisoGuardado from '../AvisoGuardado.svelte';
  import type { DocumentoProtoboard } from './tipos.ts';
  import { miniaturaMontaje } from './miniatura';
  import MiniaturaFigura from '../miniaturas/MiniaturaFigura.svelte';

  let { ruta }: { ruta: string } = $props();

  const pb = new EstadoProtoboard();
  let idGuardado = $state<string | null>(null);
  let estadoGuardado = $state<'guardado' | 'guardando'>('guardado');
  let verLista = $state(false);
  let errorCarga = $state('');
  /** A short notice (what was kept in «Mis montajes» when a guide replaced the draft). */
  let aviso = $state('');
  let listo = $state(false);
  /** The board last written (or opened): an unchanged board is not written again. */
  let ultimo = '';
  /** Autosave held while the page moves to another board after a guide (until it is open). */
  let retenido = false;

  async function abrir(r: string) {
    await cargarMontajes();
    const id = r.split('/')[1] ?? '';
    if (id) {
      const m = montaje(id);
      if (m) {
        pb.cargar(JSON.parse(JSON.stringify(m.doc)) as DocumentoProtoboard, false);
        idGuardado = id;
      } else {
        errorCarga =
          montajes.error === 'lectura'
            ? 'No se pudo leer «Mis montajes» en este dispositivo, así que este montaje no se puede abrir ahora.'
            : 'Ese montaje no existe en este dispositivo (quizá se borró).';
        pb.cargar(montajeVacio(), false);
        idGuardado = null;
      }
    } else {
      pb.cargar(leerBorradorMontaje() ?? montajeVacio(), false);
      idGuardado = null;
    }
    ultimo = JSON.stringify($state.snapshot(pb.doc));
    retenido = false;
    listo = true;
  }

  $effect(() => {
    const r = ruta;
    untrack(() => void abrir(r));
  });

  // Saved boards save themselves; the working board is a draft of this device.
  let pausa: ReturnType<typeof setTimeout> | null = null;

  function escribirPlaca(doc: DocumentoProtoboard) {
    const texto = JSON.stringify(doc);
    if (texto === ultimo) return;
    ultimo = texto;
    if (idGuardado) {
      estadoGuardado = 'guardando';
      void actualizarMontaje(idGuardado, doc).then(() => (estadoGuardado = 'guardado'));
    } else escribirBorradorMontaje(doc);
  }

  $effect(() => {
    void pb.version;
    const sandbox = !!pb.guia || !!pb.leccion;
    if (!listo) return;
    untrack(() => {
      // A guided circuit (or the lesson before it) is a sandbox: the own board is not touched until it ends. A change
      // still waiting to be written when it started is written now — the board before the guide, not the guide's.
      if (sandbox || retenido) {
        if (pausa) {
          clearTimeout(pausa);
          pausa = null;
          const antes = pb.guia?.anterior ?? pb.leccion?.anterior;
          if (antes && !retenido) escribirPlaca(JSON.parse(JSON.stringify(antes)) as DocumentoProtoboard);
        }
        return;
      }
      if (pausa) clearTimeout(pausa);
      pausa = setTimeout(() => {
        pausa = null;
        escribirPlaca($state.snapshot(pb.doc) as DocumentoProtoboard);
      }, 500);
    });
  });

  /** The board has own work (anything beyond an empty board's supply and its wires). */
  function conTrabajo(d: DocumentoProtoboard): boolean {
    const v = montajeVacio();
    return JSON.stringify([d.piezas, d.cables]) !== JSON.stringify([v.piezas, v.cables]);
  }

  /** Keeps a board that a guide's «Seguir con esta placa» replaces as the draft, in «Mis montajes». */
  async function conservar(d: DocumentoProtoboard) {
    const nombre = `${d.titulo?.trim() || 'Montaje sin guardar'} (antes de la guía)`;
    await guardarMontaje(nombre, d);
    aviso = montajes.error
      ? `Su montaje anterior está en «Mis montajes» como «${nombre}», pero aún no se ha guardado en este dispositivo.`
      : `Su montaje anterior se ha guardado en «Mis montajes» como «${nombre}».`;
    setTimeout(() => (aviso = ''), 10_000);
  }

  /**
   * A guide ends keeping its board (Guia.svelte; called before the guide closes): «Guardar» (alGuardar follows) makes
   * it a new montage and leaves the montage or draft it replaced as they were; «Seguir con esta placa» goes on with it
   * as this device's draft — a saved montage keeps its own board, a draft with own work is kept in «Mis montajes».
   */
  function alQuedarse(anterior: DocumentoProtoboard, guardarla: boolean) {
    if (pausa) {
      clearTimeout(pausa);
      pausa = null;
    }
    if (guardarla) {
      retenido = true;
      return;
    }
    const placa = JSON.parse(JSON.stringify($state.snapshot(pb.doc))) as DocumentoProtoboard;
    if (idGuardado) {
      const borrador = leerBorradorMontaje();
      if (borrador && conTrabajo(borrador)) void conservar(borrador);
      escribirBorradorMontaje(placa);
      ultimo = JSON.stringify(placa);
      idGuardado = null;
      retenido = true;
      location.hash = '#/protoboard';
    } else if (conTrabajo(anterior) && JSON.stringify(anterior) !== JSON.stringify(placa)) {
      void conservar(JSON.parse(JSON.stringify(anterior)) as DocumentoProtoboard);
    }
  }
  onDestroy(() => {
    if (pausa) clearTimeout(pausa);
  });
  onMount(() => void cargarMontajes());

  /** «Reintentar» of the library's notice; a montage that could not be opened for it is opened again. */
  async function reintentarAbrir() {
    await reintentarMontajes();
    if (errorCarga && !montajes.error) {
      errorCarga = '';
      await abrir(ruta);
    }
  }

  /** Saves the board as a new montage; `desdeGuia`: a guide's board, so the draft (the board it replaced) stays. */
  async function guardar(desdeGuia = false) {
    const nombre = pb.doc.titulo.trim() || 'Montaje nuevo';
    const id = await guardarMontaje(nombre, $state.snapshot(pb.doc) as DocumentoProtoboard);
    // a save that failed keeps the draft (the board is only in this page until a write succeeds)
    if (!desdeGuia && !montajes.error) escribirBorradorMontaje(null);
    location.hash = `#/protoboard/${id}`;
  }

  function nuevo() {
    escribirBorradorMontaje(null);
    if (idGuardado) location.hash = '#/protoboard';
    else pb.cargar(montajeVacio(), false);
  }

  let editando = $state<string | null>(null);
  let nombreNuevo = $state('');
  async function renombrar(id: string) {
    const n = nombreNuevo.trim();
    editando = null;
    if (!n) return;
    await renombrarMontaje(id, n);
    if (id === idGuardado) pb.doc.titulo = n;
  }

  async function quitar(id: string, nombre: string) {
    if (!confirm(`¿Borrar «${nombre}»?`)) return;
    await borrarMontaje(id);
    if (id === idGuardado) location.hash = '#/protoboard';
  }
</script>

<svelte:head><title>Protoboard · Electrónica Práctica Avanzada</title></svelte:head>

<div class="pagina-protoboard">
  <PestanasSimulador />
  <div class="avisos-guardado"><AvisoGuardado error={montajes.error} nombre="Mis montajes" reintentar={reintentarAbrir} /></div>
  {#if errorCarga}<p class="aviso" role="alert">{errorCarga}</p>{/if}
  {#if aviso}<p class="aviso info" role="status" data-aviso-montaje>{aviso}</p>{/if}
  <div class="marco">
    {#if listo}
      <Protoboard {pb} recorrido alGuardar={() => void guardar(true)} {alQuedarse}>
        {#snippet cabecera()}
          <header class="cab">
            <div class="tit">
              <h1>{pb.doc.titulo || 'Montaje nuevo'}</h1>
              <span class="estado">{#if idGuardado}{montajes.error ? 'Sin guardar en este dispositivo' : estadoGuardado === 'guardando' ? 'Guardando…' : 'Guardado en este dispositivo'}{:else}Sin guardar (se conserva en este dispositivo){/if}</span>
            </div>
            {#if !idGuardado}<button type="button" class="boton primario" onclick={() => void guardar()} disabled={!!pb.guia || !!pb.leccion}>Guardar</button>{/if}
            <button type="button" class="boton" aria-expanded={verLista} onclick={() => (verLista = !verLista)}><span class="largo">Mis montajes</span><span class="corto">Montajes</span></button>
            <button type="button" class="boton" onclick={nuevo} disabled={!!pb.guia || !!pb.leccion}>Nuevo</button>
          </header>
          {#if verLista}
            <section class="lista" aria-label="Mis montajes">
              {#if !montajes.listo}<p class="nota">Cargando…</p>{:else if !listaMontajes().length}<p class="nota">Todavía no hay montajes guardados. «Guardar» guarda el actual; desde «Ver en protoboard» de cualquier esquema también se puede guardar una copia.</p>{/if}
              <ul>
                {#each listaMontajes() as m (m.id)}
                  <li class:actual={m.id === idGuardado}>
                    {#if editando === m.id}
                      <input class="nombre" type="text" aria-label="Nuevo nombre" bind:value={nombreNuevo} onkeydown={(e) => { if (e.key === 'Enter') void renombrar(m.id); if (e.key === 'Escape') editando = null; }} />
                      <button type="button" class="enlace" onclick={() => renombrar(m.id)}>Aceptar</button>
                    {:else}
                      <a href={`#/protoboard/${m.id}`} onclick={() => (verLista = false)}><MiniaturaFigura src={miniaturaMontaje(m)} icono="esquema" /><span>{m.nombre}</span></a>
                      <span class="fecha">{new Date(m.actualizado).toLocaleDateString('es-ES')}</span>
                      <button type="button" class="enlace" onclick={() => { editando = m.id; nombreNuevo = m.nombre; }}>Renombrar</button>
                    {/if}
                    <button type="button" class="enlace peligro" onclick={() => quitar(m.id, m.nombre)}>Borrar</button>
                  </li>
                {/each}
              </ul>
            </section>
          {/if}
        {/snippet}
      </Protoboard>
    {/if}
  </div>
</div>

<style>
  .pagina-protoboard {
    display: flex;
    flex-direction: column;
    font-family: var(--sans);
  }
  .marco {
    height: calc(100dvh - var(--alto-barra) - var(--hueco-inferior) - 48px);
    min-height: 560px;
  }
  .cab {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: var(--superficie);
    border-bottom: 1px solid var(--linea-suave);
  }
  .tit {
    flex: 1 1 auto;
    min-width: 0;
  }
  h1 {
    margin: 0;
    overflow: hidden;
    color: var(--titulos);
    font-size: 18px;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .estado {
    display: block;
    overflow: hidden;
    color: var(--tinta-tenue);
    font-size: 12.5px;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .cab .boton {
    flex: none;
    min-height: 44px;
    padding: 0 12px;
  }
  .corto {
    display: none;
  }
  @media (max-width: 520px) {
    .largo {
      display: none;
    }
    .corto {
      display: inline;
    }
    .cab .boton {
      padding: 0 10px;
      font-size: 13.5px;
    }
    h1 {
      font-size: 16px;
    }
  }
  .lista {
    max-height: 40vh;
    overflow: auto;
    padding: 6px 12px 10px;
    border-bottom: 1px solid var(--linea);
    background: var(--superficie);
  }
  .lista ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .lista li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 12px;
    padding: 8px 0;
    border-bottom: 1px solid var(--linea-suave);
  }
  .lista li.actual a {
    font-weight: 700;
  }
  .lista a {
    /* A small drawing of the board with its parts (fixed size: list thumbnails, componentes/miniaturas). */
    --mini-w: 84px;
    --mini-h: 52px;
    --mini-radio: 8px;
    flex: 1 1 10em;
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }
  .nombre {
    flex: 1 1 10em;
    min-height: 36px;
    padding: 0 8px;
    border: 1px solid var(--linea);
    border-radius: 8px;
    background: var(--fondo);
    font: inherit;
  }
  .fecha {
    color: var(--tinta-tenue);
    font-size: 13px;
  }
  .enlace {
    min-height: 32px;
    padding: 0 4px;
    border: 0;
    background: none;
    color: var(--acento);
    font: 600 13.5px var(--sans);
  }
  .peligro {
    color: var(--c-precaucion);
  }
  .nota {
    color: var(--tinta-suave);
    font-size: 13.5px;
  }
  .aviso {
    margin: 8px 12px;
    color: var(--c-precaucion);
  }
  .avisos-guardado {
    margin: 0 12px;
  }
  .aviso.info {
    color: var(--tinta);
  }
</style>
