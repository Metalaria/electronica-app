<script lang="ts">
  // «Esquema y tensiones»: the part selected on the schematic, the multimeter, and the book's voltage map
  // (sections 15.11.2 and 15.21, figure 15.28) next to the simulated operating point of the whole kit.
  import type { EstadoKit } from './estado.svelte';
  import { fx, si } from './formato';
  import FichaPieza from './FichaPieza.svelte';
  import Multimetro from './Multimetro.svelte';
  import Cita from './ui/Cita.svelte';
  import Modelado from './ui/Modelado.svelte';

  let { k }: { k: EstadoKit } = $props();

  const filas = $derived(
    k.kit.mapa.map((m) => {
      const v = k.tension(m.nodo);
      return { m, v, ok: v == null ? null : Math.abs(v - m.esperado) <= m.esperado * m.tol };
    }),
  );

  function medir(nodo: string, pieza?: string) {
    k.roja = nodo;
    k.negra = 'N0';
    if (pieza) k.elegirPieza(pieza);
    else k.enfocarNodo(nodo);
  }

  let busqueda = $state('');
  const refs = $derived(Object.keys(k.kit.componentes).sort((a, b) => a.localeCompare(b, 'es', { numeric: true })));
  function buscar(ev: SubmitEvent) {
    ev.preventDefault();
    const q = busqueda.trim().toUpperCase().replace(/\s+/g, '');
    const r = refs.find((x) => x.toUpperCase() === q) ?? refs.find((x) => x.toUpperCase().startsWith(q));
    if (r) k.elegirPieza(r);
  }
</script>

<div class="panel-esquema">
  {#if k.pieza}
    <FichaPieza {k} ref={k.pieza} />
  {:else}
    <p class="intro">
      Toque cualquier componente del esquema para ver su función, la sección del libro que lo explica y su animación. Los puntos
      que se mueven son la corriente continua y el color de los cables, su tensión, del punto de trabajo simulado con ngspice.
    </p>
  {/if}
  <form class="buscar" onsubmit={buscar}>
    <label for="fm-buscar">Buscar componente</label>
    <input id="fm-buscar" list="fm-refs" bind:value={busqueda} placeholder="R13, C38, IC3…" autocomplete="off" />
    <datalist id="fm-refs">{#each refs as r (r)}<option value={r}></option>{/each}</datalist>
    <button type="submit">Ir</button>
  </form>

  <section>
    <h3>Multímetro</h3>
    <Multimetro {k} />
  </section>

  <section>
    <h3>Mapa de tensiones</h3>
    <p class="nota">
      Valores del libro <Cita cita={k.kit.citas['railes']} /> <Cita cita={k.kit.citas['mapa_fig']} /> frente al modelo simulado. Tolerancia: ±5 % en
      las alimentaciones y ±10 % en las polarizaciones <Cita cita={k.kit.citas['tolerancia']} corto />.
    </p>
    <table class="mapa" data-mapa>
      <thead><tr><th>Punto</th><th>Libro</th><th>Simulado</th><th></th></tr></thead>
      <tbody>
        {#each filas as f (f.m.id)}
          <tr data-punto={f.m.id} data-simulado={f.v == null ? '' : f.v.toFixed(3)} class:activa={k.roja === f.m.nodo}>
            <td><button type="button" class="medir" onclick={() => medir(f.m.nodo, f.m.pieza)}>{f.m.nombre}</button></td>
            <td class="num">{f.m.aprox ? '≈ ' : ''}{fx(f.m.esperado, 1)} V <Cita cita={k.kit.citas[f.m.cita]} corto /></td>
            <td class="num">{f.v == null ? '…' : `${fx(f.v, 2)} V`}</td>
            <td class="estado">{#if f.ok === true}<span class="si" title="Dentro de la tolerancia">✓</span>{:else if f.ok === false}<span class="no" title="Fuera de la tolerancia">✗</span>{/if}</td>
          </tr>
        {/each}
      </tbody>
    </table>
    {#if k.dc?.consumo != null}
      <p class="nota">Consumo en reposo (simulado): <b>{si(k.dc.consumo, 'A', 3)}</b>. El libro: «del orden de un centenar de miliamperios como mucho» <Cita cita={k.kit.citas['consumo']} corto /></p>
    {/if}
    {#if k.dcEstado === 'error'}<p class="error">{k.dcError}</p>{/if}
  </section>

  <details class="supuestos">
    <summary>Cómo se ha modelado la continua <Modelado /></summary>
    <ul>
      <li>Todas las resistencias, condensadores, bobinas, diodos y el transistor con los valores del esquema original (figura 15.26). El 9018 y los diodos, con los modelos de las netlists del capítulo.</li>
      <li>78L06 y AMS1117 como reguladores ideales con su caída mínima; corrientes de reposo supuestas de 3 y 5 mA.</li>
      <li>Integrados como macromodelos: solo su consumo y las tensiones que da el libro. TA7358AP, 6 mA en total; TA7343AP con su LED, 18 mA (la corriente que hace caer 4 V en R13); TEA2025, 35 mA y salidas a media alimentación; TA7303P con TP3 = 4,6 V centrado por B2 y la salida del medidor que da el modelo de la alineación. Supuestos: 6 mA para el TA7303P y 2 + 1,5 mA para el TA7061BP.</li>
      <li>Las patillas cuya tensión depende de la polarización interna del integrado (y que el libro no da) se dejan sin valor: el multímetro muestra «—».</li>
      <li>Display: 3 mA. Medidor de aguja: 10 MΩ. L3: 6 Ω de resistencia de hilo.</li>
    </ul>
  </details>
</div>

<style>
  .panel-esquema {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  section h3 {
    margin: 0 0 8px;
    font-size: 15px;
    color: var(--titulos);
  }
  .intro,
  .nota {
    margin: 0;
    font-size: 13.5px;
    line-height: 1.45;
    color: var(--tinta-suave);
  }
  .nota {
    margin: 6px 0;
    font-size: 12.5px;
  }
  .buscar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    font-size: 13px;
  }
  .buscar label {
    width: 100%;
    font-weight: 600;
  }
  .buscar input {
    flex: 1;
    min-width: 0;
    min-height: 44px;
    padding: 0 10px;
    border: 1px solid var(--linea);
    border-radius: 10px;
    background: var(--superficie);
    color: var(--tinta);
    font: inherit;
    font-size: 15px;
  }
  .buscar button {
    min-height: 44px;
    padding: 0 16px;
    border: 1px solid var(--acento-borde);
    border-radius: 10px;
    background: var(--acento-tinte);
    color: var(--acento);
    font: 600 14px var(--sans);
    cursor: pointer;
  }
  .mapa {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }
  .mapa th {
    text-align: left;
    color: var(--tinta-suave);
    font-weight: 600;
    padding: 4px;
    border-bottom: 1px solid var(--linea);
  }
  .mapa td {
    padding: 2px 4px;
    border-bottom: 1px solid var(--linea-suave);
    vertical-align: middle;
  }
  .mapa tr.activa td {
    background: var(--acento-tinte);
  }
  .medir {
    min-height: 40px;
    padding: 2px 0;
    border: 0;
    background: none;
    color: var(--tinta);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .medir:hover {
    color: var(--acento);
    text-decoration: underline;
  }
  .num {
    white-space: nowrap;
  }
  .si {
    color: #1e8449;
    font-weight: 700;
  }
  .no {
    color: #b03a2e;
    font-weight: 700;
  }
  .error {
    color: #b03a2e;
    font-size: 13px;
  }
  .supuestos {
    font-size: 13px;
    line-height: 1.45;
  }
  .supuestos summary {
    min-height: 40px;
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
    cursor: pointer;
  }
  .supuestos ul {
    margin: 4px 0 0;
    padding-left: 18px;
    color: var(--tinta-suave);
  }
</style>
