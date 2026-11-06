<script lang="ts">
  // Light wrapper of the 3D view: checks WebGL2 and fetches the 3D chunk (three.js + models) only when a 3D
  // view is actually shown. Without WebGL2 it reports the failure, so the page can fall back to 2D.
  import { onMount, type Component } from 'svelte';
  import { soporteWebGL2 } from './motor/soporte';
  import type { Montaje, Parametros } from './modelos/tipos';
  import { informarFallo } from '../../lib/informe-fallos';

  let {
    tipo,
    parametros = {},
    montaje = 'placa',
    nombre = '',
    alFallar,
    alListo,
    alto,
  }: {
    tipo: string;
    parametros?: Parametros;
    montaje?: Montaje;
    nombre?: string;
    alFallar?: (motivo: string) => void;
    alListo?: () => void;
    alto?: string;
  } = $props();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let Visor: Component<any> | null = $state(null);
  let error = $state('');
  /** 1.0: a failure of the viewer itself (a lost WebGL context, an error building it) can be retried. */
  let reintentable = $state(false);
  let intento = $state(0);

  function fallo(m: string): void {
    error = m;
    alFallar?.(m);
  }

  function falloVisor(m: string): void {
    reintentable = true;
    informarFallo(/WebGL/i.test(m) ? 'webgl' : 'componente', m, { zona: 'el modelo 3D' });
    fallo(m);
  }

  function reintentar(): void {
    error = '';
    reintentable = false;
    intento++;
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
  <div class="aviso3d" role="status">
    <div>
      <p>{error}</p>
      {#if reintentable}<button type="button" class="boton" onclick={reintentar} data-reintentar-3d>Reintentar</button>{/if}
    </div>
  </div>
{:else if Visor}
  {#key intento}
    <Visor {tipo} {parametros} {montaje} {nombre} {alto} alFallar={falloVisor} {alListo} />
  {/key}
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
  .aviso3d p {
    margin: 0 0 10px;
  }
  .aviso3d .boton {
    min-height: 44px;
  }
  /* the size of the view that replaces it (Visor3D: its canvas, 4 / 4.2 on a phone, and its tool bar's row), so
     nothing moves when it comes (0.11 QA) */
  .espera {
    max-height: 72vh;
    margin-bottom: 54px;
  }
  @media (max-width: 640px) {
    .espera {
      aspect-ratio: 4 / 4.2;
    }
  }
</style>
