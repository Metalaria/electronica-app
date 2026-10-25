<script lang="ts">
  // Light wrapper of the 3D view: checks WebGL2 and fetches the 3D chunk (three.js + models) only when a 3D
  // view is actually shown. Without WebGL2 it reports the failure, so the page can fall back to 2D.
  import { onMount, type Component } from 'svelte';
  import { soporteWebGL2 } from './motor/soporte';
  import type { Montaje, Parametros } from './modelos/tipos';

  let {
    tipo,
    parametros = {},
    montaje = 'placa',
    nombre = '',
    alFallar,
    alto,
  }: {
    tipo: string;
    parametros?: Parametros;
    montaje?: Montaje;
    nombre?: string;
    alFallar?: (motivo: string) => void;
    alto?: string;
  } = $props();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let Visor: Component<any> | null = $state(null);
  let error = $state('');

  function fallo(m: string): void {
    error = m;
    alFallar?.(m);
  }

  onMount(() => {
    if (!soporteWebGL2()) {
      fallo('Este dispositivo no ofrece WebGL 2, que hace falta para la vista 3D.');
      return;
    }
    let vivo = true;
    import('./Visor3D.svelte')
      .then((m) => {
        if (vivo) Visor = m.default;
      })
      .catch((e: unknown) => fallo(e instanceof Error ? e.message : String(e)));
    return () => {
      vivo = false;
    };
  });
</script>

{#if error}
  <div class="aviso3d" role="status">{error}</div>
{:else if Visor}
  <Visor {tipo} {parametros} {montaje} {nombre} {alto} alFallar={fallo} />
{:else}
  <div class="espera" aria-live="polite">Cargando la vista 3D…</div>
{/if}

<style>
  .espera,
  .aviso3d {
    display: grid;
    place-items: center;
    aspect-ratio: 16 / 10;
    padding: 20px;
    border-radius: 14px;
    background: var(--superficie-2);
    color: var(--tinta-suave);
    font-family: var(--sans);
    text-align: center;
  }
</style>
