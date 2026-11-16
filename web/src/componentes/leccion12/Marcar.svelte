<script lang="ts">
  // 1.2.1 (piloto121) «Marque en la gráfica»: the marker's keyboard and screen-reader controls (one native slider per
  // axis it moves along, over the positions the generator checked: lib/leccion12/hacer/motor-hacer.ts
  // posicionesMarca); the marker itself is dragged on the graph (GraficaLeccion.svelte). The marker's place lives in
  // the card's state (EstadoMarcar).
  import { formatoValor } from '../calculadoras/unidades';
  import { compilarModelo, posicionMasCercana, type Valores } from '../../lib/leccion11/modelo';
  import type { EstadoTarjeta } from '../../lib/leccion11/motor';
  import type { Leccion11, Tarjeta } from '../../lib/leccion11/tipos';
  import { graficaDe, posicionesMarca, yMarca } from '../../lib/leccion12/hacer/motor-hacer';
  import type { EstadoMarcar, Marcar } from '../../lib/leccion12/hacer/tipos';
  import { leerUnidades } from '../../lib/habla-matematicas';
  import TextoVivo from '../leccion11/TextoVivo.svelte';

  let { leccion, t, a, e, ea, valores, prefijo, valor, cambiar }: { leccion: Leccion11; t: Tarjeta; a: Marcar; e: EstadoTarjeta; ea: EstadoMarcar; valores: Valores; prefijo: string; valor: (id: string) => string; cambiar: (c: Partial<EstadoTarjeta>) => void } = $props();

  const mc = $derived(compilarModelo(leccion.modelo));
  const g = $derived(graficaDe(t)!);
  const xs = $derived(posicionesMarca(g.x, a.pasos));
  const ys = $derived(posicionesMarca(g.y, a.pasos));
  const kx = $derived(posicionMasCercana(xs, ea.x));
  const ky = $derived(posicionMasCercana(ys, ea.y));
  const y = $derived(yMarca(mc, g, a, valores, ea.x, ea.y));
  const fx = (v: number) => formatoValor(v, g.x.unidad, 3, true);
  const fy = (v: number) => (Number.isFinite(v) ? formatoValor(v, g.y.unidad, 3, true) : '—');

  function poner(x: number, yy: number) {
    if (e.resuelta) return;
    cambiar({ actividad: { ...ea, x, y: yy, movida: true }, comprobado: false, bien: null });
  }
</script>

<div class="a12 marcar" data-marcar>
  <p class="rotulo"><TextoVivo texto={a.rotulo} {valor} /></p>
  <p class="donde" data-marca-donde>
    {#if a.modo !== 'y'}<span>{fx(ea.x)}</span>{/if}{#if a.modo === 'xy'}<span aria-hidden="true"> · </span>{/if}{#if a.modo !== 'x' || Number.isFinite(y)}<span>{a.modo === 'x' ? ' → ' : ''}{fy(y)}</span>{/if}
  </p>
  {#if a.modo !== 'y'}
    <label class="eje">
      <span>Marca en el eje horizontal</span>
      <input
        type="range"
        min="0"
        max={a.pasos}
        step="1"
        value={kx}
        disabled={e.resuelta}
        aria-valuetext={leerUnidades(`${fx(xs[kx] ?? ea.x)}${a.modo === 'x' ? `, la curva da ${fy(y)}` : ''}`)}
        oninput={(ev) => poner(xs[Number((ev.currentTarget as HTMLInputElement).value)] ?? ea.x, ea.y)}
        id={`${prefijo}-marca-x`}
        data-marcador-x
      />
    </label>
  {/if}
  {#if a.modo !== 'x'}
    <label class="eje">
      <span>Marca en el eje vertical</span>
      <input
        type="range"
        min="0"
        max={a.pasos}
        step="1"
        value={ky}
        disabled={e.resuelta}
        aria-valuetext={leerUnidades(fy(ys[ky] ?? ea.y))}
        oninput={(ev) => poner(ea.x, ys[Number((ev.currentTarget as HTMLInputElement).value)] ?? ea.y)}
        id={`${prefijo}-marca-y`}
        data-marcador-y
      />
    </label>
  {/if}
  {#if !ea.movida}<p class="a12-suave">Arrastre la marca sobre la gráfica (o use {a.modo === 'xy' ? 'los deslizadores' : 'el deslizador'}).</p>{/if}
</div>

<style>
  .marcar {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .rotulo,
  .donde {
    margin: 0;
  }
  .rotulo {
    font-weight: 600;
  }
  .donde {
    font: 700 18px var(--v11-titular);
    font-variant-numeric: tabular-nums;
  }
  .eje {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 14px;
    color: var(--v11-tinta-suave);
  }
  input[type='range'] {
    width: 100%;
    min-height: 44px;
    accent-color: var(--v11-naranja);
  }
  input[type='range']:focus-visible {
    outline: 3px solid var(--v11-foco);
    outline-offset: 2px;
  }
  p {
    margin: 0;
  }
</style>
