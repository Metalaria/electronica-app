<script lang="ts">
  // Link with the simulator: the chapter's companion netlists (spice.json), the project's own SPICE files, and
  // the DC voltage of every board net that has one (annotated in the schematic or simulated with the
  // project's models, which use the board's references and net names).
  import { app } from '../../lib/estado.svelte';
  import { prepararSalto } from '../../lib/ruta.svelte';
  import { formatoTension, type DatosPlaca, type Proyecto } from './datos';
  import type { Seleccion } from './estado';
  import { colorTension } from './pintar';

  let { datos, proyecto, elegir }: { datos: DatosPlaca; proyecto: Proyecto; elegir: (s: Seleccion, vista: 'placa' | '3d') => void } = $props();

  const conTension = $derived(
    datos.redes
      .filter((r) => r.v)
      .sort((a, b) => b.v!.v - a.v!.v || a.n.localeCompare(b.n)),
  );
  const anotadas = $derived(conTension.some((r) => r.v!.origen === 'anotacion'));
  const simuladas = $derived(conTension.some((r) => r.v!.origen === 'simulacion'));
  const ANALISIS: Record<string, string> = { op: 'punto de trabajo', dc: 'barrido DC', ac: 'alterna', tran: 'transitorio', noise: 'ruido' };

  function ref(label: string | null): string {
    if (!label) return '';
    const r = app.refs[label];
    return r ? `${r.tipo === 'fig' ? 'figura' : r.tipo === 'sec' ? 'sección' : r.tipo} ${r.num}` : '';
  }
</script>

<div class="sim">
  <section>
    <h2>Netlists del capítulo {proyecto.capitulo} en el simulador</h2>
    {#if proyecto.netlists.length}
      <ul class="netlists">
        {#each proyecto.netlists as n (n.id)}
          <li>
            <a href={`#/simulador/${n.id}`} onclick={() => prepararSalto({ texto: 'Volver a la placa' })}>
              <strong>{n.titulo}</strong>
              <span>{n.analisis.map((a) => ANALISIS[a] ?? a).join(', ')}{#if n.ref} · {ref(n.ref)}{/if}</span>
            </a>
          </li>
        {/each}
      </ul>
    {:else}
      <p>Este capítulo no tiene netlists en el simulador.</p>
    {/if}
    <p class="nota">
      Son las netlists del libro (<code>complementos/spice/{proyecto.parte}</code>), que estudian partes del circuito con los valores del
      capítulo. El proyecto KiCad trae además sus propias simulaciones en <code>{proyecto.carpeta}/spice/</code>:
      {proyecto.netlists_proyecto.join(', ')}.
    </p>
  </section>

  <section>
    <h2>Tensiones de continua en la placa</h2>
    {#if conTension.length}
      <p class="nota">
        {#if simuladas && datos.simulacion}
          Punto de trabajo calculado con ngspice a partir de los modelos del proyecto (<code>{datos.simulacion.fuente}</code>), que usan las
          mismas referencias y los mismos nombres de red que la placa: <em>{datos.simulacion.titulo}</em>. Las redes se emparejan por su
          nombre exacto; las que no aparecen en el modelo no tienen tensión.
        {/if}
        {#if anotadas}
          Tensiones esperadas anotadas por el proyecto en su esquema («ANOTACIONES»), no simuladas.
        {/if}
        Actívalas con «Tensiones» en la vista 2D o 3D para ver el cobre coloreado.
      </p>
      <table>
        <thead><tr><th>Red</th><th>Tensión</th><th>Origen</th><th></th></tr></thead>
        <tbody>
          {#each conTension as r (r.n)}
            <tr>
              <td><button type="button" class="red" onclick={() => elegir({ tipo: 'red', id: r.n }, 'placa')}><i style:background={colorTension(r.v!.v)}></i>{r.n}</button></td>
              <td class="v">{formatoTension(r.v!.v)}</td>
              <td class="o">{r.v!.origen === 'simulacion' ? 'simulada' : r.v!.texto ?? 'anotada'}</td>
              <td><button type="button" class="ver" onclick={() => elegir({ tipo: 'red', id: r.n }, '3d')}>3D</button></td>
            </tr>
          {/each}
        </tbody>
      </table>
    {:else}
      <p class="nota">
        Esta placa no tiene tensiones en sus redes: ni el esquema las anota ni hay un modelo SPICE del proyecto con los nombres de red de la
        placa (las simulaciones de <code>{proyecto.carpeta}/spice/</code> modelan bloques con otros nombres de nodo), así que emparejarlas
        no sería fiable.
      </p>
    {/if}
  </section>
</div>

<style>
  .sim {
    display: grid;
    gap: 18px;
    max-width: 900px;
    padding: 6px 0 20px;
  }
  h2 {
    margin: 0 0 8px;
    color: var(--titulos);
    font-size: 18px;
  }
  .nota {
    color: var(--tinta-suave);
    font-size: 14px;
    line-height: 1.5;
  }
  .netlists {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .netlists a {
    display: grid;
    gap: 2px;
    min-height: 44px;
    padding: 8px 12px;
    border: 1px solid var(--linea);
    border-radius: 10px;
    background: var(--superficie);
    color: var(--tinta);
    text-decoration: none;
  }
  .netlists a:hover {
    border-color: var(--acento);
  }
  .netlists span {
    color: var(--tinta-suave);
    font-size: 13px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }
  th,
  td {
    padding: 2px 6px;
    border-bottom: 1px solid var(--linea-suave);
    text-align: left;
  }
  td.v {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  td.o {
    color: var(--tinta-suave);
    font-size: 13px;
  }
  .red,
  .ver {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 36px;
    padding: 0 8px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--acento);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }
  .red i {
    width: 12px;
    height: 12px;
    border-radius: 3px;
  }
  @media (pointer: coarse) {
    .red,
    .ver {
      min-height: 44px;
    }
  }
</style>
