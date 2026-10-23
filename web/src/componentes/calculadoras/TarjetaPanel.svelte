<script lang="ts" module>
  let siguiente = 0;
</script>

<script lang="ts">
  // The live card: one field per shared variable, every formula of the card evaluated at once.
  import type { Formula } from './tipos';
  import { formulasPorId, rutaCalculadora } from './datos.svelte';
  import { modeloTarjeta, evaluarTarjeta, fueraDeRango, type ModeloTarjeta } from './motor';
  import { formatoValor } from './unidades';
  import CampoValor from './CampoValor.svelte';
  import Icono from '../Icono.svelte';

  let { ids }: { ids: string[] } = $props();

  const idBase = `tarjeta${++siguiente}`;
  let modelo = $state<ModeloTarjeta | null>(null);
  let entradas = $state<Record<string, number>>({});
  let vinculadas = $state<Set<string>>(new Set());

  function iniciales(m: ModeloTarjeta): Record<string, number> {
    const e: Record<string, number> = {};
    for (const x of m.entradas) e[x.clave] = x.v.defecto;
    return e;
  }

  $effect(() => {
    const lista = ids;
    void formulasPorId(lista).then((fs: Formula[]) => {
      modelo = modeloTarjeta(fs);
      entradas = iniciales(modelo);
      vinculadas = new Set(modelo.entradas.filter((x) => x.vincular).map((x) => x.clave));
    });
  });

  const resultados = $derived(modelo ? evaluarTarjeta(modelo, entradas, vinculadas) : new Map<string, number>());

  function vincular(clave: string, si: boolean) {
    const n = new Set(vinculadas);
    if (si) n.add(clave);
    else n.delete(clave);
    vinculadas = n;
  }
</script>

{#if !modelo}
  <p class="espera">Cargando las fórmulas de la tarjeta…</p>
{:else}
  <div class="panel-tarjeta" aria-live="polite">
    <p class="explica">Los valores son compartidos: una magnitud que aparece en varias fórmulas se escribe una sola vez, y lo que calcula una fórmula alimenta a las demás.</p>
    {#if modelo.entradas.length}
      <div class="entradas">
        {#each modelo.entradas as x (x.clave)}
          {@const ligada = vinculadas.has(x.clave) && !!x.calculadaPor}
          <div class="entrada">
            {#if ligada && x.calculadaPor}
              <CampoValor v={x.v} valor={resultados.get(x.calculadaPor.id) ?? NaN} {idBase} soloLectura />
            {:else}
              <CampoValor v={x.v} bind:valor={() => entradas[x.clave] ?? NaN, (n) => (entradas[x.clave] = n)} {idBase} />
            {/if}
            {#if x.calculadaPor}
              <label class="vinculo">
                <input type="checkbox" checked={ligada} onchange={(e) => vincular(x.clave, e.currentTarget.checked)} />
                Calcularla con «{x.calculadaPor.nombre}»
              </label>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
    <ul class="salidas">
      {#each modelo.salidas as s (s.f.id)}
        {@const valor = resultados.get(s.f.id) ?? NaN}
        <li class:fuera={fueraDeRango(s.v, valor)}>
          <a class="nombre" href={rutaCalculadora(s.f.id)} title="Abrir esta fórmula en Calculadoras">{s.f.nombre}</a>
          <span class="valor"><span class="sim">{@html s.v.sim}</span> = <strong>{Number.isFinite(valor) ? formatoValor(valor, s.v.unidad, 4) : '—'}</strong></span>
        </li>
      {/each}
    </ul>
    <button class="secundario" onclick={() => { if (modelo) { entradas = iniciales(modelo); vinculadas = new Set(modelo.entradas.filter((x) => x.vincular).map((x) => x.clave)); } }}><Icono nombre="restablecer" tam={15} /> Valores iniciales</button>
  </div>
{/if}

<style>
  .panel-tarjeta {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 10px;
    padding: 12px 14px;
    border-radius: 10px;
    background: var(--superficie);
    border: 1px solid color-mix(in srgb, var(--c-tarjeta) 35%, transparent);
    font-family: var(--sans);
    text-align: left;
  }
  .explica,
  .espera {
    margin: 0;
    text-align: left;
    color: var(--tinta-suave);
    font-size: 13.5px;
    line-height: 1.4;
  }
  .entradas {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 330px), 1fr));
    gap: 0 18px;
  }
  .vinculo {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 36px;
    color: var(--tinta-suave);
    font-size: 13px;
    cursor: pointer;
  }
  .vinculo input {
    width: 18px;
    height: 18px;
    accent-color: var(--acento);
  }
  .salidas {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .salidas li {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 2px 12px;
    padding: 8px 10px;
    border-radius: 8px;
    background: var(--acento-tinte);
  }
  .salidas li.fuera {
    box-shadow: inset 3px 0 0 var(--c-importante);
  }
  .nombre {
    color: var(--tinta);
    font-size: 14px;
    text-decoration: none;
  }
  .nombre:hover {
    color: var(--acento);
    text-decoration: underline;
  }
  .valor {
    font-size: 15px;
    font-variant-numeric: tabular-nums;
  }
  .valor strong {
    color: var(--acento);
  }
  .sim {
    font-family: var(--serif);
    font-style: italic;
  }
  .sim :global(sub) {
    font-style: normal;
    font-size: 0.72em;
  }
  .secundario {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 40px;
    padding: 0 12px;
    border: 1px solid var(--acento-borde);
    border-radius: 999px;
    background: var(--superficie);
    color: var(--acento);
    font: inherit;
    font-size: 13.5px;
    font-weight: 600;
    cursor: pointer;
  }
</style>
