<script lang="ts">
  // 1.1 lessons: the controls of a widget. A slider is the 1.0 «Teoría que se mueve» control (teoria/MandoValor.svelte:
  // role="slider", arrows one position, Page Up/Down a tenth, Home/End, dragging with capture), dressed in the 1.1
  // tokens and the colour of its quantity; a switch is a role="switch" button; «conectar» is the mock-up's dashed
  // button that closes a switch (and then offers to open it again).
  import MandoValor from '../teoria/MandoValor.svelte';
  import { posicionMasCercana, type Valores } from '../../lib/leccion11/modelo';
  import { htmlDeTexto } from '../../lib/leccion11/texto';
  import type { Color, Leccion11, Mando } from '../../lib/leccion11/tipos';
  import TextoVivo from './TextoVivo.svelte';

  let {
    leccion,
    mandos,
    valores,
    prefijo,
    color,
    visible = () => true,
    alMover,
    valor,
  }: {
    leccion: Leccion11;
    mandos: Mando[];
    valores: Valores;
    /** Unique prefix of the ids on the page. */
    prefijo: string;
    color: (valor: string) => Color;
    visible?: (m: Mando) => boolean;
    alMover: (valor: string, x: number) => void;
    valor: (id: string) => string;
  } = $props();

  const mag = (id: string) => leccion.modelo.valores[id]!;
</script>

<div class="mandos">
  {#each mandos as m (m.valor)}
    {#if visible(m)}
      {@const v = valores[m.valor] ?? 0}
      {#if m.tipo === 'deslizador'}
        <div class={`mando ${color(m.valor)}`} data-mando11={m.valor}>
          <MandoValor
            id={`${prefijo}-${m.valor}`}
            sim={htmlDeTexto(m.rotulo ?? mag(m.valor).sim) + (m.serie && !m.rotulo ? ` (${m.serie})` : '')}
            nombre=""
            unidad={mag(m.valor).unidad}
            valores={m.valores}
            nombres={m.nombres}
            pos={posicionMasCercana(m.valores, v)}
            alMover={(k) => alMover(m.valor, m.valores[k]!)}
          />
        </div>
      {:else if m.tipo === 'conectar'}
        {#if v === 0}
          <button type="button" class="conectar" data-conectar={m.valor} onclick={() => alMover(m.valor, 1)}>
            <TextoVivo texto={m.boton} {valor} />
          </button>
        {:else}
          <button type="button" class="quitar" data-quitar={m.valor} onclick={() => alMover(m.valor, 0)}>Quitar la carga</button>
        {/if}
      {:else}
        <button type="button" class="interruptor" role="switch" aria-checked={v !== 0} data-interruptor={m.valor} onclick={() => alMover(m.valor, v !== 0 ? 0 : 1)}>
          <span class="botonera" aria-hidden="true"><span class="bola"></span></span>
          <TextoVivo texto={m.rotulo ?? mag(m.valor).sim} {valor} />
        </button>
      {/if}
    {/if}
  {/each}
</div>

<style>
  .mandos {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .mando {
    /* the 1.0 slider's own custom properties, in the 1.1 tokens */
    --tinta: var(--v11-tinta);
    --tinta-suave: var(--v11-tinta-suave);
    --linea: var(--v11-linea);
    --superficie: var(--v11-fondo);
    --serif: var(--v11-texto);
    --sans: var(--v11-texto);
    --acento: var(--v11-azul);
    font-family: var(--v11-texto);
  }
  .mando :global(.sim) {
    font-style: normal;
    font-weight: 600;
  }
  .mando.azul :global(.sim) {
    color: var(--v11-azul);
  }
  .mando.naranja {
    --acento: var(--v11-naranja);
  }
  .mando.naranja :global(.sim) {
    color: var(--v11-naranja-texto);
  }
  .mando.verde {
    --acento: var(--v11-verde);
  }
  .mando.verde :global(.sim) {
    color: var(--v11-verde);
  }
  .mando :global(.pista:focus-visible) {
    outline: 3px solid var(--v11-foco);
    outline-offset: 2px;
  }
  .conectar,
  .quitar,
  .interruptor {
    min-height: 48px;
    padding: 8px 16px;
    border-radius: var(--v11-radio-opcion);
    font: 600 16px/1.3 var(--v11-texto);
    cursor: pointer;
  }
  .conectar {
    border: 2px dashed var(--v11-verde);
    background: var(--v11-fondo);
    color: var(--v11-verde);
  }
  .quitar {
    align-self: flex-start;
    min-height: 44px;
    border: 2px solid var(--v11-borde);
    background: var(--v11-fondo);
    color: var(--v11-tinta);
    font-size: 15px;
  }
  .interruptor {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    align-self: flex-start;
    border: 2px solid var(--v11-borde);
    background: var(--v11-fondo);
    color: var(--v11-tinta);
  }
  .botonera {
    position: relative;
    width: 38px;
    height: 22px;
    border-radius: 11px;
    background: var(--v11-borde);
  }
  .bola {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--v11-fondo);
    transition: transform 0.2s;
  }
  .interruptor[aria-checked='true'] .botonera {
    background: var(--v11-azul);
  }
  .interruptor[aria-checked='true'] .bola {
    transform: translateX(16px);
  }
  button:focus-visible {
    outline: 3px solid var(--v11-foco);
    outline-offset: 2px;
  }
  @media (prefers-reduced-motion: reduce) {
    .bola {
      transition: none;
    }
  }
</style>
