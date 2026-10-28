<script lang="ts">
  // «Protoboard», a tab of the simulator: own circuits built from an empty breadboard (#/protoboard: the
  // working board of this device; #/protoboard/<id>: a saved one, saved by itself on every change). The
  // saved ones are «Mis montajes», synchronised like the editor's circuits.
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
    renombrarMontaje,
  } from './circuitos.svelte';
  import type { DocumentoProtoboard } from './tipos.ts';

  let { ruta }: { ruta: string } = $props();

  const pb = new EstadoProtoboard();
  let idGuardado = $state<string | null>(null);
  let estadoGuardado = $state<'guardado' | 'guardando'>('guardado');
  let verLista = $state(false);
  let errorCarga = $state('');
  let listo = $state(false);

  async function abrir(r: string) {
    await cargarMontajes();
    const id = r.split('/')[1] ?? '';
    if (id) {
      const m = montaje(id);
      if (m) {
        pb.cargar(JSON.parse(JSON.stringify(m.doc)) as DocumentoProtoboard, false);
        idGuardado = id;
      } else {
        errorCarga = 'Ese montaje no existe en este dispositivo (quizá se borró).';
        pb.cargar(montajeVacio(), false);
        idGuardado = null;
      }
    } else {
      pb.cargar(leerBorradorMontaje() ?? montajeVacio(), false);
      idGuardado = null;
    }
    listo = true;
  }

  $effect(() => {
    const r = ruta;
    untrack(() => void abrir(r));
  });

  // Saved boards save themselves; the working board is a draft of this device.
  let pausa: ReturnType<typeof setTimeout> | null = null;
  $effect(() => {
    void pb.version;
    if (!listo) return;
    untrack(() => {
      if (pausa) clearTimeout(pausa);
      pausa = setTimeout(() => {
        pausa = null;
        const doc = $state.snapshot(pb.doc) as DocumentoProtoboard;
        if (idGuardado) {
          estadoGuardado = 'guardando';
          void actualizarMontaje(idGuardado, doc).then(() => (estadoGuardado = 'guardado'));
        } else escribirBorradorMontaje(doc);
      }, 500);
    });
  });
  onDestroy(() => {
    if (pausa) clearTimeout(pausa);
  });
  onMount(() => void cargarMontajes());

  async function guardar() {
    const nombre = pb.doc.titulo.trim() || 'Montaje nuevo';
    const id = await guardarMontaje(nombre, $state.snapshot(pb.doc) as DocumentoProtoboard);
    escribirBorradorMontaje(null);
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
  {#if errorCarga}<p class="aviso" role="alert">{errorCarga}</p>{/if}
  <div class="marco">
    {#if listo}
      <Protoboard {pb}>
        {#snippet cabecera()}
          <header class="cab">
            <div class="tit">
              <h1>{pb.doc.titulo || 'Montaje nuevo'}</h1>
              <span class="estado">{#if idGuardado}{estadoGuardado === 'guardando' ? 'Guardando…' : 'Guardado en este dispositivo'}{:else}Sin guardar (se conserva en este dispositivo){/if}</span>
            </div>
            {#if !idGuardado}<button type="button" class="boton primario" onclick={guardar}>Guardar</button>{/if}
            <button type="button" class="boton" aria-expanded={verLista} onclick={() => (verLista = !verLista)}>Mis montajes</button>
            <button type="button" class="boton" onclick={nuevo}>Nuevo</button>
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
                      <a href={`#/protoboard/${m.id}`} onclick={() => (verLista = false)}>{m.nombre}</a>
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
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--superficie);
    border-bottom: 1px solid var(--linea-suave);
  }
  .tit {
    flex: 1 1 12em;
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
    color: var(--tinta-tenue);
    font-size: 12.5px;
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
    flex: 1 1 10em;
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
</style>
