<script lang="ts">
  // 1.2 «Ajuste»: the reader turns the widget's control (slider, or the piece on the schematic) until a measured
  // quantity enters its band; this meter shows where it is against the band, live, and says which way to go.
  // «Continuar» opens inside the band (lib/leccion12/motor12.ts exploracion12). The words are announced politely, and
  // only when the side changes (not at every step of the slider).
  import { compilarModelo, formatear, type Valores } from '../../lib/leccion11/modelo';
  import { textoPlano } from '../../lib/leccion11/texto';
  import type { Leccion11 } from '../../lib/leccion11/tipos';
  import { ladoAjuste } from '../../lib/leccion12/motor12';
  import type { Ajuste } from '../../lib/leccion12/tipos';
  import TextoVivo from '../leccion11/TextoVivo.svelte';

  let { leccion, a, valores, valor }: { leccion: Leccion11; a: Ajuste; valores: Valores; valor: (id: string) => string } = $props();

  const mc = $derived(compilarModelo(leccion.modelo));
  const mag = $derived(mc.magnitud(a.banda.valor));
  const x = $derived(valores[a.banda.valor] ?? NaN);
  const lado = $derived(ladoAjuste(a, valores));
  const pos = (v: number) => Math.max(0, Math.min(100, ((v - a.escala.min) / (a.escala.max - a.escala.min)) * 100));
  const texto = $derived(lado === 'dentro' ? a.dentro : lado === 'bajo' ? a.bajo : a.alto);
  // (motor12e: a band open on one side reaches the meter's end on that side)
  const desde = $derived(a.banda.min ?? a.escala.min);
  const hasta = $derived(a.banda.max ?? a.escala.max);
  const banda = $derived(
    a.banda.min != null && a.banda.max != null
      ? `banda de ${formatear(mag, a.banda.min)} a ${formatear(mag, a.banda.max)}`
      : a.banda.min != null
        ? `banda: desde ${formatear(mag, a.banda.min)} hacia arriba`
        : `banda: hasta ${formatear(mag, a.banda.max)}`,
  );
</script>

<div class="a12 ajuste" data-ajuste data-lado={lado}>
  <div class="cabeza">
    <span class="a12-suave"><TextoVivo texto={a.rotulo} {valor} /></span>
    <strong class={lado === 'dentro' ? 'a12-ok' : ''} data-medida-ajuste>{formatear(mag, x)}</strong>
  </div>
  <div class="escala" role="img" aria-label={`${textoPlano(a.rotulo, valor)}: ${formatear(mag, x)}; ${banda}`} data-banda-abierta={a.banda.min == null ? 'abajo' : a.banda.max == null ? 'arriba' : null}>
    <span class="banda" class:sin-min={a.banda.min == null} class:sin-max={a.banda.max == null} style:left={`${pos(desde)}%`} style:width={`${Math.max(1, pos(hasta) - pos(desde))}%`}></span>
    <span class="aguja" class:dentro={lado === 'dentro'} style:left={`${pos(x)}%`}></span>
  </div>
  <div class="extremos a12-suave" aria-hidden="true">
    <span>{formatear(mag, a.escala.min)}</span><span>{formatear(mag, a.escala.max)}</span>
  </div>
  <p class={lado === 'dentro' ? 'a12-ok' : ''} aria-live="polite" data-consejo-ajuste>
    {#key lado}{#if lado !== 'dentro'}{lado === 'bajo' ? '▲ ' : '▼ '}{/if}<TextoVivo {texto} {valor} />{/key}
  </p>
</div>

<style>
  .cabeza {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
  }
  .cabeza strong {
    font: 700 22px var(--v11-titular);
    font-variant-numeric: tabular-nums;
  }
  .escala {
    position: relative;
    height: 22px;
    border-radius: 11px;
    background: var(--v11-fondo);
    border: 1.5px solid var(--v11-linea);
  }
  .banda {
    position: absolute;
    top: 0;
    bottom: 0;
    background: var(--v11-bien-tinte);
    border-left: 2px solid var(--v11-bien);
    border-right: 2px solid var(--v11-bien);
  }
  .banda.sin-min {
    border-left: none;
  }
  .banda.sin-max {
    border-right: none;
  }
  .aguja {
    position: absolute;
    top: -6px;
    width: 6px;
    height: 32px;
    margin-left: -3px;
    border-radius: 3px;
    background: var(--v11-naranja);
    transition: left 0.15s;
  }
  .aguja.dentro {
    background: var(--v11-bien);
  }
  .extremos {
    display: flex;
    justify-content: space-between;
    font-variant-numeric: tabular-nums;
  }
  @media (prefers-reduced-motion: reduce) {
    .aguja {
      transition: none;
    }
  }
</style>
