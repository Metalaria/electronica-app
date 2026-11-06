<script lang="ts">
  // 1.0 «Reto de montar el circuito»: an empty breadboard with the bench supply of a design exercise of the book, the
  // tray with the parts it needs, and the exercise's specification as a checklist. «Comprobar» simulates whatever is
  // built (the board's own netlist, editor/netlist.ts) and measures what the exercise asks (construye.ts): any circuit
  // that does it is right, and each condition says in Spanish what it measured and what to change.
  import { onMount } from 'svelte';
  import Undo from '@lucide/svelte/icons/undo-2';
  import Redo from '@lucide/svelte/icons/redo-2';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import Check from '@lucide/svelte/icons/check';
  import X from '@lucide/svelte/icons/x';
  import { prepararHtml } from '../../lib/datos';
  import type { Componente } from '../editor/tipos';
  import type { DocumentoProtoboard, Pieza } from '../protoboard/tipos';
  import type { Protoboard } from '../protoboard/estado.svelte';
  import type { CartaBandeja } from '../protoboard/bandeja';
  import type { ItemConstruye } from './tipos';
  import type { Comprobacion } from './Practica.svelte';
  import { comprobarConstruccion, medidaDeOp, netlistMedida, textoCondicion, type ResultadoCondicion } from './construye';

  let { item, final, listo = $bindable(false) }: { item: ItemConstruye; final: boolean; listo?: boolean } = $props();

  type Mesa = import('../protoboard/Mesa.svelte').default;
  let pb = $state.raw<Protoboard | null>(null);
  let Mesa: typeof import('../protoboard/Mesa.svelte').default | null = $state.raw(null);
  let Bandeja: typeof import('../protoboard/Bandeja.svelte').default | null = $state.raw(null);
  let BarraPieza: typeof import('../protoboard/BarraPieza.svelte').default | null = $state.raw(null);
  let mesa: Mesa | undefined = $state();
  let cartas = $state.raw<CartaBandeja[]>([]);
  let error = $state('');
  let resultados = $state<ResultadoCondicion[] | null>(null);
  let vacio: DocumentoProtoboard | null = null;
  let brillos = $state.raw<typeof import('../protoboard/comprobaciones').brillos | null>(null);

  const EXTRA: Record<string, CartaBandeja> = { DZ51: { clave: 'DZ51', tipo: 'DZ', campos: { modelo: 'DZ51' }, nombre: 'Zener 5,1 V' } };

  onMount(() => {
    void (async () => {
      try {
        const [est, v, b, mesaM, bandejaM, barraM, comp] = await Promise.all([
          import('../protoboard/estado.svelte'),
          import('../protoboard/vacio'),
          import('../protoboard/bandeja'),
          import('../protoboard/Mesa.svelte'),
          import('../protoboard/Bandeja.svelte'),
          import('../protoboard/BarraPieza.svelte'),
          import('../protoboard/comprobaciones'),
        ]);
        vacio = v.montajeVacio(`Ejercicio ${item.ejercicio.num}`, String(item.alimentacion));
        cartas = item.cartas.map((k) => b.CARTAS.find((c) => c.clave === k) ?? EXTRA[k]).filter((c): c is CartaBandeja => !!c);
        brillos = comp.brillos;
        const p = new est.Protoboard();
        p.cargar(JSON.parse(JSON.stringify(vacio)) as DocumentoProtoboard);
        Mesa = mesaM.default;
        Bandeja = bandejaM.default;
        BarraPieza = barraM.default;
        pb = p;
        // tests drive the board through its own API
        (window as unknown as { __epaConstruye?: Protoboard }).__epaConstruye = p;
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }
    })();
  });

  // Anything built can be checked; a change after a check clears the verdicts.
  let versionComprobada = -1;
  $effect(() => {
    listo = !!pb && pb.doc.piezas.length > 1;
    if (pb && resultados && pb.version !== versionComprobada) resultados = null;
  });

  const encendidos = $derived(pb && brillos ? brillos(pb.doc, pb.con, pb.op, new Map(pb.nl.instancias.map((i) => [i.comp, i.nombre]))) : {});

  function arrastre(fase: 'mover' | 'soltar' | 'cancelar', cx: number, cy: number, x: Componente | Pieza, dedo: boolean): boolean {
    if (!mesa) return false;
    if (fase === 'mover') return mesa.fantasma(cx, cy, x, dedo);
    if (fase === 'soltar') return mesa.soltarFantasma(cx, cy, x, dedo);
    mesa.quitarFantasma();
    return false;
  }

  export async function comprobar(): Promise<Comprobacion> {
    if (!pb) return { bien: false, nula: true, mensaje: 'La protoboard aún se está preparando.' };
    const nl = pb.nl;
    if (nl.errores.length) return { bien: false, nula: true, mensaje: `Antes de medir: ${nl.errores[0]!.texto}` };
    const version = pb.version;
    const texto = netlistMedida(nl.texto);
    try {
      const [{ simularTexto }, circ, sim] = await Promise.all([import('../../simulador/cliente.svelte'), import('./circuito'), import('../protoboard/simulacion')]);
      const r = await simularTexto(texto);
      const g = circ.graficaOp(r);
      if (!g) return { bien: false, nula: true, mensaje: `ngspice no encuentra el punto de trabajo de su circuito${r.salida.errores[0] ? `: ${r.salida.errores[0]}` : '.'}` };
      if (version === pb.version) pb.op = sim.leerPuntoTrabajo(r);
      const c = comprobarConstruccion(item.condiciones, medidaDeOp(texto, circ.vectoresOp(g)));
      resultados = c.resultados;
      versionComprobada = version;
      if (c.bien) return { bien: true };
      const fallos = c.resultados.filter((x) => !x.bien);
      return { bien: false, mensaje: fallos.map((x) => x.mensaje).join(' ') };
    } catch (e) {
      return { bien: false, nula: true, mensaje: `No se pudo simular: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  export function reintentar(): void {
    if (pb && vacio) pb.cargar(JSON.parse(JSON.stringify(vacio)) as DocumentoProtoboard);
    resultados = null;
  }
</script>

<div class="construye" data-construye={item.id}>
  <blockquote class="ejercicio">
    <span class="de">Del libro · Ejercicio {item.ejercicio.num}</span>
    <p>{@html prepararHtml(item.ejercicio.html)}</p>
  </blockquote>

  <div class="spec">
    <h3>Lo que se medirá al comprobar</h3>
    <ul data-condiciones>
      {#each item.condiciones as c, i (i)}
        {@const r = resultados?.[i]}
        <li class:bien={r?.bien} class:mal={r && !r.bien} data-condicion={c.k} data-estado={r ? (r.bien ? 'bien' : 'mal') : undefined}>
          <span class="marca" aria-hidden="true">{#if r?.bien}<Check size={16} strokeWidth={3} />{:else if r}<X size={16} strokeWidth={3} />{:else}·{/if}</span>
          <span>
            <span class="solo-lector">{r ? (r.bien ? 'Cumple: ' : 'No cumple: ') : ''}</span>{textoCondicion(c)}
            {#if r}<span class="medido">{r.mensaje}</span>{/if}
          </span>
        </li>
      {/each}
    </ul>
    <p class="ayuda">Vale cualquier circuito que lo cumpla: no se compara con un montaje concreto. La fuente ya está puesta a {item.alimentacion} V en los carriles.</p>
  </div>

  {#if error}
    <p class="error" role="alert">{error}</p>
  {:else if !pb || !Mesa || !Bandeja || !BarraPieza}
    <p class="cargando" aria-live="polite">Preparando la protoboard…</p>
  {:else}
    {@const M = Mesa}
    {@const B = Bandeja}
    {@const BP = BarraPieza}
    {@const p = pb}
    {#if !final}
      <div class="herramientas" role="toolbar" aria-label="Montaje">
        <button type="button" onclick={() => p.deshacer()} disabled={!p.puedeDeshacer} data-herr="deshacer"><Undo size={18} aria-hidden="true" /> Deshacer</button>
        <button type="button" onclick={() => p.rehacer()} disabled={!p.puedeRehacer} data-herr="rehacer"><Redo size={18} aria-hidden="true" /> Rehacer</button>
        <button type="button" onclick={reintentar} data-herr="reiniciar"><RotateCcw size={18} aria-hidden="true" /> Empezar de nuevo</button>
      </div>
      <p class="ayuda">Arrastre una pieza de la bandeja a la placa (o tóquela y toque la placa); toque un agujero y después otro para tender un cable. El valor se cambia en la barra que sale junto a la pieza.</p>
    {/if}
    {#if p.mensaje && !final}<p class="aviso" role="status">{p.mensaje}</p>{/if}
    <div class="caja-mesa" data-mesa>
      <M bind:this={mesa} pb={p} {encendidos} controles>
        {#snippet flotante(caja)}
          {#if !final}<BP pb={p} {caja} alMas={() => {}} />{/if}
        {/snippet}
      </M>
    </div>
    {#if !final}<div class="caja-bandeja"><B pb={p} alArrastrar={arrastre} soloCartas={cartas} /></div>{/if}
  {/if}

  {#if final}
    <div class="p10-solucion" data-desarrollo>
      <span class="rot">El desarrollo</span>
      <p>Una solución que cumple, simulada: {@html prepararHtml(item.referencia.descripcion)}.</p>
      <ul>
        {#each item.referencia.lecturas as l, i (i)}<li>{l}</li>{/each}
      </ul>
    </div>
  {/if}
</div>

<style>
  .construye {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .ejercicio {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 0;
    padding: 12px 14px;
    border-radius: 12px;
    background: var(--superficie-2);
  }
  .de,
  .spec h3 {
    margin: 0;
    color: var(--tinta-suave);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .ejercicio p {
    margin: 0;
    color: var(--tinta);
    font-family: var(--serif);
    font-size: 16px;
    line-height: 1.5;
  }
  .spec {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .spec ul {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .spec li {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 8px 12px;
    border: 1px solid var(--linea);
    border-radius: 12px;
    background: var(--superficie);
    color: var(--tinta);
    font-size: 15.5px;
    line-height: 1.4;
  }
  .spec li.bien {
    border-color: var(--ok);
    background: var(--ok-tinte);
  }
  .spec li.mal {
    border-color: var(--mal);
    background: var(--mal-tinte);
  }
  .marca {
    display: inline-flex;
    flex-shrink: 0;
    justify-content: center;
    width: 20px;
    padding-top: 1px;
    font-weight: 700;
  }
  .medido {
    display: block;
    margin-top: 2px;
    color: var(--tinta);
    font-size: 14.5px;
  }
  .ayuda,
  .cargando,
  .aviso {
    margin: 0;
    color: var(--tinta-suave);
    font-size: 14.5px;
    line-height: 1.45;
  }
  .error {
    margin: 0;
    color: var(--mal);
  }
  .herramientas {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .herramientas button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    padding: 0 12px;
    border: 1px solid var(--linea);
    border-radius: 12px;
    background: var(--superficie);
    color: var(--tinta);
    font-size: 15px;
    font-weight: 600;
  }
  .herramientas button:disabled {
    opacity: 0.45;
  }
  .caja-mesa {
    position: relative;
    height: min(62vh, 440px);
    min-height: 300px;
    border: 1px solid var(--linea);
    border-radius: 14px;
    overflow: hidden;
  }
  .caja-bandeja {
    border: 1px solid var(--linea);
    border-radius: 14px;
    overflow: hidden;
  }
  .p10-solucion p,
  .p10-solucion li {
    margin: 0;
    font-size: 16px;
  }
  .p10-solucion ul {
    margin: 0;
    padding-left: 20px;
  }
</style>
