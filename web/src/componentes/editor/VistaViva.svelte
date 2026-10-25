<script lang="ts">
  // The drawn circuit, simulated: the live layer of the book's figures (figuras-vivas) over the editor's
  // drawing — node colours, current particles (animated along the transient), hover/tap cards, playback —
  // plus a tag with the voltage of every node and the current of every two-terminal part. The circuit is
  // solved once more with 0 V ammeters on every pin (instrumentar), as on the simulator page.
  import { untrack } from 'svelte';
  import type { Simulacion } from '../../simulador/motor/simular.ts';
  import type { DatosFigura, DibujoConNetlist } from '../figuras-vivas/tipos';
  import { EstadoEsquema } from '../figuras-vivas/esquema/modelo.svelte';
  import { EstadoGraficas } from '../figuras-vivas/grafica/estado.svelte';
  import { instrumentar, resultados } from '../figuras-vivas/circuito/netlist.ts';
  import { pagina } from '../figuras-vivas/carga.svelte';
  import { formatoSI } from '../grafica/formato.ts';
  import Escenario from '../figuras-vivas/Escenario.svelte';
  import PanelEsquema from '../figuras-vivas/esquema/PanelEsquema.svelte';

  let {
    dibujo,
    texto,
    resultado,
    alto = 0,
  }: {
    dibujo: DibujoConNetlist;
    /** The netlist that was simulated. */
    texto: string;
    /** The page's result: each new one re-solves the drawing. */
    resultado: Simulacion | null;
    /** Height available (px) for the plate; 0 = natural size. */
    alto?: number;
  } = $props();

  const est = $derived(new EstadoEsquema(dibujo.esquemas[0]!, 0, true));
  const estadoG = new EstadoGraficas();
  let valores = $state(true);

  const datos = $derived<DatosFigura>({
    version: 1,
    nombre: 'editor',
    tipo: 'esquema',
    lienzo: { svg: { ancho: dibujo.vista[2], alto: dibujo.vista[3], fig_a_svg: { sx: 1, tx: 0, sy: 1, ty: 0 } } },
    ejes: [],
    esquemas: dibujo.esquemas,
  });
  const src = $derived(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(dibujo.svg)}`);

  $effect(() => {
    const e = est;
    const r = resultado;
    untrack(() => {
      if (r) void resolver(e);
    });
  });

  async function resolver(e: EstadoEsquema) {
    const corr = dibujo.correspondencia[0];
    if (!corr) return;
    const ins = instrumentar(texto, [corr], true);
    e.estadoSim = 'simulando';
    e.mensaje = '';
    const { simularTexto, SimulacionCancelada } = await import('../../simulador/cliente.svelte');
    try {
      const sim = await simularTexto(ins.texto);
      if (e !== est) return;
      const r = resultados(e.esq, corr, ins, sim.ejecucion.graficas);
      if (!r.op && !r.tran) {
        e.estadoSim = 'error';
        e.mensaje = 'ngspice no ha podido resolver el punto de trabajo del circuito dibujado.';
        return;
      }
      e.op = r.op;
      e.tran = r.tran;
      e.estadoSim = 'libro';
    } catch (x) {
      if (x instanceof SimulacionCancelada) {
        e.estadoSim = 'libro';
        return;
      }
      e.estadoSim = 'error';
      e.mensaje = x instanceof Error ? x.message : String(x);
    }
  }

  // Value tags: one per node (on its longest wire) and one per two-terminal part (under its body).
  const sitios = $derived.by(() => {
    const nodos: { id: string; x: number; y: number }[] = [];
    for (const n of est.nodos) {
      if (n.tierra) continue;
      let mejor: [number, number] | null = null;
      let largo = -1;
      for (const t of n.tramos) {
        for (let i = 0; i + 1 < t.length; i++) {
          const a = t[i]!;
          const b = t[i + 1]!;
          const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
          if (L > largo) {
            largo = L;
            mejor = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
          }
        }
      }
      const p = mejor ?? n.terminales[0]?.p ?? null;
      if (p) nodos.push({ id: n.id, x: p[0], y: p[1] });
    }
    const elems: { id: string; x: number; y: number; ancla: 'start' | 'middle' | 'end' }[] = [];
    const A = est.esq.dibujo_a_svg;
    for (const g of est.elementos) {
      const t = g.e.terminales ?? {};
      const v = g.e.anclas['valor'];
      if (!v || !('start' in t) || !('end' in t) || Object.keys(t).length !== 2 || ['GND', 'RAIL', 'ANOT'].includes(g.e.rol)) continue;
      const x = A.sx * v[0] + A.tx;
      const y = A.sy * v[1] + A.ty;
      elems.push({ id: g.e.id, x, y, ancla: x < g.centro[0] - 2 ? 'end' : x > g.centro[0] + 2 ? 'start' : 'middle' });
    }
    return { nodos, elems };
  });
  const hayValores = $derived(!!est.op || !!est.tran);
</script>

<div class="viva">
  <div class="placa" style:--proporcion={dibujo.vista[2] / dibujo.vista[3]} style:--alto={alto ? `${alto}px` : '60vh'} style:--ancho-max={`${Math.round(dibujo.vista[2] * 1.7 + 22)}px`}>
    <div class="marco">
      <Escenario {src} alt="Esquema simulado" vista={dibujo.vista} {datos} grupos={[]} esquemas={[est]} {estadoG} activo={pagina.visible} />
      {#if valores && hayValores}
        <svg class="valores" viewBox={dibujo.vista.join(' ')} aria-hidden="true">
          {#each sitios.nodos as s (s.id)}
            {@const v = est.tension(s.id)}
            {#if v != null}<text class="v" x={s.x} y={s.y - 4} text-anchor="middle">{formatoSI(v, 'V', 3)}</text>{/if}
          {/each}
          {#each sitios.elems as s (s.id)}
            {@const i = est.corriente({ k: 'elem', id: s.id })}
            {#if i != null}<text class="i" x={s.x} y={s.y} text-anchor={s.ancla}>{formatoSI(Math.abs(i) < 1e-15 ? 0 : i, 'A', 3)}</text>{/if}
          {/each}
        </svg>
      {/if}
    </div>
  </div>
  <label class="interruptor"><input type="checkbox" bind:checked={valores} /> Mostrar las tensiones de los nodos y las corrientes</label>
  <PanelEsquema {est} />
</div>

<style>
  .viva {
    display: grid;
    gap: 8px;
  }
  .placa {
    width: min(100%, var(--ancho-max), calc(var(--alto) * var(--proporcion)));
    margin: 0 auto;
    padding: 10px;
    border: 1px solid var(--linea-suave);
    border-radius: 10px;
    background: var(--placa);
    box-sizing: border-box;
  }
  .marco {
    position: relative;
  }
  .valores {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    overflow: visible;
    font-family: var(--sans);
  }
  .valores text {
    font-size: 9.5px;
    font-weight: 600;
    paint-order: stroke;
    stroke: #ffffff;
    stroke-width: 3px;
    stroke-linejoin: round;
  }
  .v {
    fill: #a93226;
  }
  .i {
    fill: #1f5f99;
  }
  .interruptor {
    font-size: 13.5px;
    color: var(--tinta-suave);
  }
  .viva :global(.panel-e) {
    max-width: none;
  }
</style>
