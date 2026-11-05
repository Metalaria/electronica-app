<script lang="ts">
  // A book figure with its live layer: interactive plots (readout, A/B cursors) and live schematics
  // (charge flow, voltages, values). The figure data are fetched only when the figure comes near the
  // viewport, and the layers animate only while it is on screen; until then this is just the image.
  import { getContext, onMount, untrack } from 'svelte';
  import Maximize from '@lucide/svelte/icons/maximize-2';
  import Zap from '@lucide/svelte/icons/zap';
  import Activity from '@lucide/svelte/icons/activity';
  import type { Caja, DatosFigura } from './tipos';
  import { cargarDatos, cerca, datosYa, enPantalla, pagina } from './carga.svelte';
  import { grupos as calcularGrupos } from './grafica/lectura';
  import { EstadoGraficas } from './grafica/estado.svelte';
  import { EstadoEsquema } from './esquema/modelo.svelte';
  import Escenario from './Escenario.svelte';
  import TablaCursores from './grafica/TablaCursores.svelte';
  import PanelEsquema from './esquema/PanelEsquema.svelte';
  import ExploraEsquema from './esquema/ExploraEsquema.svelte';
  import { CONTEXTO_LECCION, type ContextoLeccion } from './contexto';
  import Grande from './Grande.svelte';

  let {
    src,
    alt,
    num = null,
    pie = null,
    credito = null,
    ruta,
    vista,
    tipo = 'grafica',
    ancho = 1,
    abrirVisor,
  }: {
    src: string;
    alt: string;
    num?: string | null;
    pie?: string | null;
    credito?: string | null;
    /** `datos/NAME.json` */
    ruta: string;
    vista: Caja;
    tipo?: 'grafica' | 'esquema';
    ancho?: number;
    /** The plain full-screen viewer (figures without a live layer). */
    abrirVisor: () => void;
  } = $props();

  // 0.11 (group B): inside a lesson, a simulable DC schematic gets the «explore» row (one value, one reading)
  const leccion = getContext<ContextoLeccion | undefined>(CONTEXTO_LECCION);

  const explorables = $derived(leccion?.explorables[ruta] ?? []);

  let raiz: HTMLElement | undefined = $state();
  /** The data match the figure (the viewBox; otherwise the layers would be misplaced). */
  const encaja = (d: DatosFigura) => {
    const s = d.lienzo?.svg;
    return !!s && Math.abs(s.ancho - vista[2]) < 0.5 && Math.abs(s.alto - vista[3]) < 0.5;
  };
  // (already arrived: taken before the first paint, so the panels are there from the start)
  let datos = $state.raw<DatosFigura | null>(untrack(() => {
    const d = datosYa(ruta);
    return d && encaja(d) ? d : null;
  }));
  // data that arrive while the figure is already on the page (the reader moving to it within the part asks for them
  // before scrolling: 0.11 final QA, its panels pushed the caption 280 px down after the scroll)
  $effect(() => {
    if (datos) return;
    const d = datosYa(ruta);
    if (d && encaja(d)) datos = d;
  });
  let visible = $state(false);
  let grande = $state(false);

  const estadoG = new EstadoGraficas();
  const grupos = $derived(datos ? calcularGrupos(datos) : []);
  const esquemas = $derived(datos ? (datos.esquemas ?? []).map((e, i) => new EstadoEsquema(e, i)) : []);
  const vivo = $derived(grupos.length > 0 || esquemas.length > 0);
  const simulables = $derived(esquemas.filter((e) => e.simulable).length);
  const conCursores = $derived(grupos.some((g) => g.xNumerico));

  onMount(() => {
    const el = raiz!;
    const dejar = cerca.observar(el, (dentro) => {
      if (!dentro || datos) return;
      cargarDatos(ruta)
        .then((d) => {
          if (encaja(d)) datos = d;
        })
        .catch(() => {});
    });
    const dejar2 = enPantalla.observar(el, (dentro) => (visible = dentro));
    return () => {
      dejar();
      dejar2();
    };
  });

  function abrir() {
    if (vivo) grande = true;
    else abrirVisor();
  }

  const nombre = $derived(num ? `la figura ${num}` : 'la figura');

  /** Label of the figure's live layer (its kind is known before the data arrive, so nothing moves). */
  const sello = $derived.by(() => {
    if (!datos) return { texto: tipo === 'esquema' ? 'Esquema' : 'Gráfica', titulo: '' };
    if (simulables) return { texto: 'Circuito vivo', titulo: 'Tensiones y corrientes simuladas: toque o pase el puntero por un cable o un componente' };
    if (esquemas.length && !grupos.length) return { texto: 'Conexiones', titulo: 'Pase el puntero o toque un cable para ver qué une' };
    if (grupos.length) return { texto: 'Lectura de valores', titulo: 'Pase el puntero o el dedo por la gráfica para leer los valores; clic o toque para fijarlos' };
    return { texto: tipo === 'esquema' ? 'Esquema' : 'Gráfica', titulo: '' };
  });
</script>

<div
  class="figura-placa vectorial viva"
  class:lista={vivo}
  bind:this={raiz}
  style:--ancho={`${(Math.min(1, Math.max(0.2, ancho)) * 100).toFixed(1)}%`}
  data-figura-viva={num ?? ''}
>
  <div class="mandos">
    <span class="sello" class:apagado={!vivo} title={sello.titulo}>
      {#if tipo === 'esquema'}<Zap size={14} />{:else}<Activity size={14} />{/if}
      <span class="txt">{sello.texto}</span>
    </span>
    <span class="hueco"></span>
    {#if conCursores}
      <button
        type="button"
        class="m"
        aria-pressed={estadoG.cursores}
        title="Cursores A y B para medir diferencias (tecla C)"
        aria-label="Cursores A y B"
        onclick={() => (estadoG.cursores = !estadoG.cursores)}><span class="ab">A|B</span></button
      >
    {/if}
    <button type="button" class="m" title="Abrir en grande" aria-label={`Abrir ${nombre} en grande`} onclick={abrir}><Maximize size={17} /></button>
  </div>
  <div class="marco-fv">
    <Escenario
      {src}
      {alt}
      {vista}
      {datos}
      {grupos}
      {esquemas}
      {estadoG}
      activo={visible && pagina.visible && !grande}
      alFondo={abrir}
    />
  </div>
</div>
{#if leccion && explorables.length && !(datos && vivo)}
  <!-- the room of the «explore» rows while the figure's data load -->
  {#each explorables as k (k)}<div class="explora-reserva" aria-hidden="true"></div>{/each}
{/if}
{#if datos && vivo}
  {#if estadoG.cursores}<TablaCursores {datos} {grupos} estado={estadoG} />{/if}
  {#each esquemas as e, i (i)}
    {#if leccion && explorables.includes(i) && e.simulable && !e.externo && !e.esq.simulacion?.tran}
      <ExploraEsquema est={e} {ruta} indice={i} parte={leccion.parte} visible={visible && pagina.visible && !grande} />
    {/if}
    <PanelEsquema est={e} numero={esquemas.length > 1 ? i + 1 : null} figura={num} />
  {/each}
{/if}
{#if grande && datos}
  <Grande
    {src}
    {alt}
    {num}
    {pie}
    {credito}
    {vista}
    {datos}
    {grupos}
    {esquemas}
    {estadoG}
    cerrar={() => (grande = false)}
  />
{/if}

<style>
  /* same height as ExploraEsquema's first state (group B) */
  .explora-reserva {
    max-width: 46em;
    min-height: var(--alto-explora, 204px);
    margin: 0.6em auto 0;
  }
  .viva {
    cursor: default;
  }
  @media (max-width: 599px) {
    .viva {
      --ancho: 100% !important;
    }
  }
  .viva.lista {
    cursor: auto;
  }
  .viva {
    padding-top: 4px;
  }
  .marco-fv {
    position: relative;
    width: var(--ancho, 100%);
    max-width: 100%;
    margin: 0 auto;
  }
  .mandos {
    display: flex;
    align-items: center;
    gap: 4px;
    margin: 0 -6px 4px -4px;
  }
  .hueco {
    flex: 1;
  }
  .sello {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-width: 0;
    color: var(--acento);
    font-family: var(--sans);
    font-size: 12.5px;
    font-weight: 600;
    white-space: nowrap;
  }
  /* The label sits on the figure's plate, which stays light in every theme: the dark theme's light accent and faint
     grey were 2.2–2.5:1 there (0.11 QA). */
  :global(:root[data-tema='oscuro']) .sello {
    color: color-mix(in srgb, var(--acento) 50%, #1a1a1a);
  }
  .sello.apagado,
  :global(:root[data-tema='oscuro']) .sello.apagado,
  :global(:root[data-tema='oscuro']) .m:not([aria-pressed='true']) {
    color: #5b6672;
  }
  .txt {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .m {
    display: grid;
    place-items: center;
    min-width: 32px;
    height: 30px;
    padding: 0 6px;
    border: 0;
    border-radius: 8px;
    background: none;
    color: var(--tinta-suave);
  }
  .m:hover {
    background: var(--hover);
    color: var(--tinta);
  }
  .m[aria-pressed='true'] {
    background: #6a3fb5;
    color: #fff;
  }
  .ab {
    font-family: var(--sans);
    font-size: 12.5px;
    font-weight: 700;
    letter-spacing: 0.02em;
  }
  @media (pointer: coarse) {
    .m {
      min-width: 44px;
      height: 44px;
      border-radius: 12px;
    }
    .mandos {
      margin-top: -6px;
      margin-bottom: 0;
    }
  }
</style>
