<script lang="ts">
  // «Alineación»: the procedure of section 15.11 in the book's order, on a simulated kit that comes out of the bag
  // misaligned (coils not stretched, trimmers and cores anywhere). Each step shows the book's text, the controls
  // and the instrument it needs, and says when the right setting has been reached.
  import CheckCircle from '@lucide/svelte/icons/circle-check';
  import Circle from '@lucide/svelte/icons/circle';
  import type { EstadoKit } from './estado.svelte';
  import { evaluar } from './alineacion';
  import Frontal from './Frontal.svelte';
  import Mandos from './Mandos.svelte';
  import Multimetro from './Multimetro.svelte';
  import Osciloscopio from './Osciloscopio.svelte';
  import Cita from './ui/Cita.svelte';

  let { k, alPaso }: { k: EstadoKit; alPaso?: (piezas: string[]) => void } = $props();

  const pasos = $derived(k.kit.pasos);
  let actual = $state(0);
  let hechos = $state<string[]>([]);
  // Sticky sub-results of a step (the VCO set before reopening «Monitor»).
  const memoria: Record<string, boolean> = {};
  let todos = $state(false);
  const TODOS = ['l1', 'c4a', 'l2', 'c4b', 'b1', 'b2', 'w1', 'w3', 'w2', 'monitor', 'vcc'];

  const paso = $derived(pasos[actual]);
  const ev = $derived(paso ? evaluar(paso.id, k, memoria) : null);

  $effect(() => {
    if (ev?.ok && paso && !hechos.includes(paso.id)) hechos = [...hechos, paso.id];
  });
  $effect(() => {
    alPaso?.(ev?.piezas ?? []);
  });

  function ir(i: number) {
    actual = Math.max(0, Math.min(pasos.length - 1, i));
    const p = pasos[actual];
    if (p) {
      const e = evaluar(p.id, k, memoria);
      if (e.piezas[0]) k.elegirPieza(e.piezas[0]);
    }
  }

  function empezar(alinear: boolean) {
    k.reiniciar(alinear);
    hechos = [];
    for (const key of Object.keys(memoria)) delete memoria[key];
    k.redesMedidas = [];
    k.tpsVistos = [];
    actual = 0;
  }
</script>

<div class="panel-alineacion">
  <div class="inicio">
    <button type="button" onclick={() => empezar(false)}>Kit recién montado</button>
    <button type="button" onclick={() => empezar(true)}>Kit ya alineado</button>
  </div>
  <Frontal {k} />

  <ol class="pasos" aria-label="Pasos de la alineación">
    {#each pasos as p, i (p.id)}
      <li class:actual={i === actual}>
        <button type="button" class="cab" aria-expanded={i === actual} onclick={() => ir(i)} data-paso={p.id}>
          {#if hechos.includes(p.id)}<CheckCircle size={18} class="ok" />{:else}<Circle size={18} />{/if}
          <span>{i + 1}. {p.titulo}</span>
        </button>
        {#if i === actual && ev}
          <div class="cuerpo">
            <p class="libro">{p.texto} <Cita cita={k.kit.citas[p.cita]} /></p>
            {#if ev.atajos?.length}
              <div class="atajos">
                {#each ev.atajos as a (a.texto)}<button type="button" onclick={() => a.accion(k)}>{a.texto}</button>{/each}
              </div>
            {/if}
            {#if ev.mandos.length}<Mandos {k} solo={ev.mandos} destacar={ev.mandos} />{/if}
            {#if ev.instrumento === 'multimetro'}<Multimetro {k} />{/if}
            {#if ev.instrumento === 'osciloscopio'}<Osciloscopio {k} />{/if}
            <p class="estado" class:ok={ev.ok} aria-live="polite" data-estado-paso={ev.ok ? 'ok' : 'pendiente'}>
              {#if ev.ok}<b>¡Correcto!</b> {/if}{ev.mensaje}
            </p>
            {#if ev.ok && i < pasos.length - 1}
              <button type="button" class="siguiente" onclick={() => ir(i + 1)}>Siguiente paso</button>
            {/if}
          </div>
        {/if}
      </li>
    {/each}
  </ol>
  {#if hechos.length === pasos.length}
    <p class="fin">La radio está alineada: cobertura de 88 a 108 MHz, seguimiento, AFC, estéreo y mute, como en la sección 15.11.</p>
  {/if}
  <details class="todos" ontoggle={(e) => (todos = (e.currentTarget as HTMLDetailsElement).open)}>
    <summary>Todos los ajustes</summary>
    {#if todos}<Mandos {k} solo={TODOS.filter((m) => !ev?.mandos.includes(m))} />{/if}
  </details>
</div>

<style>
  .panel-alineacion {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .inicio,
  .atajos {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .inicio button,
  .atajos button,
  .siguiente {
    min-height: 44px;
    padding: 0 14px;
    border: 1px solid var(--linea);
    border-radius: 10px;
    background: var(--superficie);
    color: var(--tinta);
    font: 600 13.5px var(--sans);
    cursor: pointer;
  }
  .siguiente {
    align-self: flex-start;
    border-color: var(--acento);
    background: var(--acento);
    color: #fff;
  }
  .pasos {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .pasos li {
    border: 1px solid var(--linea);
    border-radius: 10px;
    background: var(--superficie);
  }
  .pasos li.actual {
    border-color: var(--acento-borde);
  }
  .cab {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-height: 46px;
    padding: 6px 10px;
    border: 0;
    background: none;
    color: var(--tinta);
    font: 600 14px var(--sans);
    text-align: left;
    cursor: pointer;
  }
  .cab :global(.ok) {
    color: #1e8449;
  }
  .cuerpo {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 0 10px 10px;
  }
  .libro {
    margin: 0;
    font-size: 13.5px;
    line-height: 1.45;
  }
  .estado {
    margin: 0;
    padding: 8px 10px;
    border-radius: 8px;
    background: var(--superficie-2);
    font-size: 13.5px;
    line-height: 1.4;
  }
  .estado.ok {
    background: color-mix(in srgb, #1e8449 14%, var(--superficie));
  }
  .fin {
    margin: 0;
    padding: 10px;
    border-radius: 10px;
    background: color-mix(in srgb, #1e8449 14%, var(--superficie));
    font-size: 14px;
  }
  .todos summary {
    min-height: 44px;
    display: flex;
    align-items: center;
    font-weight: 600;
    cursor: pointer;
  }
</style>
