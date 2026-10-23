<script lang="ts">
  // Sliders for the component values of a netlist (log scale, ×0.1 … ×10 of the book's value).
  import type { Parametro } from '../../simulador/motor/netlist.ts';
  import { numeroSpice, serieE12 } from '../../simulador/motor/netlist.ts';
  import { formatoSI } from '../grafica';
  import Icono from '../Icono.svelte';

  interface Props {
    parametros: Parametro[];
    /** Original value and slider range of each parameter id (from spice.json or first detection). */
    rangos: Record<string, { min: number; max: number; original: number }>;
    alCambiar: (id: string, valor: number) => void;
    /** Element (lower-case name) whose sliders are brought into view and highlighted (schematic clicks). */
    enfoque?: { nombre: string; vez: number } | null;
  }
  let { parametros, rangos, alCambiar, enfoque = null }: Props = $props();

  let e12 = $state(true);
  let todos = $state(false);
  const VISIBLES = 10;
  const mostrados = $derived(todos ? parametros : parametros.slice(0, VISIBLES));
  const PASOS = 1000;

  // A part chosen on the schematic: show all sliders if needed, scroll to its first one and focus it.
  let lista: HTMLUListElement | undefined = $state();
  $effect(() => {
    const f = enfoque;
    if (!f) return;
    const i = parametros.findIndex((p) => p.elemento.toLowerCase() === f.nombre && !p.subckt);
    if (i < 0) return;
    if (i >= VISIBLES) todos = true;
    requestAnimationFrame(() => {
      const li = lista?.querySelector<HTMLElement>(`li[data-elemento="${CSS.escape(f.nombre)}"]`);
      if (!li) return;
      li.scrollIntoView({ block: 'center', behavior: 'smooth' });
      li.querySelector<HTMLInputElement>('input.deslizador')?.focus({ preventScroll: true });
    });
  });

  const CAMPO: Record<string, string> = {
    valor: '',
    dc: 'continua',
    'sin.va': 'amplitud',
    'sin.freq': 'frecuencia',
    'pulse.v2': 'nivel alto',
    'pulse.per': 'periodo',
    param: '.param',
  };

  function rango(p: Parametro) {
    return rangos[p.id] ?? { min: p.min, max: p.max, original: p.valor };
  }

  function serie(p: Parametro): number[] | null {
    if (!e12 || !p.e12) return null;
    const r = rango(p);
    const s = serieE12(Math.abs(r.min), Math.abs(r.max));
    return s.length > 2 ? s : null;
  }

  function posicion(p: Parametro): number {
    const r = rango(p);
    const s = serie(p);
    const a = Math.abs(p.valor);
    if (s) {
      let k = 0;
      for (let i = 0; i < s.length; i++) if (Math.abs(Math.log(s[i]! / a)) < Math.abs(Math.log(s[k]! / a))) k = i;
      return k;
    }
    const lo = Math.log10(Math.abs(r.min));
    const hi = Math.log10(Math.abs(r.max));
    return Math.round(((Math.log10(a) - lo) / (hi - lo || 1)) * PASOS);
  }

  function valorDe(p: Parametro, pos: number): number {
    const r = rango(p);
    const signo = r.original < 0 ? -1 : 1;
    const s = serie(p);
    if (s) return signo * s[Math.max(0, Math.min(s.length - 1, pos))]!;
    const lo = Math.log10(Math.abs(r.min));
    const hi = Math.log10(Math.abs(r.max));
    return signo * Number((10 ** (lo + (pos / PASOS) * (hi - lo))).toPrecision(3));
  }

  function etiqueta(p: Parametro): string {
    const c = CAMPO[p.campo] ?? p.campo;
    return c && p.campo !== 'param' ? `${p.elemento} · ${c}` : p.elemento;
  }

  function escrito(p: Parametro, ev: Event) {
    const el = ev.currentTarget as HTMLInputElement;
    // Accepts SPICE (4.7k, 100n, 1meg) and the app's own notation (4,7 kΩ, 2,2 MΩ, 10 µF): a trailing unit
    // is dropped, and a capital M after the number is mega as displayed here (SPICE would read milli).
    let t = el.value.trim().replace(/\s+/g, '').replace(',', '.');
    t = t.replace(/(Ω|ohm|Hz|V|A|F|H|S|s)$/, '');
    t = t.replace(/(\d)M$/, '$1meg');
    const v = numeroSpice(t);
    if (v === null || v === 0) {
      el.value = formatoSI(p.valor, p.unidad);
      return;
    }
    alCambiar(p.id, v);
  }
</script>

<section class="parametros" aria-label="Parámetros">
  <div class="cab">
    <h3>Parámetros</h3>
    {#if parametros.some((p) => p.e12)}
      <label class="e12"><input type="checkbox" bind:checked={e12} /> Valores E12</label>
    {/if}
  </div>
  {#if !parametros.length}
    <p class="vacio">Esta netlist no tiene valores que se puedan variar con un control deslizante (los que cambia el
      bloque <code>.control</code> con <code>alter</code> no se ofrecen). Puede editar la netlist directamente.</p>
  {:else}
    <ul bind:this={lista}>
      {#each mostrados as p (p.id)}
        {@const r = rango(p)}
        {@const s = serie(p)}
        {@const cambiado = Math.abs(p.valor - r.original) > Math.abs(r.original) * 1e-9}
        <li data-elemento={p.subckt ? undefined : p.elemento.toLowerCase()} class:enfocado={!p.subckt && enfoque?.nombre === p.elemento.toLowerCase()}>
          <div class="fila">
            <span class="nombre" title={p.subckt ? `Dentro del subcircuito ${p.subckt}` : undefined}
              >{etiqueta(p)}{#if p.subckt}<small> ({p.subckt})</small>{/if}</span
            >
            <input
              class="valor"
              type="text"
              inputmode="decimal"
              value={formatoSI(p.valor, p.unidad, 3)}
              aria-label={`Valor de ${etiqueta(p)}`}
              onchange={(ev) => escrito(p, ev)}
              onkeydown={(ev) => ev.key === 'Enter' && (ev.currentTarget as HTMLInputElement).blur()}
            />
            <button
              class="boton-icono reponer"
              disabled={!cambiado}
              title={`Volver a ${formatoSI(r.original, p.unidad, 3)}`}
              aria-label={`Volver al valor del libro (${formatoSI(r.original, p.unidad, 3)})`}
              onclick={() => alCambiar(p.id, r.original)}><Icono nombre="restablecer" tam={16} /></button
            >
          </div>
          <input
            class="deslizador"
            type="range"
            min="0"
            max={s ? s.length - 1 : PASOS}
            step="1"
            value={posicion(p)}
            aria-label={etiqueta(p)}
            aria-valuetext={formatoSI(p.valor, p.unidad, 3)}
            oninput={(ev) => alCambiar(p.id, valorDe(p, Number((ev.currentTarget as HTMLInputElement).value)))}
          />
          <div class="extremos" aria-hidden="true">
            <span>{formatoSI(r.min, p.unidad, 2)}</span><span>{formatoSI(r.max, p.unidad, 2)}</span>
          </div>
        </li>
      {/each}
    </ul>
    {#if parametros.length > VISIBLES}
      <button class="boton mas" onclick={() => (todos = !todos)}>
        {todos ? 'Mostrar menos' : `Mostrar los ${parametros.length} parámetros`}
      </button>
    {/if}
  {/if}
</section>

<style>
  .parametros {
    font-family: var(--sans);
  }
  .cab {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
  }
  h3 {
    margin: 0 0 6px;
    font-size: 15px;
    color: var(--titulos);
  }
  .e12 {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    font-size: 13px;
    color: var(--tinta-suave);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 6px;
  }
  li {
    padding: 6px 0 2px;
    border-bottom: 1px solid var(--linea-suave);
  }
  .fila {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  li.enfocado {
    background: var(--acento-tinte);
    border-radius: 8px;
    box-shadow: 0 0 0 2px var(--acento-borde);
  }
  .nombre {
    flex: 1;
    min-width: 0;
    font-family: var(--mono);
    font-size: 13.5px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .nombre small {
    font-weight: 400;
    color: var(--tinta-tenue);
  }
  .valor {
    width: 7.5em;
    padding: 4px 8px;
    border: 1px solid var(--linea);
    border-radius: 7px;
    background: var(--superficie);
    text-align: right;
    font-variant-numeric: tabular-nums;
    font-size: 14px;
  }
  .reponer {
    width: 32px;
    height: 32px;
  }
  .reponer:disabled {
    opacity: 0.3;
    cursor: default;
  }
  .deslizador {
    width: 100%;
    margin: 6px 0 0;
    accent-color: var(--acento);
    height: 24px;
  }
  .extremos {
    display: flex;
    justify-content: space-between;
    font-size: 11.5px;
    color: var(--tinta-tenue);
    font-variant-numeric: tabular-nums;
  }
  .vacio {
    margin: 0;
    font-size: 14px;
    color: var(--tinta-suave);
  }
  .mas {
    margin-top: 8px;
  }
</style>
