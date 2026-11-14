<script lang="ts">
  // 1.2 (motor12c): the visual of a card whose widget is a «figura» or a «logica» circuit (GUIA §11), on top of the
  // card like the circuit and graph widgets. Its state lives in the card's state (EstadoTarjeta.widget12 and, for
  // a step on it, EstadoTarjeta.actividad), changed through `cambiar` as the shell does for everything else.
  import type { EstadoTarjeta } from '../../lib/leccion11/motor';
  import type { Tarjeta } from '../../lib/leccion11/tipos';
  import FiguraZonas from './FiguraZonas.svelte';
  import Logica from './Logica.svelte';

  let {
    t,
    e,
    oculto,
    prefijo,
    cambiar,
  }: {
    t: Tarjeta;
    e: EstadoTarjeta;
    oculto: boolean;
    prefijo: string;
    cambiar: (c: Partial<EstadoTarjeta>) => void;
  } = $props();
</script>

{#if t.widget?.tipo === 'figura'}
  <FiguraZonas {t} w={t.widget} {e} {prefijo} {cambiar} />
{:else if t.widget?.tipo === 'logica'}
  <Logica {t} w={t.widget} {e} {oculto} {prefijo} {cambiar} />
{/if}
