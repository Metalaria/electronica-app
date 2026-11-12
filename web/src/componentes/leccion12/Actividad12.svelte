<script lang="ts">
  // 1.2 learning-by-doing steps: the card body of a «simular», «diseno», «averia», «ajuste», «banco», «dibujar» or
  // «sql» card, under the card's own widget. The shell (Leccion11.svelte, TarjetaPractica.svelte) keeps the header,
  // the footer button (Comprobar / Volver a intentarlo / Continuar, through lib/leccion11/motor.ts) and the events;
  // these components only show the activity and change its state (`cambiar`).
  import './actividades12.css';
  import type { EstadoTarjeta } from '../../lib/leccion11/motor';
  import type { Valores } from '../../lib/leccion11/modelo';
  import type { Leccion11, Tarjeta } from '../../lib/leccion11/tipos';
  import Simular from './Simular.svelte';
  import Diseno from './Diseno.svelte';
  import BuscarAveria from './BuscarAveria.svelte';
  import Ajuste from './Ajuste.svelte';
  import Banco from './Banco.svelte';
  import Dibujar from './Dibujar.svelte';
  import Sql from './Sql.svelte';
  // motor12c: the steps on a figure or a logic circuit (GUIA §11)
  import PasosDigitales from './PasosDigitales.svelte';
  import { esActividadDigital } from '../../lib/leccion12/digital/motor-digital';
  import type { EstadoActividadDigital } from '../../lib/leccion12/digital/tipos';

  let {
    leccion,
    t,
    e,
    valores,
    efectivos,
    prefijo,
    valor,
    cambiar,
  }: {
    leccion: Leccion11;
    t: Tarjeta;
    e: EstadoTarjeta;
    /** The model evaluated with the card's values (and the hidden fault of an «averia»). */
    valores: Valores;
    /** The card's input values. */
    efectivos: Valores;
    prefijo: string;
    valor: (id: string) => string;
    cambiar: (c: Partial<EstadoTarjeta>) => void;
  } = $props();
</script>

{#if t.actividad && esActividadDigital(t.actividad) && e.actividad}
  <PasosDigitales {t} a={t.actividad} {e} ea={e.actividad as EstadoActividadDigital} {prefijo} {cambiar} />
{:else if t.actividad?.tipo === 'simular' && e.actividad?.tipo === 'simular'}
  <Simular {leccion} {t} a={t.actividad} {e} ea={e.actividad} {efectivos} {prefijo} {valor} {cambiar} />
{:else if t.actividad?.tipo === 'diseno'}
  <Diseno {leccion} {t} a={t.actividad} {e} {efectivos} />
{:else if t.actividad?.tipo === 'averia' && e.actividad?.tipo === 'averia'}
  <BuscarAveria {leccion} {t} a={t.actividad} {e} ea={e.actividad} {efectivos} {prefijo} {valor} {cambiar} />
{:else if t.actividad?.tipo === 'ajuste'}
  <Ajuste {leccion} a={t.actividad} {valores} {valor} />
{:else if t.actividad?.tipo === 'banco' && e.actividad?.tipo === 'banco'}
  <Banco {leccion} a={t.actividad} ea={e.actividad} {efectivos} {prefijo} {valor} {cambiar} />
{:else if t.actividad?.tipo === 'dibujar' && e.actividad?.tipo === 'dibujar'}
  <Dibujar {leccion} a={t.actividad} {e} ea={e.actividad} {efectivos} {prefijo} {cambiar} />
{:else if t.actividad?.tipo === 'sql' && e.actividad?.tipo === 'sql'}
  <Sql a={t.actividad} {e} ea={e.actividad} {prefijo} {cambiar} />
{/if}
