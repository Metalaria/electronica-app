<script lang="ts">
  // The real FNIRSI's multimeter: a relative reading («tomar esta lectura como cero») and limits with a warning when
  // the reading leaves them. Both are kept here, in the application (lib/fnirsi-real/relativo.ts): the instrument
  // is not told, and its screen goes on showing what it measures. Closed by default.
  // A reading the panel does not hold as reliable (a range change, an unknown annunciator, «Auto» waiting) is not
  // used for either: the last answer stays until the next reliable one.
  // 2.1: the system's folded row (details.plegable21), its buttons and feedback, the system's type sizes; what it
  // computes is unchanged.
  import { untrack } from 'svelte';
  import type { LecturaFnirsi } from '../../../lib/fnirsi-real/multimetro';
  import { alarma, leerLimite, relativo, tomarReferencia, type Alarma, type Limites, type Referencia } from '../../../lib/fnirsi-real/relativo';
  import { formatoSI } from '../../grafica/formato';

  let { lectura }: { lectura: LecturaFnirsi } = $props();

  let referencia = $state<Referencia | null>(null);
  let textoMinimo = $state('');
  let textoMaximo = $state('');
  let limites = $state<Limites | null>(null);
  let errorLimites = $state('');
  /** Times the reading has gone from inside the limits to outside them. */
  let salidas = $state(0);
  let estado = $state<Alarma | null>(null);
  let textoRelativo = $state('');

  const usable = $derived(lectura.fiable && !lectura.esperando);
  const valor = (v: number, unidad: string) => formatoSI(v, unidad, 4);

  // the relative reading, from each reliable reading
  $effect(() => {
    const ref = referencia;
    if (!ref) {
      textoRelativo = '';
      return;
    }
    if (!usable) return;
    const r = relativo(lectura.pantalla, ref);
    if (r.estado === 'otra-unidad') textoRelativo = `El cero se tomó en ${ref.unidad || 'otra unidad'} y ahora el aparato mide ${lectura.pantalla.unidad || 'otra cosa'}: no hay diferencia que dar.`;
    else if (r.estado === 'sin-numero') textoRelativo = `La lectura no es un número ahora mismo; el cero sigue en ${valor(ref.valor, ref.unidad)}.`;
    else {
      const signo = r.diferencia > 0 ? '+' : '';
      const pct = r.porcentaje === null ? '' : ` (${r.porcentaje > 0 ? '+' : ''}${r.porcentaje.toLocaleString('es-ES', { maximumFractionDigits: 2 }).replace('-', '−')} %)`;
      textoRelativo = `Relativo: ${signo}${valor(r.diferencia, ref.unidad)}${pct} respecto a ${valor(ref.valor, ref.unidad)}`;
    }
  });

  // where the reading is against the limits, and how many times it has left them
  $effect(() => {
    const l = limites;
    if (!l) {
      estado = null;
      return;
    }
    if (!usable) return;
    const e = alarma(lectura.pantalla, l);
    untrack(() => {
      const fuera = e === 'bajo' || e === 'alto';
      const estabaFuera = estado === 'bajo' || estado === 'alto';
      if (fuera && !estabaFuera) salidas++;
      estado = e;
    });
  });

  const rango = $derived.by(() => {
    const l = limites;
    if (!l) return '';
    if (l.minimo !== null && l.maximo !== null) return `de ${valor(l.minimo, l.unidad)} a ${valor(l.maximo, l.unidad)}`;
    return l.minimo !== null ? `mínimo ${valor(l.minimo, l.unidad)}` : `máximo ${valor(l.maximo!, l.unidad)}`;
  });
  const textoAlarma = $derived.by(() => {
    const l = limites;
    if (!l || estado === null) return l ? `Vigilando (${rango}).` : '';
    const veces = salidas ? ` Ha salido de los límites ${salidas} ${salidas === 1 ? 'vez' : 'veces'}.` : '';
    if (estado === 'bajo') return `Por debajo del mínimo (${valor(l.minimo!, l.unidad)}).${veces}`;
    if (estado === 'alto') return `Por encima del máximo (${valor(l.maximo!, l.unidad)}).${veces}`;
    if (estado === 'otra-unidad') return `Los límites se fijaron en ${l.unidad || 'otra unidad'} y ahora el aparato mide ${lectura.pantalla.unidad || 'otra cosa'}: en suspenso.${veces}`;
    if (estado === 'sin-numero') return `La lectura no es un número ahora mismo.${veces}`;
    return `Dentro de los límites (${rango}).${veces}`;
  });

  function tomarCero() {
    referencia = usable ? tomarReferencia(lectura.pantalla) : null;
  }

  function vigilar(e: SubmitEvent) {
    e.preventDefault();
    errorLimites = '';
    const minimo = leerLimite(textoMinimo);
    const maximo = leerLimite(textoMaximo);
    if (minimo === null || maximo === null) errorLimites = `No se entiende «${minimo === null ? textoMinimo : textoMaximo}»: escriba un número, con coma o punto, y su unidad si quiere («450 mV»).`;
    else if (minimo === undefined && maximo === undefined) errorLimites = 'Escriba al menos un límite.';
    else if (minimo !== undefined && maximo !== undefined && minimo > maximo) errorLimites = 'El mínimo es mayor que el máximo.';
    if (errorLimites) return;
    salidas = 0;
    estado = null;
    limites = { minimo: minimo ?? null, maximo: maximo ?? null, unidad: lectura.pantalla.unidad };
  }

  function quitarLimites() {
    limites = null;
    errorLimites = '';
    salidas = 0;
  }
</script>

<details class="xm plegable21" data-extras-multimetro>
  <summary>Relativo y límites</summary>
  <div class="plegable21-cuerpo xm-cuerpo">
  <p class="xm-nota">Lo hace la aplicación con la lectura que envía el FNIRSI: la pantalla del aparato no cambia.</p>
  <div class="xm-fila">
    {#if referencia}
      <button type="button" class="boton" onclick={() => (referencia = null)} data-quitar-cero>Quitar el cero</button>
    {:else}
      <button type="button" class="boton" disabled={!usable || lectura.pantalla.valor === null} onclick={tomarCero} data-tomar-cero>Tomar esta lectura como cero</button>
    {/if}
  </div>
  {#if textoRelativo}<p role="status" data-relativo-fnirsi>{textoRelativo}</p>{/if}
  <form class="xm-limites" onsubmit={vigilar}>
    <label>Mínimo <input type="text" inputmode="decimal" autocomplete="off" placeholder="sin límite" bind:value={textoMinimo} data-limite="minimo" /></label>
    <label>Máximo <input type="text" inputmode="decimal" autocomplete="off" placeholder="sin límite" bind:value={textoMaximo} data-limite="maximo" /></label>
    <button type="submit" class="boton" data-vigilar>Vigilar</button>
    {#if limites}<button type="button" class="boton fantasma" onclick={quitarLimites} data-quitar-limites>Quitar los límites</button>{/if}
  </form>
  <p class="xm-nota">En la unidad de la lectura ({lectura.pantalla.unidad || 'sin unidad'}); con otro prefijo, escríbalo: «4,5», «450 mV», «2,2 kΩ».</p>
  {#if errorLimites}<p class="aviso21 mal" role="alert" data-error-limites>{errorLimites}</p>{/if}
  {#if textoAlarma}<p class={estado === 'bajo' || estado === 'alto' ? 'aviso21 mal' : ''} role="status" aria-live="polite" data-alarma-fnirsi={estado ?? 'esperando'}>{textoAlarma}</p>{/if}
  </div>
</details>

<style>
  /* 2.1: the system's folded row holds it; inside, its buttons, 44 px fields and the amber feedback, no boxes */
  .xm {
    font-family: var(--sans);
    font-size: 15px;
    color: var(--v11-tinta);
  }
  .xm-cuerpo {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .xm p {
    margin: 0;
  }
  .xm-nota {
    color: var(--v11-tinta-suave);
    font-size: 13px;
  }
  .xm-limites {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 8px 12px;
  }
  .xm-limites label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    color: var(--v11-tinta-suave);
    font-size: 13px;
  }
  .xm-limites input {
    width: 9em;
    min-height: 44px;
    padding: 0 10px;
    border: 1px solid var(--v11-linea);
    border-radius: 12px;
    background: transparent;
    color: var(--v11-tinta);
    font: inherit;
    font-size: 16px;
  }
</style>
