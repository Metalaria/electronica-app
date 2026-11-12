<script lang="ts">
  // 1.2 «En el banco» (optional): what to put on the bench, what to measure and what it should read; the reader types
  // the measured value and the app compares it with the expected one and its tolerance, with advice when it is off.
  // Nothing is stored or reported: «Continuar» is always open, and the sheet of the «Cuaderno de prácticas» is named.
  import { compilarModelo, enRango, formatear, type Valores } from '../../lib/leccion11/modelo';
  import type { EstadoTarjeta } from '../../lib/leccion11/motor';
  import type { Leccion11 } from '../../lib/leccion11/tipos';
  import { leerEstimacion } from '../../lib/leccion12/prediccion';
  import type { Banco, EstadoBanco } from '../../lib/leccion12/tipos';
  import TextoVivo from '../leccion11/TextoVivo.svelte';

  let {
    leccion,
    a,
    ea,
    efectivos,
    prefijo,
    valor,
    cambiar,
  }: {
    leccion: Leccion11;
    a: Banco;
    ea: EstadoBanco;
    efectivos: Valores;
    prefijo: string;
    valor: (id: string) => string;
    cambiar: (c: Partial<EstadoTarjeta>) => void;
  } = $props();

  const mc = $derived(compilarModelo(leccion.modelo));
  const mag = $derived({ sim: [], nombre: '', unidad: a.unidad, cifras: a.cifras, recortar: false });
  const pc = (x: number) => formatear({ sim: [], nombre: '', unidad: '%', cifras: 2, recortar: true }, x * 100);
  const esperado = $derived(mc.funcion(a.esperado)(mc.evaluar(efectivos)));
  const desviacion = $derived(ea.valor != null && esperado !== 0 ? ea.valor / esperado - 1 : NaN);
  const dentro = $derived(Number.isFinite(desviacion) && Math.abs(desviacion) <= a.tol + 1e-12);
  const consejo = $derived(ea.comparado && ea.valor != null && !dentro ? a.consejos.find((c) => !c.cuando || enRango(c.cuando, { desviacion, medida: ea.valor! })) : undefined);
  const id = $derived(`${prefijo}-banco`);
  const malo = $derived(ea.texto.trim() !== '' && ea.valor == null);

  function escribir(texto: string) {
    const v = leerEstimacion(texto, a.unidad);
    cambiar({ actividad: { ...ea, texto, valor: Number.isFinite(v) ? v : null, comparado: false } });
  }
</script>

<div class="a12 banco" data-banco>
  <p class="a12-suave">Paso opcional, para hacerlo con piezas de verdad; puede seguir sin él.</p>
  <div>
    <strong>Necesita</strong>
    <ul class="piezas">
      {#each a.piezas as p, k (k)}<li><TextoVivo texto={p} {valor} /></li>{/each}
    </ul>
  </div>
  <p><strong>Mida:</strong> <TextoVivo texto={a.medir} {valor} /></p>
  <div class="a12-ficha">
    <span class="a12-suave">Debería leer</span>
    <strong data-esperado>{formatear(mag, esperado)} ± {pc(a.tol)}</strong>
  </div>
  <label for={id}>Lo que ha medido</label>
  <div class="a12-fila">
    <input {id} class="a12-campo" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" value={ea.texto} aria-invalid={malo} oninput={(ev) => escribir((ev.currentTarget as HTMLInputElement).value)} data-medida-banco />
    <span aria-hidden="true">{a.unidad}</span>
    <button type="button" class="a12-boton a12-primario" disabled={ea.valor == null} onclick={() => cambiar({ actividad: { ...ea, comparado: true } })} data-comparar>Comparar</button>
  </div>
  {#if malo}<p class="a12-no">No es un número.</p>{/if}
  {#if ea.comparado && ea.valor != null}
    <div aria-live="polite" data-comparacion={dentro ? 'bien' : 'mal'}>
      <p class={dentro ? 'a12-ok' : 'a12-no'}>
        {dentro ? 'Dentro de la tolerancia' : 'Fuera de la tolerancia'}: se desvía un {pc(Math.abs(desviacion))} {desviacion >= 0 ? 'por encima' : 'por debajo'}.
      </p>
      {#if consejo}<p data-consejo><TextoVivo texto={consejo.texto} {valor} /></p>{/if}
    </div>
  {/if}
  {#if a.ficha}
    <p class="a12-suave" data-ficha={a.ficha.n}>Cuaderno de prácticas, ficha {a.ficha.n}: «{a.ficha.titulo}».</p>
  {/if}
</div>

<style>
  .piezas {
    margin: 4px 0 0;
    padding-left: 1.2em;
  }
  label {
    font-weight: 600;
  }
  input {
    flex: 1 1 8em;
    max-width: 12em;
  }
</style>
