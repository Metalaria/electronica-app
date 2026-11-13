<script lang="ts">
  // 1.2 «Prediga y simule»: the reader writes an estimate with its unit («4,2 V», «4k7», «150 m»), commits it with
  // «Comprobar» (once: the verdict and its explanation come from the lesson's model), and then the app's own ngspice
  // runs the card's circuit and shows what it gives next to the estimate, with the relative error.
  import { compilarModelo, formatear } from '../../lib/leccion11/modelo';
  import type { EstadoTarjeta } from '../../lib/leccion11/motor';
  import type { Valores } from '../../lib/leccion11/modelo';
  import { textoPlano } from '../../lib/leccion11/texto';
  import type { Leccion11, Tarjeta } from '../../lib/leccion11/tipos';
  import { errorRelativo, leerEstimacion } from '../../lib/leccion12/prediccion';
  import type { EstadoSimular, Simular } from '../../lib/leccion12/tipos';
  import type { Simulado } from '../../lib/leccion12/simulacion';
  import TextoVivo from '../leccion11/TextoVivo.svelte';

  let {
    leccion,
    t,
    a,
    e,
    ea,
    efectivos,
    prefijo,
    valor,
    cambiar,
  }: {
    leccion: Leccion11;
    t: Tarjeta;
    a: Simular;
    e: EstadoTarjeta;
    ea: EstadoSimular;
    efectivos: Valores;
    prefijo: string;
    valor: (id: string) => string;
    cambiar: (c: Partial<EstadoTarjeta>) => void;
  } = $props();

  const mc = $derived(compilarModelo(leccion.modelo));
  const mag = $derived({ sim: [], nombre: '', unidad: a.unidad, cifras: a.cifras, recortar: false });
  const objetivo = $derived(mc.funcion(a.objetivo)(mc.evaluar(efectivos)));
  const cerrada = $derived(e.resuelta);
  const id = $derived(`${prefijo}-estimacion`);
  let simulado = $state<Simulado | null>(null);
  let simulando = $state(false);
  let pedido = '';

  function escribir(texto: string) {
    if (cerrada) return;
    const v = leerEstimacion(texto, a.unidad);
    cambiar({ actividad: { ...ea, texto, valor: Number.isFinite(v) ? v : null }, comprobado: false, bien: null });
  }

  // after the estimate is committed: the circuit on the app's ngspice (once per card and values)
  $effect(() => {
    if (!cerrada || !a.medida || t.widget?.tipo !== 'circuito') return;
    const w = t.widget;
    const clave = JSON.stringify(efectivos);
    if (clave === pedido) return;
    pedido = clave;
    simulando = true;
    const medida = a.medida;
    const v = { ...efectivos };
    void import('../../lib/leccion12/simulacion')
      .then((m) => m.simularMedida(mc, w, medida, v))
      .then((r) => {
        simulado = r;
      })
      .catch((err: unknown) => {
        simulado = { valor: null, unidad: a.unidad, error: err instanceof Error ? err.message : String(err), ms: 0 };
      })
      .finally(() => {
        simulando = false;
      });
  });

  const malo = $derived(ea.texto.trim() !== '' && ea.valor == null);
  const referencia = $derived(simulado?.valor ?? objetivo);
  const err = $derived(ea.valor != null ? errorRelativo(ea.valor, referencia) : 0);
  const fmtPc = (x: number) => formatear({ sim: [], nombre: '', unidad: '%', cifras: 2, recortar: true }, x * 100);
</script>

<div class="a12 simular" data-simular>
  <label class="etq" for={id}><TextoVivo texto={a.rotulo} {valor} /></label>
  <div class="a12-fila">
    <input
      {id}
      class="a12-campo campo"
      type="text"
      inputmode="decimal"
      autocomplete="off"
      spellcheck="false"
      value={ea.texto}
      disabled={cerrada}
      aria-invalid={malo}
      aria-describedby={`${id}-ayuda`}
      oninput={(ev) => escribir((ev.currentTarget as HTMLInputElement).value)}
      data-estimacion
    />
    <span class="unidad" aria-hidden="true">{a.unidad}</span>
  </div>
  <p class="a12-suave" id={`${id}-ayuda`}>
    {#if malo}<span class="a12-no">No es un número.</span>{/if}
    Escriba su estimación en {a.unidad || 'la unidad'}; puede usar prefijos (4,7 k; 150 m). Después, «Comprobar» la fija y {a.medida && t.widget?.tipo === 'circuito' ? 'se simula' : 'se calcula con el modelo'}.
  </p>

  {#if cerrada && ea.valor != null}
    <div class="resultado" aria-live="polite" data-resultado-sim>
      <div class="a12-ficha">
        <span class="a12-suave">Su estimación</span>
        <strong data-su-valor>{formatear({ ...mag, recortar: true }, ea.valor)}</strong>
      </div>
      <div class="a12-ficha">
        <span class="a12-suave">{simulado?.valor != null ? 'El simulador (ngspice)' : 'El modelo'}</span>
        <strong data-simulado>{simulando ? 'Simulando…' : formatear(mag, referencia)}</strong>
      </div>
      <div class="a12-ficha">
        <span class="a12-suave">Error relativo</span>
        <strong class={err <= a.tol ? 'a12-ok' : 'a12-no'} data-error-relativo>{fmtPc(err)}</strong>
      </div>
    </div>
    <div class="barra" aria-hidden="true">
      {#if Number.isFinite(err)}
        <span class="banda" style:width={`${Math.min(100, (a.tol / 0.5) * 100)}%`}></span>
        <span class="aguja" style:left={`${Math.min(100, (err / 0.5) * 100)}%`}></span>
      {/if}
    </div>
    <p class="a12-suave">
      {#if simulado?.error}No se ha podido simular aquí ({simulado.error}); el valor es el del modelo, que se comprobó con ngspice.{:else if simulado?.valor != null}ngspice ha resuelto el circuito en {Math.max(1, Math.round(simulado.ms))} ms.{:else if !a.medida}Valor del modelo de la lección.{/if}
      <span class="a12-solo-lector">Tolerancia: {fmtPc(a.tol)}. {textoPlano(a.rotulo)}.</span>
    </p>
  {/if}
</div>

<style>
  .etq {
    font-weight: 600;
  }
  .campo {
    flex: 1 1 10em;
    max-width: 14em;
  }
  .unidad {
    font: 700 18px var(--v11-titular);
  }
  .resultado {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9em, 1fr));
    gap: 8px;
  }
  .barra {
    position: relative;
    height: 12px;
    border-radius: 6px;
    background: var(--v11-mal-tinte);
  }
  .banda {
    position: absolute;
    inset: 0 auto 0 0;
    border-radius: 6px;
    background: var(--v11-bien-tinte);
    border-right: 2px solid var(--v11-bien);
  }
  .aguja {
    position: absolute;
    top: -4px;
    width: 4px;
    height: 20px;
    margin-left: -2px;
    border-radius: 2px;
    background: var(--v11-tinta);
  }
</style>
