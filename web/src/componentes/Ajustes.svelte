<script lang="ts">
  import { onMount } from 'svelte';
  import { app } from '../lib/estado.svelte';
  import { usuario, ponerTema, ponerTam, TAM_MAX, TAM_MIN, TAM_DEFECTO, type Tema } from '../lib/usuario.svelte';
  import Icono, { type NombreIcono } from './Icono.svelte';

  let { ancla }: { ancla: HTMLElement | undefined } = $props();
  let panel: HTMLDivElement | undefined = $state();

  const TEMAS: { id: Tema; nombre: string; icono: NombreIcono }[] = [
    { id: 'auto', nombre: 'Sistema', icono: 'sistema' },
    { id: 'claro', nombre: 'Claro', icono: 'sol' },
    { id: 'sepia', nombre: 'Sepia', icono: 'sepia' },
    { id: 'oscuro', nombre: 'Oscuro', icono: 'luna' },
  ];

  function cerrar() {
    app.ajustes = false;
  }

  onMount(() => {
    const fuera = (ev: PointerEvent) => {
      const t = ev.target as Node;
      if (panel?.contains(t) || ancla?.contains(t)) return;
      cerrar();
    };
    const tecla = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        cerrar();
        ancla?.focus();
      }
    };
    document.addEventListener('pointerdown', fuera, true);
    document.addEventListener('keydown', tecla);
    panel?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
    return () => {
      document.removeEventListener('pointerdown', fuera, true);
      document.removeEventListener('keydown', tecla);
    };
  });
</script>

<div class="ajustes" role="dialog" aria-label="Tema y tamaño de letra" bind:this={panel}>
  <div class="grupo">
    <span class="etiqueta" id="et-tema">Tema</span>
    <div class="temas" role="radiogroup" aria-labelledby="et-tema">
      {#each TEMAS as t (t.id)}
        <button
          role="radio"
          aria-checked={usuario.prefs.tema === t.id}
          class="tema t-{t.id}"
          onclick={() => ponerTema(t.id)}
        >
          <span class="muestra"><Icono nombre={t.icono} tam={18} /></span>
          <span>{t.nombre}</span>
        </button>
      {/each}
    </div>
  </div>

  <div class="grupo">
    <span class="etiqueta" id="et-tam">Tamaño del texto</span>
    <div class="tam" aria-labelledby="et-tam">
      <button
        class="boton-icono"
        aria-label="Letra más pequeña"
        disabled={usuario.prefs.tam <= TAM_MIN}
        onclick={() => ponerTam(usuario.prefs.tam - 1)}><Icono nombre="letra-menos" tam={20} /></button
      >
      <input
        type="range"
        min={TAM_MIN}
        max={TAM_MAX}
        step="1"
        value={usuario.prefs.tam}
        aria-label="Tamaño del texto en píxeles"
        oninput={(e) => ponerTam(Number(e.currentTarget.value))}
      />
      <button
        class="boton-icono"
        aria-label="Letra más grande"
        disabled={usuario.prefs.tam >= TAM_MAX}
        onclick={() => ponerTam(usuario.prefs.tam + 1)}><Icono nombre="letra-mas" tam={20} /></button
      >
    </div>
    <div class="prueba">
      <span>Aa — {usuario.prefs.tam} px</span>
      {#if usuario.prefs.tam !== TAM_DEFECTO}
        <button class="enlace" onclick={() => ponerTam(TAM_DEFECTO)}>Restablecer</button>
      {/if}
    </div>
  </div>

  <p class="pie">
    {#if app.modo === 'muestra'}
      <strong>Contenido de muestra.</strong> Genere el libro con <code>python3 contenido/generar.py</code>.
    {:else}
      Datos personales guardados {usuario.almacen === 'tauri' ? 'en la aplicación' : 'en este navegador'}.
    {/if}
  </p>
</div>

<style>
  .ajustes {
    position: fixed;
    top: calc(var(--alto-barra) + env(safe-area-inset-top) + 6px);
    right: 10px;
    z-index: 40;
    width: min(340px, calc(100vw - 20px));
    padding: 14px 16px 12px;
    border: 1px solid var(--linea);
    border-radius: 14px;
    background: var(--superficie);
    box-shadow: var(--sombra-alta);
    font-family: var(--sans);
    animation: entrar 0.14s ease-out;
  }
  @keyframes entrar {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
  }
  .grupo + .grupo {
    margin-top: 16px;
  }
  .etiqueta {
    display: block;
    margin-bottom: 8px;
    color: var(--tinta-tenue);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .temas {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }
  .tema {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    padding: 8px 2px 7px;
    border: 1.5px solid var(--linea);
    border-radius: 10px;
    background: none;
    color: var(--tinta-suave);
    font-size: 13px;
  }
  .tema[aria-checked='true'] {
    border-color: var(--acento);
    color: var(--tinta);
    font-weight: 600;
  }
  .muestra {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border: 1px solid rgba(0, 0, 0, 0.12);
    border-radius: 50%;
  }
  .t-auto .muestra {
    background: linear-gradient(135deg, #fcfbf8 50%, #16191d 50%);
    color: #8a96a3;
  }
  .t-claro .muestra {
    background: #fcfbf8;
    color: #1a3a5c;
  }
  .t-sepia .muestra {
    background: #f5ecd9;
    color: #6b5d4c;
  }
  .t-oscuro .muestra {
    background: #16191d;
    color: #c9d7e8;
  }
  .tam {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .tam input {
    flex: 1;
    accent-color: var(--acento);
  }
  .prueba {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-top: 4px;
    color: var(--tinta-suave);
    font-family: var(--serif);
    font-size: 15px;
  }
  .enlace {
    border: 0;
    background: none;
    color: var(--acento);
    font-family: var(--sans);
    font-size: 13.5px;
    font-weight: 600;
  }
  .pie {
    margin: 14px 0 0;
    padding-top: 10px;
    border-top: 1px solid var(--linea-suave);
    color: var(--tinta-tenue);
    font-size: 12.5px;
    line-height: 1.4;
  }
  .pie code {
    font-family: var(--mono);
    font-size: 0.92em;
  }
  .boton-icono:disabled {
    opacity: 0.35;
    cursor: default;
  }
</style>
