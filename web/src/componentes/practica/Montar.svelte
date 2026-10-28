<script lang="ts">
  // «Completa el circuito en la protoboard»: the board «Ver en protoboard» lays out for a book figure, with
  // one wire or one part missing. The reader uses the breadboard's own canvas (componentes/protoboard/
  // Mesa.svelte, public API) to lay the wire or put the part in its holes; «Comprobar» runs the breadboard's
  // verification against the schematic (connectivity): any correct fix is accepted.
  import { onMount, untrack } from 'svelte';
  import MousePointer from '@lucide/svelte/icons/mouse-pointer-2';
  import Cable from '@lucide/svelte/icons/cable';
  import RotateCw from '@lucide/svelte/icons/rotate-cw';
  import Undo from '@lucide/svelte/icons/undo-2';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import type { DocumentoProtoboard } from '../protoboard/tipos';
  import type { Protoboard } from '../protoboard/estado.svelte';
  import type { ItemProtoboard } from './tipos';
  import type { Comprobacion } from './Practica.svelte';
  import { datosFigura } from './medir';
  import FiguraRecortada from './FiguraRecortada.svelte';

  let { item, final, listo = $bindable(false) }: { item: ItemProtoboard; final: boolean; listo?: boolean } = $props();

  let pb = $state.raw<Protoboard | null>(null);
  let Mesa: typeof import('../protoboard/Mesa.svelte').default | null = $state.raw(null);
  let error = $state('');
  let completo: DocumentoProtoboard | null = null;
  let incompleto: DocumentoProtoboard | null = null;
  let verificar: ((d: DocumentoProtoboard) => string[]) | null = null;

  onMount(() => {
    void (async () => {
      try {
        const [d, m, est, mesa] = await Promise.all([
          datosFigura(item.figura.datos),
          import('./montaje'),
          import('../protoboard/estado.svelte'),
          import('../protoboard/Mesa.svelte'),
        ]);
        const esq = d.esquemas?.[item.figura.esquema];
        if (!esq) throw new Error('La figura no tiene ese esquema.');
        completo = m.montajeCompleto(esq, item.figura.titulo, item.figura.label);
        incompleto = m.montajeIncompleto(completo, item.quitar);
        if (!incompleto) throw new Error('No se pudo preparar el montaje incompleto.');
        verificar = m.verificarMontaje;
        const p = new est.Protoboard();
        p.cargar(JSON.parse(JSON.stringify(incompleto)) as DocumentoProtoboard);
        Mesa = mesa.default;
        pb = p;
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }
    })();
  });

  // Any change of the board can be checked.
  $effect(() => {
    listo = !!pb && pb.puedeDeshacer;
  });

  export function comprobar(): Comprobacion {
    if (!pb || !verificar) return { bien: false, nula: true, mensaje: 'El montaje aún se está preparando.' };
    const fallos = verificar($state.snapshot(pb.doc) as DocumentoProtoboard);
    if (!fallos.length) return { bien: true };
    return { bien: false, mensaje: `El montaje aún no corresponde al esquema: ${fallos[0]}.` };
  }

  export function reintentar(): void {
    if (pb && incompleto) pb.cargar(JSON.parse(JSON.stringify(incompleto)) as DocumentoProtoboard);
  }

  // After the second wrong attempt the complete board is shown.
  $effect(() => {
    if (!final || !pb || !completo || !verificar) return;
    const bien = untrack(() => !verificar!($state.snapshot(pb!.doc) as DocumentoProtoboard).length);
    if (!bien) untrack(() => pb!.cargar(JSON.parse(JSON.stringify(completo)) as DocumentoProtoboard));
  });

  function girar() {
    const id = pb?.sel[0];
    if (pb && id) pb.girar(id);
  }
</script>

<div class="montar" data-herramienta={pb?.herramienta}>
  <figure class="p10-placa p10-fig">
    <FiguraRecortada src={item.figura.src} vista={item.figura.vista} recorte={item.figura.recorte} alt={`Figura ${item.figura.num}`} />
    <figcaption>Figura {item.figura.num} (el esquema)</figcaption>
  </figure>
  {#if error}
    <p class="error">{error}</p>
  {:else if !pb || !Mesa}
    <p class="cargando" aria-live="polite">Preparando la protoboard…</p>
  {:else}
    {@const M = Mesa}
    {@const p = pb}
    {#if !final}
      <div class="herramientas" role="toolbar" aria-label="Herramientas de la protoboard">
        <button type="button" aria-pressed={p.herramienta === 'seleccionar'} onclick={() => (p.herramienta = 'seleccionar')} data-herr="mover"><MousePointer size={18} aria-hidden="true" /> Mover</button>
        <button type="button" aria-pressed={p.herramienta === 'cable'} onclick={() => (p.herramienta = p.herramienta === 'cable' ? 'seleccionar' : 'cable')} data-herr="cable"><Cable size={18} aria-hidden="true" /> Cable</button>
        <button type="button" onclick={girar} disabled={!p.sel.length || !p.pieza(p.sel[0] ?? '')} data-herr="girar"><RotateCw size={18} aria-hidden="true" /> Girar</button>
        <button type="button" onclick={() => p.deshacer()} disabled={!p.puedeDeshacer} aria-label="Deshacer" data-herr="deshacer"><Undo size={18} aria-hidden="true" /></button>
        <button type="button" onclick={reintentar} aria-label="Empezar de nuevo" data-herr="reiniciar"><RotateCcw size={18} aria-hidden="true" /></button>
      </div>
      <p class="ayuda">{p.herramienta === 'cable' ? 'Toca un agujero y después otro (o arrastra) para tender un cable.' : 'Arrastra una pieza para moverla; con «Cable», tiende cables de agujero a agujero.'}</p>
    {:else}
      <p class="ayuda">{'El montaje completo.'}</p>
    {/if}
    {#if p.mensaje && !final}<p class="aviso" role="status">{p.mensaje}</p>{/if}
    <div class="caja-mesa" data-mesa>
      <M pb={p} />
    </div>
  {/if}
</div>

<style>
  .montar {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .p10-fig {
    margin: 0;
  }
  figcaption {
    margin-top: 4px;
    color: #444;
    font-size: 13px;
    text-align: center;
  }
  .herramientas {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .herramientas button {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-width: 44px;
    min-height: 44px;
    padding: 0 10px;
    border: 1px solid var(--linea);
    border-radius: 12px;
    background: var(--superficie);
    color: var(--tinta);
    font-size: 15px;
    font-weight: 600;
    justify-content: center;
  }
  .herramientas button[aria-pressed='true'] {
    border-color: var(--acento);
    background: var(--acento-tinte);
    color: var(--acento);
  }
  .herramientas button:disabled {
    opacity: 0.45;
  }
  .caja-mesa {
    height: clamp(260px, min(52vh, 80vw), 480px);
    border: 1px solid var(--linea);
    border-radius: 14px;
    overflow: hidden;
  }
  .ayuda,
  .cargando {
    margin: 0;
    color: var(--tinta-suave);
    font-size: 14.5px;
  }
  .aviso {
    margin: 0;
    color: var(--tinta);
    font-size: 14.5px;
  }
  .error {
    color: var(--mal);
  }
</style>
