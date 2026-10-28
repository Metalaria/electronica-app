<script lang="ts">
  // «Ajusta R hasta que…»: a slider over the E12 values of one resistor of a book circuit (×0,1…×10 of the
  // book's value). Every position is simulated with the app's ngspice (a short pause after the finger stops),
  // the reading is shown at once, and «Comprobar» grades the simulated value against the target. A figure's
  // schematic follows the slider live.
  import { onMount, untrack } from 'svelte';
  import { prepararHtml, url } from '../../lib/datos';
  import type { DatosFigura } from '../figuras-vivas/tipos';
  import type { EstadoEsquema } from '../figuras-vivas/esquema/modelo.svelte';
  import type { ItemDeslizador } from './tipos';
  import type { Comprobacion } from './Practica.svelte';
  import { esquemaDe, medir, rutaSimulador, type Medida } from './medir';
  import { valorTexto } from './variantes';
  import FiguraRecortada from './FiguraRecortada.svelte';
  import EtiquetaNueva from './EtiquetaNueva.svelte';

  let { item, final, listo = $bindable(false) }: { item: ItemDeslizador; final: boolean; listo?: boolean } = $props();

  const inicio = untrack(() => {
    const k = item.valores.findIndex((v) => Math.abs(v - item.cambio.de) / item.cambio.de < 0.02);
    return k >= 0 ? k : Math.floor(item.valores.length / 2);
  });
  let pos = $state(inicio);
  let lectura = $state<Medida | null>(null);
  let leyendo = $state(false);
  let movido = $state(false);
  let solucion = $state<{ valor: number; m: Medida } | null>(null);
  let vivo = $state<{ datos: DatosFigura; est: EstadoEsquema } | null>(null);
  let Escenario: typeof import('../figuras-vivas/Escenario.svelte').default | null = $state(null);
  let estadoG: import('../figuras-vivas/grafica/estado.svelte').EstadoGraficas | null = $state(null);

  const valor = $derived(item.valores[pos]!);
  const tolerancia = $derived(Math.abs(item.objetivo) * item.tol);

  $effect(() => {
    listo = movido && !leyendo;
  });

  async function prepararVivo() {
    if (item.fuente.k !== 'figura') return;
    const [{ datos, esq }, mod, esc, gr] = await Promise.all([
      esquemaDe(item.fuente),
      import('../figuras-vivas/esquema/modelo.svelte'),
      import('../figuras-vivas/Escenario.svelte'),
      import('../figuras-vivas/grafica/estado.svelte'),
    ]);
    estadoG = new gr.EstadoGraficas();
    Escenario = esc.default;
    vivo = { datos, est: new mod.EstadoEsquema(esq, item.fuente.esquema) };
  }

  let turno = 0;
  async function leer(k: number): Promise<Medida> {
    const mio = ++turno;
    leyendo = true;
    const v = item.valores[k]!;
    const m = await medir(item.fuente, Math.abs(v - item.cambio.de) / item.cambio.de < 1e-9 ? null : { id: item.cambio.id, valor: v }, item.observa);
    if (mio === turno) {
      lectura = m;
      leyendo = false;
      if (vivo && m.op) {
        vivo.est.cambios = { [item.cambio.id]: v };
        vivo.est.op = m.op;
        vivo.est.estadoSim = 'ok';
      }
    }
    return m;
  }

  let espera: ReturnType<typeof setTimeout> | null = null;
  function mover() {
    movido = true;
    if (espera) clearTimeout(espera);
    leyendo = true;
    espera = setTimeout(() => void leer(pos), 280);
  }

  onMount(() => {
    void prepararVivo();
    void leer(pos);
    return () => {
      if (espera) clearTimeout(espera);
    };
  });

  export async function comprobar(): Promise<Comprobacion> {
    if (espera) clearTimeout(espera);
    const m = await leer(pos);
    if (m.valor == null) return { bien: false, nula: true, mensaje: `No se pudo simular: ${m.error ?? 'error desconocido'}.` };
    const bien = Math.abs(m.valor - item.objetivo) <= tolerancia;
    if (!bien) {
      // The solution shown at the end is simulated too.
      const meta = item.aciertan[0];
      if (meta != null) void medir(item.fuente, { id: item.cambio.id, valor: meta }, item.observa).then((s) => (solucion = { valor: meta, m: s }));
      const arriba = Math.abs(m.valor) > Math.abs(item.objetivo);
      return {
        bien: false,
        mensaje: `Con ${textoPlano(item.cambio.nombre)} = ${valorTexto(valor, item.cambio.unidad)} sale ${valorTexto(m.valor, item.observa.unidad)}: todavía ${arriba ? 'por encima' : 'por debajo'} de ${valorTexto(item.objetivo, item.observa.unidad)}.`,
      };
    }
    return { bien: true };
  }

  export function reintentar(): void {
    pos = inicio;
    movido = false;
    void leer(pos);
  }

  function textoPlano(h: string): string {
    return h.replace(/<[^>]+>/g, '');
  }
</script>

<div class="deslizador" data-valor={valor} data-lectura={lectura?.valor ?? undefined}>
  {#if vivo && Escenario && estadoG && item.fuente.k === 'figura'}
    {@const E = Escenario}
    {@const rv = item.fuente.recorte ?? item.fuente.vista}
    <div class="p10-placa vivo" data-vivo style:width={`min(100%, ${(300 * rv[2]) / rv[3] + 14}px)`}>
      <div class="capa-vivo">
        <E src={url(item.fuente.src)} alt={`Figura ${item.fuente.num}`} vista={rv} imagen={item.fuente.recorte ? item.fuente.vista : undefined} datos={vivo.datos} grupos={[]} esquemas={[vivo.est]} {estadoG} activo={true} />
        <EtiquetaNueva src={item.fuente.src} esq={vivo.est.esq} elemento={item.cambio.id} {valor} unidad={item.cambio.unidad} vista={rv} />
      </div>
    </div>
  {:else if item.fuente.k === 'figura'}
    <figure class="p10-placa p10-fig"><FiguraRecortada src={item.fuente.src} vista={item.fuente.vista} recorte={item.fuente.recorte} alt={`Figura ${item.fuente.num}`} /></figure>
  {:else}
    <p class="origen">Circuito de la netlist del libro «{item.fuente.titulo}» · <a href={rutaSimulador(item.fuente.id)}>abrir en el simulador</a></p>
  {/if}

  <div class="control">
    <label for={`d10-${item.id}`}>
      <span class="nombre">{@html prepararHtml(item.cambio.nombre)}</span>
      <strong class="cifra" data-valor-texto>{valorTexto(valor, item.cambio.unidad)}</strong>
    </label>
    <input
      id={`d10-${item.id}`}
      type="range"
      min="0"
      max={item.valores.length - 1}
      step="1"
      bind:value={pos}
      oninput={mover}
      disabled={final}
      aria-valuetext={valorTexto(valor, item.cambio.unidad)}
      data-deslizador
    />
    <div class="extremos" aria-hidden="true">
      <span>{valorTexto(item.valores[0]!, item.cambio.unidad)}</span>
      <span>Valores E12</span>
      <span>{valorTexto(item.valores[item.valores.length - 1]!, item.cambio.unidad)}</span>
    </div>
  </div>

  <div class="p10-lectura" class:ok={final && lectura?.valor != null && Math.abs(lectura.valor - item.objetivo) <= tolerancia} aria-live="polite">
    <span class="que">{@html prepararHtml(item.observa.nombre)}</span>
    <span class="medida" data-medida>
      {#if leyendo}simulando…{:else if lectura?.valor != null}{valorTexto(lectura.valor, item.observa.unidad)}{:else}—{/if}
    </span>
    <span class="meta">objetivo: {valorTexto(item.objetivo, item.observa.unidad)} ± {Math.round(item.tol * 100)} %</span>
  </div>

  {#if final && solucion && (lectura?.valor == null || Math.abs(lectura.valor - item.objetivo) > tolerancia)}
    <div class="p10-solucion" data-solucion>
      <span class="rot">La solución, simulada</span>
      <p>Con {@html prepararHtml(item.cambio.nombre)} = <strong>{valorTexto(solucion.valor, item.cambio.unidad)}</strong>, {@html prepararHtml(item.observa.nombre)} es {solucion.m.valor != null ? valorTexto(solucion.m.valor, item.observa.unidad) : '—'}.</p>
    </div>
  {/if}
</div>

<style>
  .deslizador {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .p10-fig {
    margin: 0;
  }
  .capa-vivo {
    position: relative;
  }
  .vivo {
    align-self: center;
    box-sizing: border-box;
    padding: 6px;
  }
  .origen {
    margin: 0;
    color: var(--tinta-suave);
    font-size: 15px;
  }
  .control {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  label {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    font-size: 16px;
  }
  .cifra {
    font-size: 22px;
    font-variant-numeric: tabular-nums;
  }
  input[type='range'] {
    width: 100%;
    height: 44px;
    accent-color: var(--bloque, var(--acento));
  }
  .extremos {
    display: flex;
    justify-content: space-between;
    color: var(--tinta-suave);
    font-size: 12.5px;
  }
  .p10-lectura {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 2px 12px;
    padding: 12px 14px;
    border: 2px solid var(--linea);
    border-radius: 14px;
    background: var(--superficie);
  }
  .p10-lectura.ok {
    border-color: var(--ok);
    background: var(--ok-tinte);
  }
  .p10-lectura .que {
    color: var(--tinta-suave);
    font-size: 14px;
  }
  .p10-lectura .medida {
    grid-row: span 2;
    align-self: center;
    font-size: 22px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .p10-lectura .meta {
    color: var(--tinta);
    font-size: 14px;
    font-weight: 600;
  }
  .p10-solucion p {
    margin: 0;
    font-size: 16px;
  }
</style>
