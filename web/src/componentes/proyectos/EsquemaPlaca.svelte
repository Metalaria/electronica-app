<script lang="ts">
  // The board's KiCad schematic with interactive nets: the «Consolas» sheet renderer (same data formats),
  // with the board's net indices, so a pin, label or symbol selects the same pad, net or part everywhere.
  import Lienzo from '../consolas/esquema/Lienzo.svelte';
  import type { CapaHoja } from '../consolas/datos';
  import type { Dibujo } from '../consolas/esquema/dibujo';
  import type { Impacto } from '../consolas/esquema/capa';
  import type { DatosPlaca } from './datos';
  import type { Seleccion } from './estado';
  import type { Resuelta } from './seleccion';

  let {
    datos,
    dibujo,
    capa,
    res,
    oscuro,
    enfocar = 0,
    alElegir,
  }: {
    datos: DatosPlaca;
    dibujo: Dibujo;
    capa: CapaHoja;
    res: Resuelta;
    oscuro: boolean;
    enfocar?: number;
    alElegir: (s: Seleccion | null) => void;
  } = $props();

  let rojo: number | null = $state(null);
  let globo = $state<{ x: number; y: number; t: string } | null>(null);
  let lienzo: Lienzo | undefined = $state();
  const refSel = $derived(res.huella !== null ? datos.huellas[res.huella]!.r : null);

  function aSeleccion(i: Impacto | null): Seleccion | null {
    if (!i) return null;
    if (i.tipo === 'pin') return { tipo: 'pad', id: `${i.ref}.${i.pin}` };
    if (i.tipo === 'simbolo') return { tipo: 'huella', id: i.ref };
    if ((i.tipo === 'etiqueta' || i.tipo === 'hilo') && i.red >= 0) return { tipo: 'red', id: datos.redes[i.red]!.n };
    return null;
  }

  function texto(i: Impacto): string {
    if (i.tipo === 'pin') return `${i.ref}.${i.pin}${i.nombre && i.nombre !== i.pin ? ` (${i.nombre})` : ''} · ${i.red >= 0 ? datos.redes[i.red]!.n : 'sin conectar'}`;
    if (i.tipo === 'etiqueta' || i.tipo === 'hilo') return i.red >= 0 ? `Red ${datos.redes[i.red]!.n}` : '';
    if (i.tipo === 'simbolo') {
      const h = datos.huellas.find((x) => x.r === i.ref);
      return h ? `${h.r} · ${h.v}` : i.ref;
    }
    return '';
  }
</script>

<div class="esquema">
  <div class="barra">
    <span class="nota">Esquema de KiCad del proyecto (una hoja, una etiqueta de red en cada pin). Toca un pin, una etiqueta o un símbolo.</span>
    <div class="zoom">
      <button type="button" aria-label="Alejar" onclick={() => lienzo?.zoom(1 / 1.5)}>−</button>
      <button type="button" onclick={() => lienzo?.ajustar()}>Ajustar</button>
      <button type="button" aria-label="Acercar" onclick={() => lienzo?.zoom(1.5)}>+</button>
    </div>
  </div>
  <div class="marco">
    <Lienzo
      bind:this={lienzo}
      {dibujo}
      {capa}
      {oscuro}
      acento="#2e6ea6"
      red={res.red}
      {rojo}
      simbolo={refSel}
      {enfocar}
      alTocar={(i) => alElegir(aSeleccion(i))}
      alPasar={(i, x, y) => {
        rojo = i && (i.tipo === 'pin' || i.tipo === 'etiqueta' || i.tipo === 'hilo') && i.red >= 0 ? i.red : null;
        globo = i ? { x, y, t: texto(i) } : null;
      }}
    />
    {#if globo && globo.t}
      <div class="globo" style:left={`${globo.x + 14}px`} style:top={`${globo.y + 14}px`}>{globo.t}</div>
    {/if}
  </div>
  {#if datos.esquema.notas.length}
    <details class="notas">
      <summary>Anotaciones del esquema</summary>
      {#each datos.esquema.notas as n, i (i)}<pre>{n}</pre>{/each}
    </details>
  {/if}
</div>

<style>
  .esquema {
    display: grid;
    grid-template-rows: auto 1fr auto;
    height: 100%;
    min-height: 0;
  }
  .barra {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 6px 12px;
    padding: 6px 0 8px;
  }
  .nota {
    color: var(--tinta-suave);
    font-size: 13px;
  }
  .zoom {
    display: inline-flex;
    gap: 2px;
    padding: 2px;
    border-radius: 10px;
    background: var(--superficie-2);
  }
  .zoom button {
    min-width: 44px;
    min-height: 36px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--tinta);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }
  @media (pointer: coarse) {
    .zoom button {
      min-height: 44px;
    }
  }
  .marco {
    position: relative;
    min-height: 260px;
    overflow: hidden;
    border-radius: 12px;
  }
  .globo {
    position: absolute;
    z-index: 2;
    padding: 4px 8px;
    border-radius: 6px;
    background: rgba(20, 22, 26, 0.92);
    color: #fff;
    font-size: 13px;
    pointer-events: none;
    white-space: nowrap;
  }
  .notas {
    margin-top: 8px;
    font-size: 13px;
  }
  .notas pre {
    white-space: pre-wrap;
    font-size: 12px;
  }
</style>
