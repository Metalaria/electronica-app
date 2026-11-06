<script lang="ts">
  // 1.0 «Reto manipulando la figura»: one or two values of a live figure of the book (a resistor, a source) to move
  // until a quantity meets the target. Every position is simulated with the app's ngspice (a short pause after the
  // hand stops) and the figure follows live; the reading shows how far it is (difference, %, a closeness bar, closer
  // or further than before). «Comprobar» grades the simulated reading: any combination that meets it is right.
  import { onMount, untrack } from 'svelte';
  import ChevronLeft from '@lucide/svelte/icons/chevron-left';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import { prepararHtml, url } from '../../lib/datos';
  import type { DatosFigura } from '../figuras-vivas/tipos';
  import type { EstadoEsquema } from '../figuras-vivas/esquema/modelo.svelte';
  import type { ItemReto } from './tipos';
  import type { Comprobacion } from './Practica.svelte';
  import { esquemaDe, medirCon, type Medida } from './medir';
  import { evaluarReto, plano, posicionDe, textoValor, type EvaluacionReto } from './retos';
  import EtiquetaNueva from './EtiquetaNueva.svelte';
  import Tapas from './Tapas.svelte';

  let { item, final, listo = $bindable(false) }: { item: ItemReto; final: boolean; listo?: boolean } = $props();

  const inicios = untrack(() => item.mandos.map((m) => posicionDe(m.valores, m.inicio)));
  let pos = $state<number[]>([...inicios]);
  let lectura = $state<Medida | null>(null);
  let anterior = $state<number | null>(null);
  let leyendo = $state(false);
  let movido = $state(false);
  let vivo = $state<{ datos: DatosFigura; est: EstadoEsquema } | null>(null);
  let Escenario: typeof import('../figuras-vivas/Escenario.svelte').default | null = $state(null);
  let estadoG: import('../figuras-vivas/grafica/estado.svelte').EstadoGraficas | null = $state(null);

  const valores = $derived(Object.fromEntries(item.mandos.map((m, i) => [m.id, m.valores[pos[i]!]!])) as Record<string, number>);
  const nombreObs = $derived(plano(item.observa.nombre));
  const ev = $derived<EvaluacionReto | null>(lectura && !leyendo ? evaluarReto(lectura.valor, item.objetivo, item.tol, item.observa.unidad, nombreObs) : null);
  /** Closer or further than the previous reading (only once there is one). */
  const tendencia = $derived.by((): 'cerca' | 'lejos' | null => {
    if (anterior == null || lectura?.valor == null || leyendo) return null;
    const a = Math.abs(Math.abs(anterior) - Math.abs(item.objetivo));
    const b = Math.abs(Math.abs(lectura.valor) - Math.abs(item.objetivo));
    if (Math.abs(a - b) <= Math.abs(item.objetivo) * 0.002) return null;
    return b < a ? 'cerca' : 'lejos';
  });

  $effect(() => {
    listo = movido && !leyendo;
  });

  async function prepararVivo() {
    const [{ datos, esq }, mod, esc, gr] = await Promise.all([
      esquemaDe(item.fuente),
      import('../figuras-vivas/esquema/modelo.svelte'),
      import('../figuras-vivas/Escenario.svelte'),
      import('../figuras-vivas/grafica/estado.svelte'),
    ]);
    if (desmontado) return;
    estadoG = new gr.EstadoGraficas();
    Escenario = esc.default;
    vivo = { datos, est: new mod.EstadoEsquema(esq, item.fuente.esquema) };
    if (lectura?.op) mostrar(lectura.op);
  }

  function mostrar(op: NonNullable<Medida['op']>) {
    if (!vivo) return;
    vivo.est.cambios = { ...valores };
    vivo.est.op = op;
    vivo.est.estadoSim = 'ok';
  }

  // Left while a reading was on its way (next screen, reload): it does nothing when it comes.
  let desmontado = false;
  let turno = 0;
  async function leer(): Promise<Medida> {
    const mio = ++turno;
    leyendo = true;
    const m = await medirCon(item.fuente, { ...valores }, item.observa);
    if (mio === turno && !desmontado) {
      if (lectura?.valor != null) anterior = lectura.valor;
      lectura = m;
      leyendo = false;
      if (m.op) mostrar(m.op);
    }
    return m;
  }

  let espera: ReturnType<typeof setTimeout> | null = null;
  function mover(i: number, k: number) {
    const m = item.mandos[i]!;
    const n = Math.max(0, Math.min(m.valores.length - 1, k));
    if (n === pos[i]) return;
    pos[i] = n;
    movido = true;
    if (espera) clearTimeout(espera);
    leyendo = true;
    espera = setTimeout(() => void leer(), 280);
  }

  onMount(() => {
    void prepararVivo();
    void leer();
    return () => {
      desmontado = true;
      turno++;
      if (espera) clearTimeout(espera);
    };
  });

  export async function comprobar(): Promise<Comprobacion> {
    if (espera) clearTimeout(espera);
    espera = null;
    const m = await leer();
    if (m.valor == null) return { bien: false, nula: true, mensaje: `No se pudo simular: ${m.error ?? 'error desconocido'}.` };
    const e = evaluarReto(m.valor, item.objetivo, item.tol, item.observa.unidad, nombreObs);
    return e.bien ? { bien: true } : { bien: false, mensaje: e.mensaje };
  }

  export function reintentar(): void {
    pos = [...inicios];
    movido = false;
    anterior = null;
    void leer();
  }

  const tolTexto = $derived(`± ${Math.round(item.tol * 100)} %`);
</script>

<div class="reto" data-reto={item.id} data-lectura={lectura?.valor ?? undefined} data-leyendo={leyendo ? '' : undefined}>
  {#if vivo && Escenario && estadoG}
    {@const E = Escenario}
    {@const rv = item.fuente.recorte ?? item.fuente.vista}
    <div class="p10-placa vivo" data-vivo style:width={`min(100%, ${(300 * rv[2]) / rv[3] + 14}px)`}>
      <div class="capa-vivo">
        <E src={url(item.fuente.src)} alt={`Figura ${item.fuente.num}, con los valores que usted elige`} vista={rv} imagen={item.fuente.recorte ? item.fuente.vista : undefined} datos={vivo.datos} grupos={[]} esquemas={[vivo.est]} {estadoG} activo={true} />
        <!-- the book's notes and readings (the answer) hidden; the new values are written above them -->
        <Tapas cajas={item.fuente.ocultar ?? []} vista={rv} />
        {#each item.mandos as m (m.id)}
          <EtiquetaNueva src={item.fuente.src} esq={vivo.est.esq} elemento={m.id} valor={valores[m.id]!} unidad={m.unidad} vista={rv} />
        {/each}
      </div>
    </div>
  {:else}
    <div class="p10-placa vivo cargando" aria-hidden="true"></div>
  {/if}

  {#each item.mandos as m, i (m.id)}
    {@const v = valores[m.id]!}
    <div class="mando">
      <label for={`r10-${item.id}-${i}`}>
        <span class="nombre">{@html prepararHtml(m.nombre)}</span>
        <strong class="cifra" data-valor-mando={i}>{textoValor(v, m.unidad)}</strong>
      </label>
      <div class="fila">
        <button type="button" class="paso" onclick={() => mover(i, pos[i]! - 1)} disabled={final || pos[i] === 0} aria-label={`Bajar ${plano(m.nombre)} un paso`} data-menos={i}><ChevronLeft size={20} aria-hidden="true" /></button>
        <input
          id={`r10-${item.id}-${i}`}
          type="range"
          min="0"
          max={m.valores.length - 1}
          step="1"
          value={pos[i]}
          oninput={(e) => mover(i, Number((e.currentTarget as HTMLInputElement).value))}
          disabled={final}
          aria-valuetext={textoValor(v, m.unidad)}
          data-mando={i}
        />
        <button type="button" class="paso" onclick={() => mover(i, pos[i]! + 1)} disabled={final || pos[i] === m.valores.length - 1} aria-label={`Subir ${plano(m.nombre)} un paso`} data-mas={i}><ChevronRight size={20} aria-hidden="true" /></button>
      </div>
      <div class="extremos" aria-hidden="true">
        <span>{textoValor(m.valores[0]!, m.unidad)}</span>
        <span>{m.unidad === 'Ω' ? 'Valores E96' : 'Pasos de ' + textoValor(Math.abs(m.valores[1]! - m.valores[0]!), m.unidad)}</span>
        <span>{textoValor(m.valores[m.valores.length - 1]!, m.unidad)}</span>
      </div>
    </div>
  {/each}

  <div class="p10-lectura" class:ok={ev?.bien} data-cercania={ev ? ev.cercania.toFixed(2) : undefined}>
    <span class="que">{@html prepararHtml(item.observa.nombre)}</span>
    <span class="medida" data-medida>
      {#if leyendo}simulando…{:else if lectura?.valor != null}{textoValor(Math.abs(lectura.valor), item.observa.unidad)}{:else}—{/if}
    </span>
    <span class="meta">objetivo: {textoValor(item.objetivo, item.observa.unidad)} {tolTexto}</span>
    <div class="medidor" aria-hidden="true">
      <span class="zona"></span>
      {#if ev && Number.isFinite(ev.rel)}<span class="aguja" style:left={`${50 + Math.max(-50, Math.min(50, ev.rel * 50))}%`}></span>{/if}
    </div>
  </div>
  <p class="distancia" aria-live="polite" data-distancia>
    {#if ev && !leyendo}
      {ev.mensaje + (tendencia === 'cerca' ? ' Más cerca que antes.' : tendencia === 'lejos' ? ' Más lejos que antes.' : '')}
    {:else if !movido}
      Mueva {item.mandos.length > 1 ? 'los controles' : 'el control'}: cada posición se simula con ngspice.
    {/if}
  </p>

  {#if final}
    <div class="p10-solucion" data-desarrollo>
      <span class="rot">El desarrollo</span>
      <p>Su ajuste: {#each item.mandos as m, i (m.id)}{i ? ' y ' : ''}{@html prepararHtml(m.nombre)} = <strong>{textoValor(valores[m.id]!, m.unidad)}</strong>{/each}{#if lectura?.valor != null}, que da {textoValor(Math.abs(lectura.valor), item.observa.unidad)}{/if}.</p>
      {#each item.desarrollo as d, i (i)}<p>{@html prepararHtml(d)}</p>{/each}
    </div>
  {/if}
</div>

<style>
  .reto {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .capa-vivo {
    position: relative;
  }
  .vivo {
    align-self: center;
    box-sizing: border-box;
    padding: 6px;
  }
  .cargando {
    width: min(100%, 320px);
    height: 200px;
  }
  .mando {
    display: flex;
    flex-direction: column;
    gap: 4px;
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
  .fila {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .paso {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border: 1px solid var(--linea);
    border-radius: 12px;
    background: var(--superficie);
    color: var(--tinta);
  }
  .paso:hover:not(:disabled) {
    background: var(--hover);
  }
  .paso:disabled {
    opacity: 0.45;
  }
  input[type='range'] {
    flex: 1;
    min-width: 0;
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
  .que {
    color: var(--tinta-suave);
    font-size: 14px;
  }
  .medida {
    grid-row: span 2;
    align-self: center;
    font-size: 22px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .meta {
    color: var(--tinta);
    font-size: 14px;
    font-weight: 600;
  }
  .medidor {
    position: relative;
    grid-column: 1 / -1;
    height: 10px;
    margin-top: 8px;
    border-radius: 5px;
    background: var(--superficie-2);
  }
  .zona {
    position: absolute;
    top: 0;
    bottom: 0;
    left: calc(50% - 4px);
    width: 8px;
    border-radius: 3px;
    background: var(--ok);
  }
  .aguja {
    position: absolute;
    top: -4px;
    width: 4px;
    height: 18px;
    margin-left: -2px;
    border-radius: 2px;
    background: var(--tinta);
    transition: left 0.2s ease;
  }
  @media (prefers-reduced-motion: reduce) {
    .aguja {
      transition: none;
    }
  }
  .distancia {
    min-height: 1.45em;
    margin: 0;
    color: var(--tinta);
    font-size: 15.5px;
    line-height: 1.45;
  }
  .p10-solucion p {
    margin: 0;
    font-size: 16px;
  }
</style>
