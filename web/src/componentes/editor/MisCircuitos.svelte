<script lang="ts">
  // «Mis circuitos»: the circuits saved on this device — open, rename, delete.
  import { biblioteca, borrar, listaCircuitos, renombrar } from './circuitos.svelte';
  import X from '@lucide/svelte/icons/x';
  import Pencil from '@lucide/svelte/icons/pencil';
  import Trash from '@lucide/svelte/icons/trash-2';

  let { cerrar, actual = null }: { cerrar: () => void; actual?: string | null } = $props();

  const lista = $derived(biblioteca.listo ? listaCircuitos() : []);
  let editando = $state<string | null>(null);
  let nombre = $state('');
  let confirmar = $state<string | null>(null);

  function fecha(ms: number): string {
    return new Date(ms).toLocaleString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function tecla(ev: KeyboardEvent) {
    if (ev.key === 'Escape') {
      ev.stopPropagation();
      cerrar();
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div class="fondo" role="presentation" onclick={(e) => e.target === e.currentTarget && cerrar()} onkeydown={tecla}>
  <div class="dialogo" role="dialog" aria-modal="true" aria-label="Mis circuitos" tabindex="-1">
    <header>
      <h2>Mis circuitos</h2>
      <button type="button" class="boton-icono" aria-label="Cerrar" onclick={cerrar}><X size={20} /></button>
    </header>
    {#if !lista.length}
      <p class="nota">Todavía no hay circuitos guardados. Pulse «Guardar» en el editor para guardar el que está dibujando.</p>
    {:else}
      <ul>
        {#each lista as c (c.id)}
          <li class:actual={c.id === actual}>
            {#if editando === c.id}
              <form
                onsubmit={(e) => {
                  e.preventDefault();
                  if (nombre.trim()) void renombrar(c.id, nombre.trim());
                  editando = null;
                }}
              >
                <!-- svelte-ignore a11y_autofocus -->
                <input type="text" bind:value={nombre} aria-label="Nuevo nombre" autofocus />
                <button class="boton" type="submit">Cambiar</button>
              </form>
            {:else}
              <a href={`#/editor/${c.id}`} onclick={cerrar}>
                <strong>{c.nombre}</strong>
                <span>{c.doc.componentes.length} elementos · {fecha(c.actualizado)}</span>
              </a>
              {#if confirmar === c.id}
                <button type="button" class="boton peligro" onclick={() => { void borrar(c.id); confirmar = null; }}>Borrar</button>
                <button type="button" class="boton" onclick={() => (confirmar = null)}>No</button>
              {:else}
                <button type="button" class="boton-icono" aria-label={`Cambiar el nombre de ${c.nombre}`} title="Cambiar el nombre" onclick={() => { editando = c.id; nombre = c.nombre; }}><Pencil size={17} /></button>
                <button type="button" class="boton-icono" aria-label={`Borrar ${c.nombre}`} title="Borrar" onclick={() => (confirmar = c.id)}><Trash size={17} /></button>
              {/if}
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</div>

<style>
  .fondo {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: grid;
    place-items: center;
    padding: 16px;
    background: var(--scrim);
  }
  .dialogo {
    width: min(560px, 100%);
    max-height: min(80vh, 640px);
    overflow: auto;
    padding: 14px 16px 18px;
    border-radius: 14px;
    background: var(--superficie);
    box-shadow: var(--sombra-alta);
    font-family: var(--sans);
    box-sizing: border-box;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  h2 {
    margin: 0;
    font-size: 19px;
    color: var(--titulos);
  }
  ul {
    list-style: none;
    margin: 8px 0 0;
    padding: 0;
    display: grid;
    gap: 4px;
  }
  li {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 4px 4px 10px;
    border-radius: 10px;
  }
  li:hover,
  li.actual {
    background: var(--superficie-2);
  }
  li a {
    flex: 1;
    min-width: 0;
    display: grid;
    gap: 1px;
    padding: 6px 0;
    color: var(--tinta);
    text-decoration: none;
  }
  li a span {
    font-size: 12.5px;
    color: var(--tinta-tenue);
  }
  li a strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  form {
    flex: 1;
    display: flex;
    gap: 6px;
  }
  form input {
    flex: 1;
    min-height: 40px;
    padding: 0 10px;
    border: 1px solid var(--linea);
    border-radius: 9px;
    background: var(--superficie);
    color: var(--tinta);
    font: 15px var(--sans);
  }
  .peligro {
    color: var(--c-precaucion);
  }
  .nota {
    color: var(--tinta-suave);
    font-size: 14px;
  }
</style>
