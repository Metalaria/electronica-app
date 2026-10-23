<script lang="ts">
  // Values at the A/B cursors of each plot of a figure, with B − A (and 1/Δ for a time axis), like the
  // simulator's plots.
  import type { DatosFigura } from '../tipos';
  import { valoresEn, type Grupo } from './lectura';
  import type { EstadoGraficas } from './estado.svelte';
  import { ejeNumerico, nombreEje, si, valorEje } from '../formato';
  import { prepararHtml } from '../../../lib/datos';

  let { datos, grupos, estado }: { datos: DatosFigura; grupos: Grupo[]; estado: EstadoGraficas } = $props();

  const tablas = $derived.by(() =>
    grupos
      .filter((g) => g.xNumerico && estado.posiciones[g.principal])
      .map((g, n) => {
        const [a, b] = estado.posiciones[g.principal]!;
        const ex = g.ejeX;
        const va = valoresEn(g, a);
        const vb = valoresEn(g, b);
        const filas = va
          .map((v, i) => ({ serie: v.serie, ya: v.y, yb: vb[i]?.y ?? NaN }))
          .filter((f) => ejeNumerico(datos.ejes[f.serie.ejes]?.y))
          .slice(0, 6)
          .map((f) => {
            const ey = datos.ejes[f.serie.ejes]!.y!;
            return { ...f, ta: valorEje(f.ya, ey), tb: valorEje(f.yb, ey), td: valorEje(f.yb - f.ya, ey) };
          });
        const dx = b - a;
        let inv = '';
        if (ex.factor_si != null && ex.unidad_si === 's' && dx !== 0) inv = si(1 / Math.abs(dx * ex.factor_si), 'Hz', 4);
        const titulo = datos.ejes[g.principal]?.titulo || (grupos.length > 1 ? `Gráfica ${n + 1}` : '');
        return { g, titulo, xa: valorEje(a, ex), xb: valorEje(b, ex), dx: ex.escala === 'log' ? `×${(b / a).toLocaleString('es-ES', { maximumSignificantDigits: 4 })}` : valorEje(dx, ex), inv, filas, nombreX: nombreEje(ex) || 'x' };
      }),
  );
</script>

{#if tablas.length}
  <div class="cursores-fv">
    {#each tablas as t (t.g.principal)}
      <div class="desliza">
        <table>
          {#if t.titulo}<caption>{t.titulo}</caption>{/if}
          <thead><tr><th></th><th>A</th><th>B</th><th>B − A</th></tr></thead>
          <tbody>
            <tr class="x">
              <th scope="row">{t.nombreX}</th>
              <td>{t.xa}</td>
              <td>{t.xb}</td>
              <td>{t.dx}{#if t.inv}<span class="inv">1/Δ = {t.inv}</span>{/if}</td>
            </tr>
            {#each t.filas as f, i (i)}
              <tr>
                <th scope="row">
                  <svg width="12" height="8" aria-hidden="true"><line x1="1" y1="4" x2="11" y2="4" stroke={f.serie.color} stroke-width="2.5" stroke-linecap="round" /></svg>
                  {#if f.serie.html}{@html prepararHtml(f.serie.html)}{:else}{f.serie.nombre}{/if}
                </th>
                <td>{f.ta}</td>
                <td>{f.tb}</td>
                <td>{f.td}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/each}
    <p class="ayuda">Arrastre las líneas A y B sobre la gráfica.</p>
  </div>
{/if}

<style>
  .cursores-fv {
    margin: 0.5em auto 0;
    max-width: 46em;
    font-family: var(--sans);
  }
  .desliza {
    overflow-x: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }
  caption {
    padding: 2px 0 4px;
    color: var(--tinta-suave);
    font-size: 12.5px;
    font-weight: 600;
    text-align: left;
  }
  th,
  td {
    padding: 4px 8px;
    border-bottom: 1px solid var(--linea-suave);
    text-align: right;
    white-space: nowrap;
  }
  th[scope='row'],
  thead th:first-child {
    color: var(--tinta-suave);
    font-weight: 600;
    text-align: left;
  }
  thead th {
    color: var(--tinta-suave);
    font-weight: 600;
  }
  tr.x td {
    font-weight: 600;
  }
  .inv {
    display: block;
    color: var(--tinta-suave);
    font-size: 11.5px;
    font-weight: 400;
  }
  .ayuda {
    margin: 4px 0 0;
    color: var(--tinta-tenue);
    font-size: 12px;
  }
</style>
