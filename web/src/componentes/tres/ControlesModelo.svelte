<script lang="ts">
  // Parameter controls of a 3D model, from its Control list (paquetes.ts): value sliders with SI prefixes,
  // option sets (segmented control, or a list when there are many), numbers and switches.
  import Deslizador from '../animaciones/ui/Deslizador.svelte';
  import Selector from '../animaciones/ui/Selector.svelte';
  import Interruptor from '../animaciones/ui/Interruptor.svelte';
  import type { Control } from './modelos/paquetes';
  import type { Parametros } from './modelos/tipos';

  let { controles, parametros = $bindable() }: { controles: Control[]; parametros: Parametros } = $props();

  const corto = (c: Control) => (c.opciones?.length ?? 0) <= 4 && (c.opciones ?? []).every((o) => o.t.length <= 18);
  const pct = (v: number) => `${Math.round(v * 100)} %`;
</script>

<div class="controles3d">
  {#each controles as c (c.id)}
    {#if c.tipo === 'valor'}
      <Deslizador
        etiqueta={c.etiqueta}
        bind:valor={() => Number(parametros[c.id]), (v) => (parametros[c.id] = v)}
        min={c.min ?? 1}
        max={c.max ?? 1e6}
        unidad={c.unidad ?? ''}
        log={c.log ?? true}
      />
    {:else if c.tipo === 'numero'}
      <Deslizador
        etiqueta={c.etiqueta}
        bind:valor={() => Number(parametros[c.id]), (v) => (parametros[c.id] = v)}
        min={c.min ?? 0}
        max={c.max ?? 1}
        paso={c.paso}
        formato={c.unidad === '%' ? pct : (v) => String(Math.round(v))}
      />
    {:else if c.tipo === 'interruptor'}
      <Interruptor etiqueta={c.etiqueta} bind:valor={() => parametros[c.id] === true, (v) => (parametros[c.id] = v)} />
    {:else if c.tipo === 'opciones' && corto(c)}
      <Selector
        etiqueta={c.etiqueta}
        opciones={(c.opciones ?? []).map((o) => ({ valor: String(o.v), texto: o.t }))}
        bind:valor={() => String(parametros[c.id]), (v) => (parametros[c.id] = typeof c.opciones?.[0]?.v === 'number' ? Number(v) : v)}
      />
    {:else if c.tipo === 'opciones'}
      <label class="lista">
        <span>{c.etiqueta}</span>
        <select
          value={String(parametros[c.id])}
          onchange={(e) => {
            const v = e.currentTarget.value;
            parametros[c.id] = typeof c.opciones?.[0]?.v === 'number' ? Number(v) : v;
          }}
        >
          {#each c.opciones ?? [] as o (o.v)}<option value={String(o.v)}>{o.t}</option>{/each}
        </select>
      </label>
    {/if}
  {/each}
</div>

<style>
  .controles3d {
    display: grid;
    gap: 14px;
  }
  .lista {
    display: grid;
    gap: 6px;
    font-size: 14px;
    font-weight: 600;
    color: var(--tinta);
  }
  select {
    min-height: 44px;
    padding: 0 10px;
    border: 1px solid var(--linea);
    border-radius: 10px;
    background: var(--superficie);
    color: var(--tinta);
    font: inherit;
    font-weight: 500;
  }
</style>
