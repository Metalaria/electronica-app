<script lang="ts">
  // Results of a simulation: plots of the vectors, measurements (.meas / print), operating point, raw output.
  import type { Simulacion } from '../../simulador/motor/simular.ts';
  import type { Grafica as GraficaMotor } from '../../simulador/motor/nucleo.ts';
  import { Grafica, PlotLink, formatoSI, type Series } from '../grafica';
  import {
    claseDe,
    nombreGrafica,
    paneles,
    seleccionInicial,
    unidadDe,
    vectoresDibujables,
    type Panel,
  } from '../../simulador/graficas';
  import { app } from '../../lib/estado.svelte';

  interface Props {
    resultado: Simulacion;
    /** Pinned earlier result, drawn as a faint trace. */
    referencia?: Simulacion | null;
  }
  let { resultado, referencia = null }: Props = $props();

  const multiples = $derived(resultado.ejecucion.graficas.filter((g) => g.puntos > 1));
  const unPunto = $derived(resultado.ejecucion.graficas.filter((g) => g.puntos === 1));

  let elegida = $state<string | null>(null);
  const grafica = $derived<GraficaMotor | undefined>(multiples.find((g) => g.id === elegida) ?? multiples[0]);
  /** Vector selection per plot class, kept across runs (sliders) and between plots of the same class. */
  let selecciones = $state<Record<string, string[]>>({});
  let db = $state(true);
  let superponer = $state(false);

  const claveSel = $derived(grafica ? `${claseDe(grafica)}:${grafica.vectores.slice(1).map((v) => v.nombre).join(',')}` : '');
  const seleccion = $derived.by(() => {
    if (!grafica) return [];
    const s = selecciones[claveSel];
    if (s) return s.filter((n) => grafica.vectores.some((v) => v.nombre === n));
    return seleccionInicial(grafica);
  });
  const mismasClase = $derived(grafica ? multiples.filter((g) => claseDe(g) === claseDe(grafica)).length : 0);

  function alternar(nombre: string) {
    const s = seleccion.includes(nombre) ? seleccion.filter((n) => n !== nombre) : [...seleccion, nombre];
    selecciones[claveSel] = s;
  }

  const lista = $derived<Panel[]>(grafica ? paneles(multiples, grafica, seleccion, { db, superponer: superponer && mismasClase > 1 }) : []);

  // The reference result's curves for the same plot and vectors.
  const trazas = $derived.by(() => {
    const m = new Map<string, Series[]>();
    if (!referencia || !grafica) return m;
    const refs = referencia.ejecucion.graficas.filter((g) => g.puntos > 1);
    const g = refs.find((x) => x.id === grafica.id) ?? refs.find((x) => claseDe(x) === claseDe(grafica));
    if (!g) return m;
    for (const p of paneles(refs, g, seleccion, { db, superponer: superponer && mismasClase > 1 })) m.set(p.clave, p.series);
    return m;
  });

  // One link per plot shown: x zoom, crosshair and cursors move together across its panels.
  // Keyed by plot id (a string), so a new run of the same plot keeps the zoom and the cursors.
  const claveVinculo = $derived(`${grafica?.id}|${superponer}`);
  const vinculo = $derived.by(() => {
    void claveVinculo;
    return new PlotLink();
  });

  const alto = $derived(app.movil ? 230 : 290);

  // ------------------------------------------------------------------ measurements

  function unidadMedida(nombre: string): string {
    if (/^v\(/i.test(nombre)) return 'V';
    if (/^i\(/i.test(nombre)) return 'A';
    if (/^vdb\(/i.test(nombre)) return 'dB';
    return '';
  }

  const secciones = $derived(resultado.salida.secciones);
  const hayMedidas = $derived(secciones.some((s) => s.medidas.length));

  // ------------------------------------------------------------------ operating point (one-point plots)
  const tablaOp = $derived.by(() => {
    if (!unPunto.length) return null;
    const filas = new Map<string, { unidad: string; valores: (number | null)[] }>();
    unPunto.forEach((g, k) => {
      for (const v of g.vectores) {
        let f = filas.get(v.nombre);
        if (!f) {
          f = { unidad: unidadDe(v, g), valores: unPunto.map(() => null) };
          filas.set(v.nombre, f);
        }
        f.valores[k] = v.im ? Math.hypot(v.re[0]!, v.im[0]!) : v.re[0]!;
      }
    });
    const orden = (n: string) => (/^v\(/.test(n) || !/[()]/.test(n) ? 0 : /^i\(|#branch/.test(n) ? 1 : 2);
    return {
      columnas: unPunto.map((g) => g.id),
      filas: [...filas.entries()].sort((a, b) => orden(a[0]) - orden(b[0])),
    };
  });
  let filtroOp = $state('');
  const filasOp = $derived(
    tablaOp ? tablaOp.filas.filter(([n]) => !filtroOp || n.toLowerCase().includes(filtroOp.toLowerCase())) : [],
  );
</script>

<div class="resultados">
  {#if multiples.length}
    <section class="bloque" aria-label="Gráficas">
      {#if multiples.length > 1}
        <div class="analisis" role="tablist" aria-label="Análisis">
          {#each multiples as g (g.id)}
            <button role="tab" aria-selected={g === grafica} class="chip" onclick={() => (elegida = g.id)}>{nombreGrafica(g)}</button>
          {/each}
        </div>
      {/if}
      {#if grafica}
        <div class="opciones">
          <div class="vectores" role="group" aria-label="Vectores">
            {#each vectoresDibujables(grafica) as v (v.nombre)}
              <button class="chip vec" aria-pressed={seleccion.includes(v.nombre)} onclick={() => alternar(v.nombre)}>{v.nombre}</button>
            {/each}
          </div>
          <div class="interruptores">
            {#if grafica.complejo}
              <label><input type="checkbox" bind:checked={db} /> Magnitud en dB</label>
            {/if}
            {#if mismasClase > 1}
              <label><input type="checkbox" bind:checked={superponer} /> Superponer los {mismasClase} análisis</label>
            {/if}
          </div>
        </div>
        {#if !seleccion.length}
          <p class="nota">Elija uno o más vectores para dibujarlos.</p>
        {/if}
        {#each lista as p, k (p.clave)}
          {#if p.series.length}
            <div class="panel">
              <Grafica series={p.series} xAxis={p.xAxis} yAxis={p.yAxis} trace={trazas.get(p.clave) ?? []} link={vinculo} height={alto} help={k === lista.length - 1} ariaLabel={`${nombreGrafica(grafica)}: ${p.yAxis.label}`} />
            </div>
          {/if}
        {/each}
      {/if}
    </section>
  {/if}

  {#if hayMedidas}
    <section class="bloque" aria-label="Medidas">
      <h3>Medidas</h3>
      <div class="desliza">
        <table class="medidas">
          {#each secciones as s, k (k)}
            {#if s.titulo || s.notas.length}
              <tbody class="sec">
                <tr><th colspan="3">{s.titulo}{#each s.notas as n, j (j)}<span class="notas">{n}</span>{/each}</th></tr>
              </tbody>
            {/if}
            {#if s.medidas.length}
              <tbody>
                {#each s.medidas as m, j (j)}
                  <tr>
                    <td class="n">{m.nombre}</td>
                    <td class="v" title={String(m.valor)}>
                      {formatoSI(m.valor, unidadMedida(m.nombre))}{#if m.im !== undefined}<span class="im"> {m.im < 0 ? '−' : '+'} j{formatoSI(Math.abs(m.im), unidadMedida(m.nombre))}</span>{/if}
                    </td>
                    <td class="x">{m.extra ?? ''}</td>
                  </tr>
                {/each}
              </tbody>
            {/if}
          {/each}
        </table>
      </div>
    </section>
  {/if}

  {#if tablaOp}
    <section class="bloque" aria-label="Punto de trabajo">
      <div class="cab-op">
        <h3>{unPunto.every((g) => claseDe(g) === 'op') ? 'Punto de trabajo' : 'Resultados de un solo punto'}</h3>
        {#if tablaOp.filas.length > 12}
          <input class="filtro" type="search" placeholder="Filtrar nodos…" bind:value={filtroOp} aria-label="Filtrar nodos" />
        {/if}
      </div>
      <div class="desliza alto">
        <table class="op">
          <thead>
            <tr>
              <th>Vector</th>
              {#each tablaOp.columnas as c (c)}<th>{c}</th>{/each}
            </tr>
          </thead>
          <tbody>
            {#each filasOp as [nombre, f] (nombre)}
              <tr>
                <td class="n">{nombre}</td>
                {#each f.valores as val, j (j)}<td class="v">{val === null ? '' : formatoSI(val, f.unidad)}</td>{/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>
  {/if}

  {#if !multiples.length && !hayMedidas && !tablaOp && !resultado.salida.errores.length && !resultado.ejecucion.fallo}
    <p class="nota">La simulación ha terminado sin gráficas ni medidas. Revise la salida de ngspice.</p>
  {/if}
</div>

<style>
  .resultados {
    display: grid;
    gap: 18px;
    min-width: 0;
    font-family: var(--sans);
  }
  .bloque {
    min-width: 0;
  }
  h3 {
    margin: 0 0 8px;
    font-size: 15px;
    color: var(--titulos);
  }
  .analisis,
  .vectores {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .analisis {
    margin-bottom: 10px;
  }
  .chip {
    min-height: 32px;
    padding: 0 12px;
    border: 1px solid var(--linea);
    border-radius: 999px;
    background: var(--superficie);
    color: var(--tinta-suave);
    font-size: 13.5px;
    font-weight: 600;
  }
  .chip[aria-selected='true'],
  .chip[aria-pressed='true'] {
    background: var(--acento-tinte);
    border-color: var(--acento-borde);
    color: var(--acento);
  }
  .chip.vec {
    font-family: var(--mono);
    font-weight: 500;
    font-size: 12.5px;
    min-height: 30px;
    padding: 0 10px;
  }
  .opciones {
    display: grid;
    gap: 8px;
    margin-bottom: 10px;
  }
  .interruptores {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 16px;
    font-size: 13.5px;
    color: var(--tinta-suave);
  }
  .interruptores label {
    display: inline-flex;
    gap: 6px;
    align-items: center;
  }
  .panel + .panel {
    margin-top: 14px;
  }
  .nota {
    color: var(--tinta-suave);
    font-size: 14px;
    margin: 4px 0;
  }
  .desliza {
    overflow-x: auto;
    border: 1px solid var(--linea-suave);
    border-radius: 10px;
    background: var(--superficie);
  }
  .desliza.alto {
    max-height: 420px;
    overflow-y: auto;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    font-size: 14px;
    font-variant-numeric: tabular-nums;
  }
  td,
  th {
    padding: 5px 10px;
    border-bottom: 1px solid var(--linea-suave);
    text-align: left;
    vertical-align: baseline;
  }
  .sec th {
    padding-top: 10px;
    background: var(--superficie-2);
    color: var(--titulos);
    font-weight: 700;
    font-size: 13.5px;
  }
  .notas {
    display: block;
    font-weight: 400;
    color: var(--tinta-suave);
  }
  td.n {
    font-family: var(--mono);
    font-size: 13px;
    color: var(--tinta-suave);
    white-space: nowrap;
  }
  td.v {
    text-align: right;
    font-weight: 600;
    white-space: nowrap;
    color: var(--tinta);
  }
  td.x {
    color: var(--tinta-tenue);
    font-size: 12.5px;
    font-family: var(--mono);
  }
  .im {
    font-weight: 400;
  }
  .op thead th {
    position: sticky;
    top: 0;
    background: var(--superficie-2);
    font-size: 13px;
    color: var(--tinta-suave);
    text-align: right;
  }
  .op thead th:first-child {
    text-align: left;
  }
  .cab-op {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
  }
  .filtro {
    padding: 5px 10px;
    border: 1px solid var(--linea);
    border-radius: 8px;
    background: var(--superficie);
    font-size: 14px;
    margin-bottom: 8px;
  }
</style>
