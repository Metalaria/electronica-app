<script lang="ts">
  // 1.3 (motor13b, petición de averias13): the «averia-placa» widget of a lesson card — «Busque la avería» on the real
  // board of a console (componentes/consolas/averia/BusqueAveria.svelte, averias13), loaded on demand. Naming the
  // faulty part sets the card's widget state `encontrada`, which a goal `{ averia: encontrada }` looks at
  // (lib/leccion12/averia-placa.ts): the card is then done, as a figure's zones touched.
  import type { EstadoTarjeta } from '../../lib/leccion11/motor';
  import type { Tarjeta } from '../../lib/leccion11/tipos';
  import { textoPlano } from '../../lib/leccion11/texto';
  import type { WidgetAveriaPlaca } from '../../lib/leccion12/averia-placa';

  let { t, w, e, cambiar }: { t: Tarjeta; w: WidgetAveriaPlaca; e: EstadoTarjeta; cambiar: (c: Partial<EstadoTarjeta>) => void } = $props();

  const objetivo = $derived(textoPlano(t.texto, () => ''));
  function resuelta() {
    const w12 = e.widget12 ?? { zona: null, niveles: {}, logica: null, pulsos: 0, tramo: 0 };
    cambiar({ widget12: { ...w12, encontrada: true }, movidos: e.movidos.includes('averia') ? e.movidos : [...e.movidos, 'averia'] });
  }
</script>

<div class="a12-averia-placa" data-widget-averia={w.definicion} data-encontrada={e.widget12?.encontrada ? 'si' : 'no'}>
  {#await import('../consolas/averia/BusqueAveria.svelte')}
    <p class="a12-suave" aria-live="polite">Preparando la placa…</p>
  {:then m}
    <m.default maquina={w.maquina} definicion={w.definicion} averia={w.averia} {objetivo} vista={w.vista} alResolver={resuelta} />
  {:catch}
    <p class="a12-suave">No se ha podido abrir la placa.</p>
  {/await}
</div>
