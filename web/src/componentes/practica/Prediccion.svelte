<script lang="ts">
  // «Predice y comprueba»: before the circuit is run with one value changed, the reader says whether the
  // observed quantity goes up, down or stays; then the app's ngspice runs the book's circuit with the book's
  // value and with the new one, and the answer is graded with what the simulation gives (the generator's own
  // simulation only chose the question). A figure's schematic is then shown live with the new value
  // (charge flow and voltages); a book netlist links to the simulator.
  import { onMount } from 'svelte';
  import ArrowUp from '@lucide/svelte/icons/arrow-up';
  import ArrowDown from '@lucide/svelte/icons/arrow-down';
  import Equal from '@lucide/svelte/icons/equal';
  import { prepararHtml, url } from '../../lib/datos';
  import type { DatosFigura } from '../figuras-vivas/tipos';
  import type { EstadoEsquema } from '../figuras-vivas/esquema/modelo.svelte';
  import type { ItemPrediccion, Sentido } from './tipos';
  import type { Comprobacion } from './Practica.svelte';
  import { sentido } from './circuito';
  import { esquemaDe, medir, rutaSimulador, type Medida } from './medir';
  import { valorTexto } from './variantes';
  import FiguraRecortada from './FiguraRecortada.svelte';
  import EtiquetaNueva from './EtiquetaNueva.svelte';

  let { item, final, listo = $bindable(false), onenviar }: { item: ItemPrediccion; final: boolean; listo?: boolean; onenviar: () => void } = $props();

  const OPCIONES: { s: Sentido; t: string }[] = [
    { s: 'sube', t: 'Aumenta' },
    { s: 'baja', t: 'Disminuye' },
    { s: 'igual', t: 'Se queda igual' },
  ];

  let eleccion = $state<Sentido | null>(null);
  let esperando = $state(false);
  let antes = $state<Medida | null>(null);
  let despues = $state<Medida | null>(null);
  let real = $state<Sentido | null>(null);
  let vivo = $state<{ datos: DatosFigura; est: EstadoEsquema } | null>(null);
  let Escenario: typeof import('../figuras-vivas/Escenario.svelte').default | null = $state(null);
  let estadoG: import('../figuras-vivas/grafica/estado.svelte').EstadoGraficas | null = $state(null);

  $effect(() => {
    listo = eleccion !== null;
  });

  // Both runs start at once (the engine loads while the reader thinks).
  let medidas: Promise<[Medida, Medida]> | null = null;
  function lanzar(): Promise<[Medida, Medida]> {
    medidas ??= Promise.all([medir(item.fuente, null, item.observa), medir(item.fuente, { id: item.cambio.id, valor: item.a }, item.observa)]);
    return medidas;
  }
  onMount(() => {
    void lanzar();
  });

  async function mostrarVivo(op: Medida) {
    if (item.fuente.k !== 'figura' || !op.op) return;
    const [{ datos, esq }, mod, esc, gr] = await Promise.all([
      esquemaDe(item.fuente),
      import('../figuras-vivas/esquema/modelo.svelte'),
      import('../figuras-vivas/Escenario.svelte'),
      import('../figuras-vivas/grafica/estado.svelte'),
    ]);
    const est = new mod.EstadoEsquema(esq, item.fuente.esquema);
    est.cambios = { [item.cambio.id]: item.a };
    est.op = op.op;
    est.tran = null;
    est.estadoSim = 'ok';
    estadoG = new gr.EstadoGraficas();
    Escenario = esc.default;
    vivo = { datos, est };
  }

  export async function comprobar(): Promise<Comprobacion> {
    if (!eleccion) return { bien: false, nula: true, mensaje: 'Elige una respuesta.' };
    esperando = true;
    try {
      const [a, b] = await lanzar();
      antes = a;
      despues = b;
      if (a.valor == null || b.valor == null) {
        // The app's engine could not run it here: the generator's simulation (same engine) is shown instead.
        real = item.esperado.respuesta;
      } else real = sentido(a.valor, b.valor, item.observa.unidad);
      void mostrarVivo(b);
      return { bien: eleccion === real };
    } finally {
      esperando = false;
    }
  }

  export function reintentar(): void {
    eleccion = null;
  }

  function elegir(s: Sentido) {
    if (final || esperando) return;
    eleccion = s;
    onenviar();
  }

  const nombreReal = (s: Sentido | null) => (s === 'sube' ? 'aumenta' : s === 'baja' ? 'disminuye' : 'se queda igual');
  const va = $derived(antes?.valor ?? item.esperado.antes);
  const vb = $derived(despues?.valor ?? item.esperado.despues);
  const maximo = $derived(Math.max(Math.abs(va), Math.abs(vb), 1e-15));
  const deLibro = $derived(antes?.valor == null || despues?.valor == null);
</script>

<div class="prediccion" data-real={real ?? undefined}>
  {#if item.fuente.k === 'figura' && !final}
    <figure class="p10-placa p10-fig">
      <FiguraRecortada src={item.fuente.src} vista={item.fuente.vista} recorte={item.fuente.recorte} alt={`Figura ${item.fuente.num}`} />
      <figcaption>Figura {item.fuente.num}</figcaption>
    </figure>
  {:else if item.fuente.k === 'netlist' && !final}
    <p class="origen">Circuito de la netlist del libro «{item.fuente.titulo}»</p>
  {/if}

  <div class="opciones" role="group" aria-label="Tu predicción">
    {#each OPCIONES as o (o.s)}
      {@const elegida = eleccion === o.s}
      {@const ok = final && real === o.s}
      {@const mal = final && elegida && real !== o.s}
      <button
        type="button"
        class="opcion"
        class:elegida
        class:ok
        class:mal
        disabled={final || esperando}
        aria-pressed={elegida}
        onclick={() => elegir(o.s)}
        data-opcion={o.s}
      >
        <span class="icono" aria-hidden="true">
          {#if o.s === 'sube'}<ArrowUp size={20} strokeWidth={2.4} />{:else if o.s === 'baja'}<ArrowDown size={20} strokeWidth={2.4} />{:else}<Equal size={20} strokeWidth={2.4} />{/if}
        </span>
        <span class="txt">{o.t}</span>
        {#if ok}<span class="marca">Lo que pasa</span>{:else if mal}<span class="marca">Tu predicción</span>{/if}
      </button>
    {/each}
  </div>
  {#if esperando}
    <p class="estado" aria-live="polite"><span class="punto"></span> Simulando el circuito con ngspice…</p>
  {:else if !final}
    <p class="ayuda">Piensa primero y elige: después el simulador calcula el circuito con los dos valores.</p>
  {/if}

  {#if final}
    <div class="p10-solucion" data-simulacion>
      <span class="rot">Lo que da la simulación{deLibro ? ' (la del libro)' : ''}</span>
      <p class="frase">Al {item.a > item.cambio.de ? 'duplicar' : 'reducir a la mitad'} {@html prepararHtml(item.cambio.nombre)}, {@html prepararHtml(item.observa.nombre)} <strong>{nombreReal(real)}</strong>.</p>
      <dl class="barras">
        {#each [{ k: 'antes', v: va, c: item.cambio.de }, { k: 'despues', v: vb, c: item.a }] as fila (fila.k)}
          <div class="fila" data-fila={fila.k}>
            <dt>{@html prepararHtml(item.cambio.nombre)} = {valorTexto(fila.c, item.cambio.unidad)}</dt>
            <dd>
              <span class="barra" class:nueva={fila.k === 'despues'} style:width={`${Math.max(2, (100 * Math.abs(fila.v)) / maximo)}%`}></span>
              <span class="valor" data-valor={fila.v}>{valorTexto(fila.v, item.observa.unidad)}</span>
            </dd>
          </div>
        {/each}
      </dl>
      {#if vivo && Escenario && estadoG}
        {@const E = Escenario}
        {@const rv: [number, number, number, number] = item.fuente.k === 'figura' ? (item.fuente.recorte ?? item.fuente.vista) : [0, 0, 1, 1]}
        <div class="vivo p10-placa" data-vivo style:width={`min(100%, ${(300 * rv[2]) / rv[3] + 14}px)`}>
          <div class="capa-vivo">
          <E
              src={url(item.fuente.k === 'figura' ? item.fuente.src : '')}
              alt={`Figura ${item.fuente.k === 'figura' ? item.fuente.num : ''} con el valor nuevo`}
              vista={item.fuente.k === 'figura' ? (item.fuente.recorte ?? item.fuente.vista) : [0, 0, 1, 1]}
              imagen={item.fuente.k === 'figura' && item.fuente.recorte ? item.fuente.vista : undefined}
              datos={vivo.datos}
              grupos={[]}
              esquemas={[vivo.est]}
              estadoG={estadoG}
              activo={true}
            />
            {#if item.fuente.k === 'figura' && vivo.est.esq}
              <EtiquetaNueva src={item.fuente.src} esq={vivo.est.esq} elemento={item.cambio.id} valor={item.a} unidad={item.cambio.unidad} vista={rv} />
            {/if}
          </div>
        </div>
        <p class="nota">El esquema del libro con {@html prepararHtml(item.cambio.nombre)} = {valorTexto(item.a, item.cambio.unidad)}: la corriente y las tensiones son las de esta simulación.</p>
      {:else if item.fuente.k === 'netlist'}
        <a class="abrir" href={rutaSimulador(item.fuente.id)}>Abrir el circuito en el simulador</a>
      {/if}
    </div>
  {/if}
</div>

<style>
  .prediccion {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .p10-fig {
    margin: 0;
  }
  figcaption {
    margin-top: 6px;
    color: #444;
    font-size: 13px;
    text-align: center;
  }
  .origen {
    margin: 0;
    color: var(--tinta-suave);
    font-size: 15px;
  }
  .opciones {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
    gap: 10px;
  }
  .opcion {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 60px;
    padding: 10px 14px;
    border: 2px solid var(--linea);
    border-radius: 14px;
    background: var(--superficie);
    color: var(--tinta);
    font-size: 16.5px;
    font-weight: 600;
    text-align: left;
  }
  .opcion:not(:disabled):hover {
    border-color: var(--acento-borde);
    background: var(--acento-tinte);
  }
  .opcion.elegida {
    border-color: var(--acento);
  }
  .icono {
    display: grid;
    flex-shrink: 0;
    place-items: center;
    width: 34px;
    height: 34px;
    border-radius: 10px;
    background: var(--superficie-2);
  }
  .txt {
    flex: 1;
  }
  .marca {
    font-size: 11.5px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .opcion.ok {
    border-color: var(--ok);
    background: var(--ok-tinte);
  }
  .opcion.ok .icono {
    background: var(--ok);
    color: var(--sobre-veredicto);
  }
  .opcion.ok .marca {
    color: var(--ok);
  }
  .opcion.mal {
    border-color: var(--mal);
    background: var(--mal-tinte);
  }
  .opcion.mal .icono {
    background: var(--mal);
    color: var(--sobre-veredicto);
  }
  .opcion.mal .marca {
    color: var(--mal);
  }
  .opcion:disabled {
    cursor: default;
  }
  .ayuda,
  .estado,
  .nota {
    margin: 0;
    color: var(--tinta-suave);
    font-size: 14.5px;
  }
  .estado {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .punto {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--acento);
    animation: latido 1s ease-in-out infinite;
  }
  @keyframes latido {
    50% {
      opacity: 0.25;
    }
  }
  .frase {
    margin: 0;
    font-family: var(--serif);
    font-size: 17px;
    line-height: 1.45;
  }
  .barras {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0;
  }
  .fila dt {
    color: var(--tinta-suave);
    font-size: 13.5px;
  }
  .fila dd {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 2px 0 0;
  }
  .barra {
    height: 14px;
    border-radius: 7px;
    background: var(--tinta-suave);
    opacity: 0.55;
  }
  .barra.nueva {
    background: var(--bloque, var(--acento));
    opacity: 1;
  }
  .valor {
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
  }
  .capa-vivo {
    position: relative;
  }
  .vivo {
    align-self: center;
    box-sizing: border-box;
    padding: 6px;
  }
  .abrir {
    align-self: flex-start;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    font-weight: 600;
  }
  :global(:root[data-tema='oscuro']) figcaption {
    color: #444;
  }
</style>
